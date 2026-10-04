import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSnapshotS1, buildSnapshotS2, buildSnapshotS4, expectedPlans } from "@/demo/demo-a/expected";
import { buildSnapshotS0 } from "@/demo/demo-a/model";
import type { DatasetSnapshot } from "@/contracts/types";
import { isRuleActiveAt } from "@/modules/evidence/validity";
import { layerFlags, parkingAccepts } from "@/modules/evidence/layer-status";
import { featureCollection } from "@/modules/places/catalog";

const entrance: Record<string, string> = {
  place_a: "A",
  place_b: "B",
  place_c: "C",
};

function flag(snapshot: DatasetSnapshot, nodeId: string, mode: "walk" | "motorcycle", at: string) {
  return layerFlags(snapshot, new Date(at)).find(
    (item) => item.target_type === "access_node" && item.target_id === nodeId && item.mode === mode,
  )?.status;
}

describe("fixture Khu demo A", () => {
  const snapshot = buildSnapshotS0();

  it("có đúng mạng trong tài liệu mock, không thêm cạnh", () => {
    expect(snapshot.nodes.map((node) => node.id)).toEqual(["O", "P", "G1", "G2", "G3", "J", "A", "B", "C"]);
    expect(snapshot.edges.map((edge) => edge.id)).toEqual([
      "e01", "e02", "e03", "e04", "e05", "e06", "e07", "e08", "e09", "e10",
    ]);
    const nodeIds = new Set(snapshot.nodes.map((node) => node.id));
    for (const edge of snapshot.edges) {
      expect(nodeIds.has(edge.from_node)).toBe(true);
      expect(nodeIds.has(edge.to_node)).toBe(true);
    }
    expect(snapshot.is_simulated).toBe(true);
    expect(snapshot.rules.every((rule) => rule.is_simulated && rule.verification_status === "demo_only")).toBe(true);
  });

  it("đáp án cộng từ bảng cạnh và nối được từ O tới cửa", () => {
    const documented: Record<string, number | null> = {
      "S0:place_a:motorcycle": 90,
      "S0:place_b:motorcycle": 105,
      "S0:place_c:motorcycle": 0,
      "S1:place_a:motorcycle": 200,
      "S1:place_b:motorcycle": 215,
      "S1:place_c:motorcycle": 0,
      "S2:place_a:motorcycle": null,
      "S3:place_a:motorcycle": null,
      "S3:place_a:walk": 190,
      "S4:place_a:motorcycle": 200,
    };
    for (const plan of expectedPlans()) {
      const key = `${plan.scenario_id}:${plan.place_id}:${plan.mode}`;
      if (key in documented) expect(plan.walk_length_m).toBe(documented[key]);
      if (plan.route_status === "no_plan_found") {
        expect(plan.legs).toEqual([]);
        continue;
      }
      let cursor = "O";
      for (const leg of plan.legs) {
        const edge = snapshot.edges.find((item) => item.id === leg.edge_id);
        expect(edge, leg.edge_id).toBeTruthy();
        expect(edge?.from_node).toBe(cursor);
        expect(edge?.allowed_modes).toContain(leg.mode);
        cursor = edge!.to_node;
      }
      expect(cursor).toBe(entrance[plan.place_id]);
    }
    const s0a = expectedPlans().find((plan) => plan.scenario_id === "S0" && plan.place_id === "place_a");
    expect(s0a?.legs.map((leg) => leg.edge_id)).not.toContain("e02");
    expect(s0a?.legs.map((leg) => leg.edge_id)).not.toContain("e03");
  });

  it("S1 và S2 giữ nguyên cạnh, chỉ thêm quy tắc", () => {
    const s1 = buildSnapshotS1();
    expect(s1.version).toBe(2);
    expect(s1.edges).toHaveLength(10);
    expect(s1.rules.map((rule) => rule.id)).toContain("rule_s1_g2_closed");
    expect(s1.is_simulated).toBe(true);
    expect(s1.rules.find((rule) => rule.id === "rule_s1_g2_closed")?.verification_status).toBe("demo_only");
    expect(buildSnapshotS2().rules.map((rule) => rule.id)).toEqual([
      "rule_s0_g1_closed",
      "rule_s1_g2_closed",
      "rule_s2_g3_closed",
    ]);
  });

  it("ranh giới 18:00 và 20:00 là nửa mở", () => {
    const s1 = buildSnapshotS1();
    const g2 = s1.rules.find((rule) => rule.id === "rule_s1_g2_closed");
    expect(g2).toBeTruthy();
    expect(isRuleActiveAt(g2!, new Date("2026-10-01T17:59:00+07:00"))).toBe(false);
    expect(isRuleActiveAt(g2!, new Date("2026-10-01T18:00:00+07:00"))).toBe(true);
    expect(flag(s1, "G2", "walk", "2026-10-01T17:59:00+07:00")).toBe("open");
    expect(flag(s1, "G2", "walk", "2026-10-01T18:05:00+07:00")).toBe("closed");
    expect(flag(s1, "G1", "walk", "2026-10-01T17:00:00+07:00")).toBe("closed");
    expect(parkingAccepts(snapshot, "P", new Date("2026-10-01T06:00:00+07:00"))).toBe(true);
    expect(parkingAccepts(snapshot, "P", new Date("2026-10-01T05:59:00+07:00"))).toBe(false);
    expect(parkingAccepts(snapshot, "P", new Date("2026-10-01T19:59:00+07:00"))).toBe(true);
    expect(parkingAccepts(snapshot, "P", new Date("2026-10-01T20:00:00+07:00"))).toBe(false);
    expect(flag(snapshot, "P", "walk", "2026-10-01T20:05:00+07:00")).toBe("open");
  });

  it("bằng chứng cho phép đi bị quá hạn không mở lệnh cấm", () => {
    const s4 = buildSnapshotS4();
    expect(flag(s4, "G2", "walk", "2026-10-01T17:00:00+07:00")).toBe("needs_verification");
    expect(flag(s4, "G3", "walk", "2026-10-01T17:00:00+07:00")).toBe("open");
    const staleClosure = structuredClone(snapshot);
    const evidence = staleClosure.evidence.find((item) => item.id === "evidence_g1_closed");
    evidence!.review_status = "needs_review";
    evidence!.review_due_at = "2026-10-01T01:00:00+07:00";
    expect(flag(staleClosure, "G1", "walk", "2026-10-01T17:00:00+07:00")).toBe("closed");
  });

  it("GeoJSON đã ghi khớp snapshot và giữ length_m", () => {
    const layer = JSON.parse(readFileSync("data/demo/demo-a/s0.layer.geojson", "utf8"));
    expect(layer).toEqual({ type: "FeatureCollection", features: featureCollection(snapshot) });
    const edge = layer.features.find((feature: { id: string }) => feature.id === "edge/e05");
    expect(edge.properties.length_m).toBe(30);
    expect(edge.properties.length_source).toBe("fixture_table");
    const plans = JSON.parse(readFileSync("data/demo/demo-a/expected-plans.json", "utf8"));
    expect(plans).toEqual(expectedPlans());
  });
});
