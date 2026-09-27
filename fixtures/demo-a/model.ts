import type {
  AccessEdge,
  AccessNode,
  AccessRule,
  DatasetSnapshot,
  Evidence,
  Place,
  PlaceOperation,
  TransferRule,
  TravelMode,
  WorkZone,
} from "../../src/contracts/types";

export const DEMO_DATASET_ID = "demo-a";
export const GEOMETRY_NOTE =
  "Tọa độ là sơ đồ giả lập của Khu demo A. Chiều dài chặng lấy length_m trong fixture, không đo từ hình học và không dùng để dẫn đường.";

const PUBLISHED_AT = "2026-09-26T02:00:00.000Z";
const CREATED_AT = "2026-09-25T02:00:00.000Z";
const REVIEW_DUE = "2026-10-02T02:00:00.000Z";

/** Sơ đồ, không phải tọa độ cửa hàng thật. */
const COORD: Record<string, [number, number]> = {
  O: [106.695, 10.776],
  C: [106.6942, 10.776],
  G1: [106.6956, 10.7765],
  J: [106.6962, 10.7768],
  A: [106.6968, 10.7768],
  B: [106.6962, 10.7774],
  P: [106.6958, 10.7754],
  G2: [106.6966, 10.7758],
  G3: [106.6974, 10.7752],
};

const EDGE_TABLE: Array<{
  id: string;
  from: string;
  to: string;
  length_m: number;
  modes: TravelMode[];
  evidence_ids: string[];
}> = [
  { id: "e01", from: "O", to: "P", length_m: 100, modes: ["motorcycle", "walk"], evidence_ids: ["evidence_layout_survey"] },
  { id: "e02", from: "O", to: "G1", length_m: 60, modes: ["walk"], evidence_ids: ["evidence_g1_closed"] },
  { id: "e03", from: "G1", to: "J", length_m: 20, modes: ["walk"], evidence_ids: ["evidence_g1_closed"] },
  { id: "e04", from: "P", to: "G2", length_m: 40, modes: ["walk"], evidence_ids: ["evidence_g2_open"] },
  { id: "e05", from: "G2", to: "J", length_m: 30, modes: ["walk"], evidence_ids: ["evidence_g2_open"] },
  { id: "e06", from: "P", to: "G3", length_m: 120, modes: ["walk"], evidence_ids: ["evidence_g3_open"] },
  { id: "e07", from: "G3", to: "J", length_m: 60, modes: ["walk"], evidence_ids: ["evidence_g3_open"] },
  { id: "e08", from: "J", to: "A", length_m: 20, modes: ["walk"], evidence_ids: ["evidence_layout_survey"] },
  { id: "e09", from: "J", to: "B", length_m: 35, modes: ["walk"], evidence_ids: ["evidence_layout_survey"] },
  { id: "e10", from: "O", to: "C", length_m: 90, modes: ["motorcycle", "walk"], evidence_ids: ["evidence_layout_survey"] },
];

function point(id: string): { type: "Point"; coordinates: [number, number] } {
  return { type: "Point", coordinates: COORD[id] };
}

function line(from: string, to: string): { type: "LineString"; coordinates: [number, number][] } {
  return { type: "LineString", coordinates: [COORD[from], COORD[to]] };
}

function evidence(partial: Pick<Evidence, "id" | "type" | "content" | "review_due_at">): Evidence {
  return {
    id: partial.id,
    type: partial.type,
    source_type: "synthetic",
    source_url: null,
    is_simulated: true,
    verification_status: "demo_only",
    review_status: "approved",
    created_at: CREATED_AT,
    observed_at: null,
    published_at: PUBLISHED_AT,
    reviewed_at: PUBLISHED_AT,
    review_due_at: partial.review_due_at,
    authority_scope: "simulation_only",
    rights: "synthetic-internal",
    content: partial.content,
  };
}

function baseEvidence(): Evidence[] {
  return [
    evidence({
      id: "evidence_layout_survey",
      type: "survey",
      review_due_at: REVIEW_DUE,
      content: "Sơ đồ mạng Khu demo A do nhóm tạo để kiểm thử. Không phải khảo sát hiện trường.",
    }),
    evidence({
      id: "evidence_g1_closed",
      type: "notice",
      review_due_at: REVIEW_DUE,
      content: "Lối mặt tiền G1 bị chặn trong trạng thái đầu của Khu demo A. Thông báo mô phỏng do nhóm tạo.",
    }),
    evidence({
      id: "evidence_g2_open",
      type: "survey",
      review_due_at: REVIEW_DUE,
      content: "Lối phụ G2 dành cho khách đi bộ trong trạng thái đầu. Dữ liệu mô phỏng do nhóm tạo.",
    }),
    evidence({
      id: "evidence_g3_open",
      type: "survey",
      review_due_at: REVIEW_DUE,
      content: "Lối phụ G3 dành cho khách đi bộ, dài hơn G2. Dữ liệu mô phỏng do nhóm tạo.",
    }),
    evidence({
      id: "evidence_parking_hours",
      type: "survey",
      review_due_at: REVIEW_DUE,
      content: "Điểm P nhận gửi xe máy từ 06:00 đến trước 20:00 trong đồng hồ mô phỏng.",
    }),
    evidence({
      id: "evidence_place_hours",
      type: "survey",
      review_due_at: REVIEW_DUE,
      content: "Cửa hàng A, B và C hoạt động từ 06:00 đến trước 22:00 trong kịch bản mô phỏng.",
    }),
  ];
}

