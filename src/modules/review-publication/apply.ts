import type { ChangeSet, DatasetSnapshot } from "../../contracts/types";

/**
 * Ghép rule và bằng chứng của một bản nháp vào bản sao snapshot.
 * Không xóa cạnh. Không đổi dữ liệu mô phỏng thành dữ liệu thực địa.
 */
export function applyChangeset(
  base: DatasetSnapshot,
  changeset: ChangeSet,
  meta: { version: number; publishedAt: string },
): DatasetSnapshot {
  const next = structuredClone(base);
  for (const item of changeset.evidence) {
    const index = next.evidence.findIndex((existing) => existing.id === item.id);
    const published: typeof item = {
      ...item,
      is_simulated: true,
      verification_status: "demo_only",
      source_type: "synthetic",
      source_url: null,
      observed_at: null,
      authority_scope: "simulation_only",
      review_status: "approved",
      reviewed_at: meta.publishedAt,
      published_at: meta.publishedAt,
    };
    if (index >= 0) next.evidence[index] = published;
    else next.evidence.push(published);
  }
  for (const rule of changeset.rules) {
    const published = {
      ...rule,
      is_simulated: true,
      verification_status: "demo_only" as const,
    };
    const index = next.rules.findIndex((existing) => existing.id === published.id);
    if (index >= 0) next.rules[index] = published;
    else next.rules.push(published);
  }
  next.version = meta.version;
  next.published_at = meta.publishedAt;
  next.is_simulated = true;
  next.data_kind = "simulated";
  return next;
}
