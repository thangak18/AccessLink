import { randomUUID } from "node:crypto";
import type {
  AccessPlanner,
  AuditEntry,
  ChangeSet,
  DatasetSnapshot,
  PlanQuery,
  PlanResult,
  Report,
} from "@/contracts/types";
import { DomainError } from "@/domain/errors";
import type { DatasetRepository } from "@/infrastructure/db/repository";
import { applyChangeset } from "@/modules/review-publication/apply";
import {
  createChangesetBody,
  parseBody,
  patchChangesetBody,
  previewBody,
  reportBody,
  sealEvidence,
  sealRule,
} from "@/modules/review-publication/schema";
import { validateDraft } from "@/modules/review-publication/validate-draft";

export type Actor = { id: string; role: "operator" | "reviewer" };

export type PublicationServiceOptions = {
  repo: DatasetRepository;
  planner: AccessPlanner | null;
  clock: () => string;
  seed: () => DatasetSnapshot;
};

function requireStaff(actor: Actor): void {
  if (actor.role !== "operator" && actor.role !== "reviewer") {
    throw new DomainError("FORBIDDEN", "Cần quyền người vận hành.", 403);
  }
}

function requireReviewer(actor: Actor): void {
  if (actor.role !== "reviewer") {
    throw new DomainError("FORBIDDEN", "Chỉ người duyệt mới được công bố.", 403);
  }
}

export function routeChanged(before: PlanResult, after: PlanResult): boolean {
  const signature = (plan: PlanResult) =>
    JSON.stringify({
      route_status: plan.route_status,
      walk_length_m: plan.walk_length_m,
      legs: plan.legs.map((leg) => `${leg.edge_id}:${leg.mode}:${leg.from_node_id}->${leg.to_node_id}`),
    });
  return signature(before) !== signature(after);
}

export class PublicationService {
  constructor(private readonly options: PublicationServiceOptions) {}

  setPlanner(planner: AccessPlanner | null): void {
    this.options.planner = planner;
  }

  async createChangeset(body: unknown, actor: Actor): Promise<ChangeSet> {
    requireStaff(actor);
    const input = parseBody(createChangesetBody, body);
    const createdAt = this.options.clock();
    const rules = input.rules.map(sealRule);
    const evidence = input.evidence.map((item) => sealEvidence(item, createdAt));
    const base = await this.snapshot(input.dataset_id, input.base_version);
    validateDraft(base, rules, evidence);
    const changeset: ChangeSet = {
      id: input.id ?? `cs_${randomUUID()}`,
      dataset_id: input.dataset_id,
      base_version: input.base_version,
      status: "draft",
      rules,
      evidence,
      note: input.note,
      created_by: actor.id,
      created_at: createdAt,
      published_version: null,
      reviewer_id: null,
      published_at: null,
    };
    await this.options.repo.insertChangeset(changeset);
    return changeset;
  }

  async patchChangeset(id: string, body: unknown, actor: Actor): Promise<ChangeSet> {
    requireStaff(actor);
    const input = parseBody(patchChangesetBody, body);
    const current = await this.requireChangeset(id);
    if (current.status !== "draft") {
      throw new DomainError("CHANGESET_PUBLISHED", "Bản đã công bố không sửa được.", 409);
    }
    const createdAt = this.options.clock();
    const next: ChangeSet = {
      ...current,
      base_version: input.base_version ?? current.base_version,
      note: input.note ?? current.note,
      rules: input.rules ? input.rules.map(sealRule) : current.rules,
      evidence: input.evidence ? input.evidence.map((item) => sealEvidence(item, createdAt)) : current.evidence,
    };
    const base = await this.snapshot(next.dataset_id, next.base_version);
    validateDraft(base, next.rules, next.evidence);
    await this.options.repo.saveChangeset(next);
    return next;
  }

  async preview(id: string, body: unknown, actor: Actor) {
    requireStaff(actor);
    const planner = this.options.planner;
    if (!planner) {
      throw new DomainError(
        "PLANNER_UNAVAILABLE",
        "Preview cần engine planAccess của Kiên. Bản nháp chưa đổi dữ liệu công bố.",
        503,
      );
    }
    const input = parseBody(previewBody, body);
    const changeset = await this.requireChangeset(id);
    const base = await this.snapshot(changeset.dataset_id, changeset.base_version);
    const candidate = applyChangeset(base, changeset, {
      version: base.version + 1,
      publishedAt: this.options.clock(),
    });
    const placeIds = input.place_ids ?? ["place_a", "place_b", "place_c"];
    for (const placeId of placeIds) {
      if (!base.places.some((place) => place.id === placeId)) {
        throw new DomainError("PLACE_NOT_FOUND", `Không có địa điểm ${placeId}.`, 404);
      }
    }
    if (!base.nodes.some((node) => node.id === input.origin_node_id)) {
      throw new DomainError("UNKNOWN_TARGET", `Không có điểm xuất phát ${input.origin_node_id}.`, 400);
    }
    const queries = [];
    for (const placeId of placeIds) {
      const query: PlanQuery = {
        dataset_id: base.dataset_id,
        origin_node_id: input.origin_node_id,
        place_id: placeId,
        mode: input.mode,
        purpose: "customer",
        depart_at: input.depart_at,
      };
      const before = await planner.plan(base, query);
      const after = await planner.plan(candidate, query);
      queries.push({
        place_id: placeId,
        mode: input.mode,
        depart_at: input.depart_at,
        origin_node_id: input.origin_node_id,
        before,
        after,
        changed: routeChanged(before, after),
      });
    }
    const stillCurrent = await this.options.repo.currentVersion(base.dataset_id);
    return {
      dataset_id: base.dataset_id,
      base_version: base.version,
      candidate_version: candidate.version,
      current_version: stillCurrent,
      persisted: false,
      data_kind: "simulated" as const,
      is_simulated: true,
      note: "So sánh đúng các truy vấn được gửi, cùng điểm đi, phương tiện và giờ. Không suy ra mọi thời điểm.",
      queries,
    };
  }

