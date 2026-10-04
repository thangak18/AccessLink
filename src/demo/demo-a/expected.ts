import type { DatasetSnapshot } from "@/contracts/types";
import { applyChangeset } from "@/modules/review-publication/apply";
import { buildSnapshotS0, sumLengths } from "@/demo/demo-a/model";
import { noticeS1, noticeS2, ruleS1, ruleS2 } from "@/demo/demo-a/notices";

const S1_PUBLISHED_AT = "2026-10-01T10:30:00.000Z";
const S2_PUBLISHED_AT = "2026-10-01T10:40:00.000Z";

export function buildSnapshotS1(): DatasetSnapshot {
  return applyChangeset(
    buildSnapshotS0(),
    {
      id: "changeset_s1_close_g2",
      dataset_id: "demo-a",
      base_version: 1,
      status: "draft",
      rules: [ruleS1()],
      evidence: [noticeS1()],
      note: "Đóng G2 trong môi trường demo",
      created_by: "fixture",
      created_at: S1_PUBLISHED_AT,
      published_version: null,
      reviewer_id: null,
      published_at: null,
    },
    { version: 2, publishedAt: S1_PUBLISHED_AT },
  );
}

export function buildSnapshotS2(): DatasetSnapshot {
  return applyChangeset(
    buildSnapshotS1(),
    {
      id: "changeset_s2_close_g3",
      dataset_id: "demo-a",
      base_version: 2,
      status: "draft",
      rules: [ruleS2()],
      evidence: [noticeS2()],
      note: "Đóng thêm G3 trong môi trường demo",
      created_by: "fixture",
      created_at: S2_PUBLISHED_AT,
      published_version: null,
      reviewer_id: null,
      published_at: null,
    },
    { version: 3, publishedAt: S2_PUBLISHED_AT },
  );
}

/** S0 với bằng chứng cho phép đi G2 đã quá hạn. Không phải kết quả tìm đường. */
export function buildSnapshotS4(): DatasetSnapshot {
  const snapshot = structuredClone(buildSnapshotS0());
  const evidence = snapshot.evidence.find((item) => item.id === "evidence_g2_open");
  if (!evidence) throw new Error("Thiếu evidence_g2_open");
  evidence.review_due_at = "2026-10-01T05:00:00.000Z";
  evidence.review_status = "needs_review";
  return snapshot;
}

export type ExpectedLeg = { edge_id: string; mode: "motorcycle" | "walk" };

export type ExpectedPlan = {
  scenario_id: string;
  place_id: string;
  mode: "motorcycle" | "walk";
  depart_at: string;
  route_status: "available" | "needs_verification" | "no_plan_found";
  legs: ExpectedLeg[];
  walk_length_m: number | null;
  derivation: string;
  reason_codes: string[];
};

const DEPART_S0 = "2026-10-01T17:00:00+07:00";
const DEPART_S1 = "2026-10-01T18:05:00+07:00";
const DEPART_S3 = "2026-10-01T20:05:00+07:00";

function plan(
  scenarioId: string,
  placeId: string,
  mode: "motorcycle" | "walk",
  departAt: string,
  routeStatus: ExpectedPlan["route_status"],
  legs: ExpectedLeg[],
  derivation: string,
  reasonCodes: string[],
  snapshot: DatasetSnapshot,
): ExpectedPlan {
  const walkEdges = legs.filter((leg) => leg.mode === "walk").map((leg) => leg.edge_id);
  return {
    scenario_id: scenarioId,
    place_id: placeId,
    mode,
    depart_at: departAt,
    route_status: routeStatus,
    legs,
    walk_length_m: routeStatus === "no_plan_found" ? null : sumLengths(snapshot, walkEdges),
    derivation,
    reason_codes: reasonCodes,
  };
}

/** Đáp án viết từ bảng cạnh và quy tắc kịch bản. Không gọi engine. */
export function expectedPlans(): ExpectedPlan[] {
  const lengths = buildSnapshotS0();
  const moto = (edgeId: string): ExpectedLeg => ({ edge_id: edgeId, mode: "motorcycle" });
  const walk = (edgeId: string): ExpectedLeg => ({ edge_id: edgeId, mode: "walk" });
  const viaG2 = [moto("e01"), walk("e04"), walk("e05")];
  const viaG3 = [moto("e01"), walk("e06"), walk("e07")];
  return [
    plan("S0", "place_a", "motorcycle", DEPART_S0, "available", [...viaG2, walk("e08")], "Đi bộ 40+30+20", [], lengths),
    plan("S0", "place_b", "motorcycle", DEPART_S0, "available", [...viaG2, walk("e09")], "Đi bộ 40+30+35", [], lengths),
    plan("S0", "place_c", "motorcycle", DEPART_S0, "available", [moto("e10")], "Không đi bộ", [], lengths),
    plan("S1", "place_a", "motorcycle", DEPART_S1, "available", [...viaG3, walk("e08")], "Đi bộ 120+60+20", [], lengths),
    plan("S1", "place_b", "motorcycle", DEPART_S1, "available", [...viaG3, walk("e09")], "Đi bộ 120+60+35", [], lengths),
    plan("S1", "place_c", "motorcycle", DEPART_S1, "available", [moto("e10")], "C không dùng G2", [], lengths),
    plan("S2", "place_a", "motorcycle", DEPART_S1, "no_plan_found", [], "G1 G2 G3 đóng", ["no_plan_in_scope"], lengths),
    plan("S2", "place_b", "motorcycle", DEPART_S1, "no_plan_found", [], "G1 G2 G3 đóng", ["no_plan_in_scope"], lengths),
    plan("S2", "place_c", "motorcycle", DEPART_S1, "available", [moto("e10")], "C giữ tuyến riêng", [], lengths),
    plan("S3", "place_a", "motorcycle", DEPART_S3, "no_plan_found", [], "P hết giờ nhận xe", ["transfer_unavailable"], lengths),
    plan("S3", "place_a", "walk", DEPART_S3, "available", [walk("e01"), walk("e04"), walk("e05"), walk("e08")], "Đi bộ qua P: 100+40+30+20", [], lengths),
    plan("S4", "place_a", "motorcycle", DEPART_S0, "available", [...viaG3, walk("e08")], "G2 quá hạn, ưu tiên G3", ["g2_needs_verification"], lengths),
    plan("S4", "place_b", "motorcycle", DEPART_S0, "available", [...viaG3, walk("e09")], "G2 quá hạn, B qua G3", ["g2_needs_verification"], lengths),
    plan("S4", "place_c", "motorcycle", DEPART_S0, "available", [moto("e10")], "C không phụ thuộc G2", [], lengths),
  ];
}
