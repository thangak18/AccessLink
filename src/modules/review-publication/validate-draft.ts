import type { AccessRule, DatasetSnapshot, Evidence } from "@/contracts/types";
import { DomainError } from "@/domain/errors";

export function validateDraft(snapshot: DatasetSnapshot, rules: AccessRule[], evidence: Evidence[]): void {
  if (rules.length === 0 && evidence.length === 0) {
    throw new DomainError("EMPTY_CHANGESET", "Bản nháp cần ít nhất một quy tắc hoặc một bằng chứng.", 400);
  }
  const evidenceIds = new Set([
    ...snapshot.evidence.map((item) => item.id),
    ...evidence.map((item) => item.id),
  ]);
  const nodeIds = new Set(snapshot.nodes.map((node) => node.id));
  const edgeIds = new Set(snapshot.edges.map((edge) => edge.id));

  for (const item of evidence) {
    if (!item.is_simulated || item.verification_status !== "demo_only" || item.source_type !== "synthetic") {
      throw new DomainError(
        "SIMULATION_LABEL",
        "Dữ liệu mô phỏng không được ghi là đã xác minh thực địa.",
        400,
      );
    }
  }

  for (const rule of rules) {
    if (!rule.is_simulated || rule.verification_status !== "demo_only") {
      throw new DomainError(
        "SIMULATION_LABEL",
        "Duyệt vào demo không biến quy tắc mô phỏng thành dữ liệu thực địa.",
        400,
      );
    }
    const known = rule.target_type === "access_node" ? nodeIds.has(rule.target_id) : edgeIds.has(rule.target_id);
    if (!known) {
      throw new DomainError("UNKNOWN_TARGET", `Không có ${rule.target_type} ${rule.target_id} trong phiên bản nền.`, 400, {
        target_id: rule.target_id,
      });
    }
    for (const evidenceId of rule.evidence_ids) {
      if (!evidenceIds.has(evidenceId)) {
        throw new DomainError("MISSING_EVIDENCE", `Thiếu bằng chứng ${evidenceId}.`, 400, { evidence_id: evidenceId });
      }
    }
    if (rule.valid_to !== null && Date.parse(rule.valid_to) <= Date.parse(rule.valid_from)) {
      throw new DomainError("INVALID_TIME", "valid_to phải sau valid_from. Null nghĩa là chưa biết lúc kết thúc.", 400);
    }
  }
}