  async publish(id: string, actor: Actor) {
    requireReviewer(actor);
    const existing = await this.requireChangeset(id);
    return this.options.repo.withDatasetLock(existing.dataset_id, async (lock) => {
      const changeset = await lock.getChangeset(id);
      if (!changeset) throw new DomainError("CHANGESET_NOT_FOUND", `Không có ChangeSet ${id}.`, 404);
      if (changeset.status === "published") {
        return {
          dataset_id: changeset.dataset_id,
          changeset_id: changeset.id,
          version: changeset.published_version,
          idempotent: true,
          data_kind: "simulated" as const,
          is_simulated: true,
        };
      }
      if (lock.currentVersion !== changeset.base_version) {
        throw new DomainError(
          "VERSION_CONFLICT",
          "Bản nháp dựa trên version cũ. Xem lại ảnh hưởng trên bản mới trước khi công bố.",
          409,
          { current_version: lock.currentVersion, base_version: changeset.base_version },
        );
      }
      const base = await lock.getSnapshot(lock.currentVersion);
      if (!base) throw new DomainError("VERSION_NOT_FOUND", "Thiếu snapshot nền.", 404);
      validateDraft(base, changeset.rules, changeset.evidence);
      const publishedAt = this.options.clock();
      const next = applyChangeset(base, changeset, {
        version: lock.currentVersion + 1,
        publishedAt,
      });
      const published: ChangeSet = {
        ...changeset,
        status: "published",
        published_version: next.version,
        reviewer_id: actor.id,
        published_at: publishedAt,
      };
      const audit: AuditEntry = {
        id: `audit_${randomUUID()}`,
        dataset_id: next.dataset_id,
        actor_id: actor.id,
        action: "publish",
        changeset_id: changeset.id,
        before_version: base.version,
        after_version: next.version,
        at: publishedAt,
      };
      await lock.commitPublication(next, published, audit);
      return {
        dataset_id: next.dataset_id,
        changeset_id: changeset.id,
        version: next.version,
        idempotent: false,
        data_kind: next.data_kind,
        is_simulated: next.is_simulated,
      };
    });
  }

  async createReport(body: unknown): Promise<Report & { conflicts: Array<{ rule_id: string; target_id: string; valid_from: string; valid_to: string | null }> }> {
    const input = parseBody(reportBody, body);
    const version = await this.options.repo.currentVersion(input.dataset_id);
    if (version === null) throw new DomainError("DATASET_NOT_FOUND", `Không có dataset ${input.dataset_id}.`, 404);
    const snapshot = await this.snapshot(input.dataset_id, version);
    const known = new Set(snapshot.nodes.map((node) => node.id));
    for (const nodeId of input.related_node_ids) {
      if (!known.has(nodeId)) {
        throw new DomainError("UNKNOWN_TARGET", `Không có node ${nodeId}.`, 400, { target_id: nodeId });
      }
    }
    const report: Report = {
      id: `report_${randomUUID()}`,
      dataset_id: input.dataset_id,
      data_version: version,
      message: input.message,
      related_node_ids: input.related_node_ids,
      status: "pending_review",
      created_at: this.options.clock(),
    };
    await this.options.repo.insertReport(report);
    const conflicts = snapshot.rules
      .filter((rule) => rule.effect === "closed" && input.related_node_ids.includes(rule.target_id))
      .map((rule) => ({
        rule_id: rule.id,
        target_id: rule.target_id,
        valid_from: rule.valid_from,
        valid_to: rule.valid_to,
      }));
    return { ...report, conflicts };
  }

  async listReports(datasetId: string, actor: Actor): Promise<Report[]> {
    requireStaff(actor);
    if (!(await this.options.repo.hasDataset(datasetId))) {
      throw new DomainError("DATASET_NOT_FOUND", `Không có dataset ${datasetId}.`, 404);
    }
    return this.options.repo.listReports(datasetId);
  }

  async reset(datasetId: string, confirm: string, actor: Actor): Promise<{ dataset_id: string; version: number }> {
    requireReviewer(actor);
    if (datasetId !== "demo-a") {
      throw new DomainError("FORBIDDEN", "Chỉ môi trường demo mới có lệnh reset.", 403);
    }
    if (confirm !== "reset-demo-a") {
      throw new DomainError("CONFIRMATION_REQUIRED", "Gửi confirm đúng reset-demo-a.", 400);
    }
    const seed = this.options.seed();
    await this.options.repo.reset(seed);
    return { dataset_id: datasetId, version: seed.version };
  }

  private async snapshot(datasetId: string, version: number): Promise<DatasetSnapshot> {
    if (!(await this.options.repo.hasDataset(datasetId))) {
      throw new DomainError("DATASET_NOT_FOUND", `Không có dataset ${datasetId}.`, 404);
    }
    const snapshot = await this.options.repo.getSnapshot(datasetId, version);
    if (!snapshot) throw new DomainError("VERSION_NOT_FOUND", `Không có version ${version}.`, 404);
    return snapshot;
  }

  private async requireChangeset(id: string): Promise<ChangeSet> {
    const changeset = await this.options.repo.getChangeset(id);
    if (!changeset) throw new DomainError("CHANGESET_NOT_FOUND", `Không có ChangeSet ${id}.`, 404);
    return changeset;
  }
}
