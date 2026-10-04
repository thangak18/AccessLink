import { buildSnapshotS0 } from "@/demo/demo-a/model";
import {
  buildSnapshotS1,
  buildSnapshotS2,
  buildSnapshotS4,
  expectedPlans,
} from "@/demo/demo-a/expected";
import { featureCollection } from "@/modules/places/catalog";
import { layerFlags } from "@/modules/evidence/layer-status";
import type { PublicQuery, PublicView } from "@/features/access-explorer/types";

export const scenarios = [
  {
    id: "S0",
    label: "Lối phụ đang mở",
    time: "17:00",
    note: "Gửi xe tại P, đi bộ qua G2. Lối mặt tiền G1 đang đóng.",
  },
  {
    id: "S1",
    label: "G2 đóng sau 18:00",
    time: "18:05",
    note: "A và B chuyển sang G3. C giữ lối tiếp cận riêng.",
  },
  {
    id: "S2",
    label: "Không còn lối phù hợp",
    time: "18:05",
    note: "G1, G2 và G3 đều đóng. Chưa có phương án tới A/B trong cụm.",
  },
  {
    id: "S3",
    label: "Hết giờ nhận gửi xe",
    time: "20:05",
    note: "P không nhận xe sau 20:00. Người đi bộ vẫn có thể đi qua P.",
  },
  {
    id: "S4",
    label: "Thông tin G2 quá hạn",
    time: "17:00",
    note: "G2 cần kiểm tra lại. Kịch bản mẫu sử dụng G3 còn thông tin phù hợp.",
  },
  {
    id: "S5",
    label: "Phản ánh mở lại G2",
    time: "18:05",
    note: "Phản ánh chưa được xác minh không làm G2 tự mở. Giữ trạng thái S1.",
  },
] as const;
export type ScenarioId = (typeof scenarios)[number]["id"];
export function scenarioTime(id: ScenarioId) {
  return `2026-10-01T${scenarios.find((s) => s.id === id)!.time}:00+07:00`;
}
/** Display-only fixture adapter. No routing algorithm or live API fallback. */
export function fixtureView(id: ScenarioId, query: PublicQuery): PublicView {
  const snapshot =
    id === "S1" || id === "S5"
      ? buildSnapshotS1()
      : id === "S2"
        ? buildSnapshotS2()
        : id === "S4"
          ? buildSnapshotS4()
          : buildSnapshotS0();
  const expected = expectedPlans().find(
    (p) =>
      p.scenario_id === (id === "S5" ? "S1" : id) &&
      p.place_id === query.place_id &&
      p.mode === query.mode,
  );
  const supported =
    query.origin_node_id === "O" &&
    query.depart_at === scenarioTime(id) &&
    expected;
  const plan = supported
    ? {
        ...expected,
        data_version: snapshot.version,
        data_kind: "simulated" as const,
        evaluated_at: query.depart_at,
        destination_node_id: snapshot.places.find(
          (p) => p.id === query.place_id,
        )?.entrance_node_id,
        limitations: expected.reason_codes,
        legs: expected.legs.map((leg) => {
          const edge = snapshot.edges.find((e) => e.id === leg.edge_id)!;
          return {
            edge_id: edge.id,
            mode: leg.mode,
            from_node_id: edge.from_node,
            to_node_id: edge.to_node,
            length_m: edge.length_m,
          };
        }),
      }
    : null;
  return {
    places: snapshot.places.map((p) => ({
      ...p,
      operation: snapshot.operations.find((o) => o.place_id === p.id) ?? null,
    })),
    layer: {
      dataset_id: snapshot.dataset_id,
      data_version: snapshot.version,
      data_kind: snapshot.data_kind,
      is_simulated: true,
      geometry_note: snapshot.geometry_note,
      evaluated_at: query.depart_at,
      flags: layerFlags(snapshot, new Date(query.depart_at)),
      feature_collection: {
        type: "FeatureCollection",
        features: featureCollection(snapshot),
      },
    },
    plan,
    planError: plan
      ? undefined
      : "Chưa có đáp án mẫu cho lựa chọn này. Chế độ mẫu không tự tính đường; hãy chọn xe máy hoặc kịch bản S3 → đi bộ → A.",
    evidence: snapshot.evidence,
  };
}