function nodes(): AccessNode[] {
  const rows: Array<[string, AccessNode["type"], string, string | null, string[]]> = [
    ["O", "origin", "Điểm xuất phát", null, ["evidence_layout_survey"]],
    ["P", "parking", "Điểm gửi xe", null, ["evidence_parking_hours"]],
    ["G1", "gate", "Lối mặt tiền", null, ["evidence_g1_closed"]],
    ["G2", "gate", "Lối phụ", null, ["evidence_g2_open"]],
    ["G3", "gate", "Lối phụ thay thế", null, ["evidence_g3_open"]],
    ["J", "junction", "Điểm nối", null, ["evidence_layout_survey"]],
    ["A", "entrance", "Cửa cửa hàng A", "place_a", ["evidence_layout_survey"]],
    ["B", "entrance", "Cửa cửa hàng B", "place_b", ["evidence_layout_survey"]],
    ["C", "entrance", "Cửa cửa hàng C", "place_c", ["evidence_layout_survey"]],
  ];
  return rows.map(([id, type, label, placeId, evidenceIds]) => ({
    id,
    place_id: placeId,
    type,
    geometry: point(id),
    label,
    evidence_ids: evidenceIds,
  }));
}

function edges(): AccessEdge[] {
  return EDGE_TABLE.map((row) => ({
    id: row.id,
    from_node: row.from,
    to_node: row.to,
    geometry: line(row.from, row.to),
    length_m: row.length_m,
    allowed_modes: row.modes,
    direction: "both",
    evidence_ids: row.evidence_ids,
  }));
}

function places(): Place[] {
  return [
    { id: "place_a", name: "Cửa hàng A", aliases: ["A"], location: point("A"), operator_id: null, entrance_node_id: "A" },
    { id: "place_b", name: "Cửa hàng B", aliases: ["B"], location: point("B"), operator_id: null, entrance_node_id: "B" },
    { id: "place_c", name: "Cửa hàng C", aliases: ["C"], location: point("C"), operator_id: null, entrance_node_id: "C" },
  ];
}

function operations(): PlaceOperation[] {
  return ["place_a", "place_b", "place_c"].map((placeId) => ({
    place_id: placeId,
    status: "open",
    opening_windows: [{ start: "06:00", end: "22:00" }],
    evidence_ids: ["evidence_place_hours"],
    review_due_at: REVIEW_DUE,
  }));
}

function workZone(): WorkZone {
  const lons = Object.values(COORD).map((pair) => pair[0]);
  const lats = Object.values(COORD).map((pair) => pair[1]);
  const pad = 0.0004;
  const minLon = Math.min(...lons) - pad;
  const maxLon = Math.max(...lons) + pad;
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  return {
    id: "zone_demo_a",
    name: "Khu demo A",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ]],
    },
    source_ids: ["evidence_layout_survey"],
  };
}

function g1Closure(): AccessRule {
  return {
    id: "rule_s0_g1_closed",
    target_type: "access_node",
    target_id: "G1",
    mode: ["motorcycle", "walk"],
    purpose: ["customer"],
    direction: "both",
    effect: "closed",
    valid_from: "2026-10-01T00:00:00+07:00",
    valid_to: null,
    time_windows: [],
    evidence_ids: ["evidence_g1_closed"],
    version: 1,
    is_simulated: true,
    verification_status: "demo_only",
  };
}

export function transferAtP(): TransferRule {
  return {
    id: "transfer_p_motorcycle_walk",
    node_id: "P",
    from_mode: "motorcycle",
    to_mode: "walk",
    windows: [{ start: "06:00", end: "20:00" }],
    transfer_seconds: 180,
    evidence_ids: ["evidence_parking_hours"],
  };
}

export function buildSnapshotS0(): DatasetSnapshot {
  return {
    dataset_id: DEMO_DATASET_ID,
    name: "Khu demo A",
    environment: "demo",
    version: 1,
    data_kind: "simulated",
    is_simulated: true,
    timezone: "Asia/Ho_Chi_Minh",
    geometry_note: GEOMETRY_NOTE,
    published_at: PUBLISHED_AT,
    places: places(),
    operations: operations(),
    nodes: nodes(),
    edges: edges(),
    work_zones: [workZone()],
    rules: [g1Closure()],
    evidence: baseEvidence(),
    transfer_rules: [transferAtP()],
  };
}

export function edgeLength(snapshot: DatasetSnapshot, edgeId: string): number {
  const edge = snapshot.edges.find((item) => item.id === edgeId);
  if (!edge) throw new Error(`Thiếu cạnh ${edgeId}`);
  return edge.length_m;
}

export function sumLengths(snapshot: DatasetSnapshot, edgeIds: string[]): number {
  return edgeIds.reduce((total, id) => total + edgeLength(snapshot, id), 0);
}

export { EDGE_TABLE };
