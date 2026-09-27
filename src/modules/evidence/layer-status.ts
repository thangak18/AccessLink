import type {
  AccessEdge,
  AccessNode,
  AccessRule,
  DatasetSnapshot,
  Evidence,
  TravelMode,
} from "../../contracts/types";
import { isEvidenceStale, isRuleActiveAt, windowContainsInstant } from "./validity";

export type DisplayStatus = "open" | "closed" | "needs_verification" | "not_allowed";

const MODES: TravelMode[] = ["motorcycle", "walk"];

function evidenceById(snapshot: DatasetSnapshot, ids: string[]): Evidence[] {
  return ids.flatMap((id) => {
    const found = snapshot.evidence.find((item) => item.id === id);
    return found ? [found] : [];
  });
}

function closureOn(
  rules: AccessRule[],
  targetType: AccessRule["target_type"],
  targetId: string,
  mode: TravelMode,
  at: Date,
): boolean {
  return rules.some(
    (rule) =>
      rule.effect === "closed" &&
      rule.target_type === targetType &&
      rule.target_id === targetId &&
      rule.mode.includes(mode) &&
      rule.purpose.includes("customer") &&
      (rule.direction === "both" || rule.direction === "forward") &&
      isRuleActiveAt(rule, at),
  );
}

function freshness(items: Evidence[], at: Date): DisplayStatus {
  if (items.length === 0 || items.some((item) => isEvidenceStale(item, at))) {
    return "needs_verification";
  }
  return "open";
}

export function nodeStatus(
  snapshot: DatasetSnapshot,
  node: AccessNode,
  mode: TravelMode,
  at: Date,
): DisplayStatus {
  const incident = snapshot.edges.filter(
    (edge) => edge.from_node === node.id || edge.to_node === node.id,
  );
  if (!incident.some((edge) => edge.allowed_modes.includes(mode))) return "not_allowed";
  if (closureOn(snapshot.rules, "access_node", node.id, mode, at)) return "closed";
  return freshness(evidenceById(snapshot, node.evidence_ids), at);
}

export function edgeStatus(
  snapshot: DatasetSnapshot,
  edge: AccessEdge,
  mode: TravelMode,
  at: Date,
): DisplayStatus {
  if (!edge.allowed_modes.includes(mode)) return "not_allowed";
  if (closureOn(snapshot.rules, "access_edge", edge.id, mode, at)) return "closed";
  const ends = snapshot.nodes.filter((node) => node.id === edge.from_node || node.id === edge.to_node);
  const endStatuses = ends.map((node) => nodeStatus(snapshot, node, mode, at));
  if (endStatuses.includes("closed")) return "closed";
  if (endStatuses.includes("needs_verification")) return "needs_verification";
  return freshness(evidenceById(snapshot, edge.evidence_ids), at);
}

export type LayerFlag = {
  target_type: "access_node" | "access_edge";
  target_id: string;
  mode: TravelMode;
  status: DisplayStatus;
};

export function layerFlags(snapshot: DatasetSnapshot, at: Date): LayerFlag[] {
  const flags: LayerFlag[] = [];
  for (const node of snapshot.nodes) {
    for (const mode of MODES) {
      flags.push({
        target_type: "access_node",
        target_id: node.id,
        mode,
        status: nodeStatus(snapshot, node, mode, at),
      });
    }
  }
  for (const edge of snapshot.edges) {
    for (const mode of MODES) {
      flags.push({
        target_type: "access_edge",
        target_id: edge.id,
        mode,
        status: edgeStatus(snapshot, edge, mode, at),
      });
    }
  }
  return flags;
}

export function parkingAccepts(snapshot: DatasetSnapshot, nodeId: string, at: Date): boolean | null {
  const rule = snapshot.transfer_rules.find((item) => item.node_id === nodeId);
  if (!rule) return null;
  return rule.windows.some((window) => windowContainsInstant(window, at));
}
