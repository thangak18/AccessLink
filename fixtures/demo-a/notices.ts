import type { Evidence, AccessRule } from "../../src/contracts/types";

const CREATED_AT = "2026-09-25T02:00:00.000Z";

export function noticeS1(): Evidence {
  return {
    id: "synthetic_notice_s1",
    type: "notice",
    source_type: "synthetic",
    source_url: null,
    is_simulated: true,
    verification_status: "demo_only",
    review_status: "pending",
    created_at: CREATED_AT,
    observed_at: null,
    published_at: null,
    reviewed_at: null,
    review_due_at: "2026-10-03T02:00:00.000Z",
    authority_scope: "simulation_only",
    rights: "synthetic-internal",
    content:
      "THÔNG BÁO MÔ PHỎNG — KHÔNG PHẢI VĂN BẢN CƠ QUAN NHÀ NƯỚC. Tại Khu demo A, từ 18:00 ngày 01/10/2026, lối G2 tạm dừng sử dụng đối với người đi bộ theo cả hai chiều. Chưa xác định thời điểm mở lại. Lối G3 tiếp tục dành cho khách đi bộ theo điều kiện hiện có.",
  };
}

export function ruleS1(): AccessRule {
  return {
    id: "rule_s1_g2_closed",
    target_type: "access_node",
    target_id: "G2",
    mode: ["walk"],
    purpose: ["customer"],
    direction: "both",
    effect: "closed",
    valid_from: "2026-10-01T18:00:00+07:00",
    valid_to: null,
    time_windows: [],
    evidence_ids: ["synthetic_notice_s1"],
    version: 2,
    is_simulated: true,
    verification_status: "demo_only",
  };
}

export function noticeS2(): Evidence {
  return {
    ...noticeS1(),
    id: "synthetic_notice_s2",
    content:
      "THÔNG BÁO MÔ PHỎNG — KHÔNG PHẢI VĂN BẢN CƠ QUAN NHÀ NƯỚC. Lối G3 cũng tạm dừng với người đi bộ theo cả hai chiều từ 18:00 ngày 01/10/2026. Chưa xác định thời điểm mở lại.",
  };
}

export function ruleS2(): AccessRule {
  return {
    ...ruleS1(),
    id: "rule_s2_g3_closed",
    target_id: "G3",
    evidence_ids: ["synthetic_notice_s2"],
    version: 3,
  };
}
