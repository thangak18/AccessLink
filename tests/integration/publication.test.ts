import { describe, expect, it } from "vitest";
import { buildSnapshotS0 } from "@/demo/demo-a/model";
import { expectedPlans } from "@/demo/demo-a/expected";
import { noticeS1, ruleS1 } from "@/demo/demo-a/notices";
import type { AccessPlanner, DatasetSnapshot, PlanQuery, PlanResult } from "@/contracts/types";
import { createDemoApp } from "@/server/http/demo-api";

const auth = { operatorToken: "op-token", reviewerToken: "rev-token" };
const clock = () => "2026-10-01T11:00:00.000Z";

function plannerStub(): AccessPlanner {
  return {
    async plan(snapshot: DatasetSnapshot, query: PlanQuery): Promise<PlanResult> {
      const hasG2 = snapshot.rules.some((rule) => rule.id === "rule_s1_g2_closed");
      const hasG3 = snapshot.rules.some((rule) => rule.id === "rule_s2_g3_closed");
      const stale = snapshot.evidence.some((item) => item.id === "evidence_g2_open" && item.review_status === "needs_review");
      const scenario = hasG2 && hasG3 ? "S2" : hasG2 ? "S1" : query.depart_at.includes("T20:05") ? "S3" : stale ? "S4" : "S0";
      const expected = expectedPlans().find(
        (plan) => plan.scenario_id === scenario && plan.place_id === query.place_id && plan.mode === query.mode,
      );
      if (!expected) throw new Error(`Thiếu đáp án ${scenario} ${query.place_id}`);
      return {
        route_status: expected.route_status,
        data_kind: "simulated",
        data_version: snapshot.version,
        place_id: query.place_id,
        mode: query.mode,
        walk_length_m: expected.walk_length_m,
        limitations: expected.reason_codes,
        legs: expected.legs.map((leg) => {
          const edge = snapshot.edges.find((item) => item.id === leg.edge_id);
          if (!edge) throw new Error(leg.edge_id);
          return {
            edge_id: edge.id,
            from_node_id: edge.from_node,
            to_node_id: edge.to_node,
            mode: leg.mode,
            length_m: edge.length_m,
          };
        }),
      };
    },
  };
}

function app(planner: AccessPlanner | null = null) {
  return createDemoApp({ auth, clock, planner, seed: buildSnapshotS0 });
}

function call(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, init);
}

const operator = { authorization: "Bearer op-token", "content-type": "application/json" };
const reviewer = { authorization: "Bearer rev-token", "content-type": "application/json" };

async function bodyOf(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("công bố và quyền", () => {
  it("tìm địa điểm, tên lạ trả rỗng, lớp bản đồ theo version", async () => {
    const demo = app();
    const empty = await bodyOf(await demo.dispatch(call("/api/v1/places?dataset_id=demo-a&q=zzz")));
    expect(empty.places).toEqual([]);
    const found = await bodyOf(await demo.dispatch(call("/api/v1/places?dataset_id=demo-a&q=Cua%20hang%20B")));
    expect(found.places.map((place: { id: string }) => place.id)).toEqual(["place_b"]);
    const alias = await bodyOf(await demo.dispatch(call("/api/v1/places?dataset_id=demo-a&q=A")));
    expect(alias.places.map((place: { id: string }) => place.id)).toEqual(["place_a"]);
    const layer = await bodyOf(await demo.dispatch(call("/api/v1/access-layer?dataset_id=demo-a&version=1")));
    expect(layer.feature_collection.features).toHaveLength(23);
    expect(layer.is_simulated).toBe(true);
    const ocean = await bodyOf(await demo.dispatch(call("/api/v1/access-layer?dataset_id=demo-a&bbox=0,0,1,1")));
    expect(ocean.feature_collection.features).toEqual([]);
    const missing = await demo.dispatch(call("/api/v1/places/place_z?dataset_id=demo-a"));
    expect(missing.status).toBe(404);
  });

  it("nháp không đổi layer, ID lạ không lọt, nhãn mô phỏng bị ghi đè", async () => {
    const demo = app();
    const created = await bodyOf(
      await demo.dispatch(
        call("/api/v1/admin/changesets", {
          method: "POST",
          headers: operator,
          body: JSON.stringify({
            id: "cs_s1",
            dataset_id: "demo-a",
            base_version: 1,
            rules: [{ ...ruleS1(), is_simulated: false, verification_status: "verified" }],
            evidence: [{ ...noticeS1(), authority_scope: "Sở Giao thông", observed_at: "2026-10-01T10:00:00+07:00" }],
          }),
        }),
      ),
    );
    expect(created.status).toBe("draft");
    expect(created.rules[0].is_simulated).toBe(true);
    expect(created.rules[0].verification_status).toBe("demo_only");
    expect(created.evidence[0].authority_scope).toBe("simulation_only");
    expect(created.evidence[0].observed_at).toBeNull();
    const version = await bodyOf(await demo.dispatch(call("/api/v1/datasets/demo-a/version")));
    expect(version.current_version).toBe(1);
    const bad = await demo.dispatch(
      call("/api/v1/admin/changesets", {
        method: "POST",
        headers: operator,
        body: JSON.stringify({
          dataset_id: "demo-a",
          base_version: 1,
          rules: [{ ...ruleS1(), id: "rule_bad", target_id: "NOPE" }],
          evidence: [noticeS1()],
        }),
      }),
    );
    expect(bad.status).toBe(400);
    expect((await bodyOf(bad)).error.code).toBe("UNKNOWN_TARGET");
    expect((await demo.repo.currentVersion("demo-a"))).toBe(1);
  });

  it("publish một lần, gọi lại không tạo version mới, operator không được duyệt", async () => {
    const demo = app(plannerStub());
    await demo.dispatch(
      call("/api/v1/admin/changesets", {
        method: "POST",
        headers: operator,
        body: JSON.stringify({
          id: "cs_s1",
          dataset_id: "demo-a",
          base_version: 1,
          rules: [ruleS1()],
          evidence: [noticeS1()],
        }),
      }),
    );
    const denied = await demo.dispatch(call("/api/v1/admin/changesets/cs_s1/publish", { method: "POST", headers: operator }));
    expect(denied.status).toBe(403);
    const anon = await demo.dispatch(call("/api/v1/admin/changesets/cs_s1/publish", { method: "POST" }));
    expect(anon.status).toBe(401);
    const preview = await bodyOf(
      await demo.dispatch(
        call("/api/v1/admin/changesets/cs_s1/preview", {
          method: "POST",
          headers: reviewer,
          body: JSON.stringify({ depart_at: "2026-10-01T18:05:00+07:00" }),
        }),
      ),
    );
    expect(preview.current_version).toBe(1);
    expect(preview.persisted).toBe(false);
    const byPlace = Object.fromEntries(preview.queries.map((item: { place_id: string; changed: boolean; after: { walk_length_m: number } }) => [item.place_id, item]));
    expect(byPlace.place_a.changed).toBe(true);
    expect(byPlace.place_a.after.walk_length_m).toBe(200);
    expect(byPlace.place_b.changed).toBe(true);
    expect(byPlace.place_b.after.walk_length_m).toBe(215);
    expect(byPlace.place_c.changed).toBe(false);
    expect(byPlace.place_c.after.walk_length_m).toBe(0);
    const first = await bodyOf(await demo.dispatch(call("/api/v1/admin/changesets/cs_s1/publish", { method: "POST", headers: reviewer })));
    const second = await bodyOf(await demo.dispatch(call("/api/v1/admin/changesets/cs_s1/publish", { method: "POST", headers: reviewer })));
    expect(first).toMatchObject({ version: 2, idempotent: false, is_simulated: true });
    expect(second).toMatchObject({ version: 2, idempotent: true });
    const live = await demo.repo.getSnapshot("demo-a", 2);
    expect(live?.rules.map((rule) => rule.id)).toContain("rule_s1_g2_closed");
    expect(live?.is_simulated).toBe(true);
  });

  it("hai người publish cùng version thì một người bị conflict, phản ánh không mở G2", async () => {
    const demo = app();
    const draft = (id: string, ruleId: string, target: string) =>
      demo.dispatch(
        call("/api/v1/admin/changesets", {
          method: "POST",
          headers: operator,
          body: JSON.stringify({
            id,
            dataset_id: "demo-a",
            base_version: 1,
            rules: [{ ...ruleS1(), id: ruleId, target_id: target, evidence_ids: [`evidence_${id}`] }],
            evidence: [{ ...noticeS1(), id: `evidence_${id}` }],
          }),
        }),
      );
    expect((await draft("cs_a", "rule_a", "G2")).status).toBe(200);
    expect((await draft("cs_b", "rule_b", "G3")).status).toBe(200);
    const [left, right] = await Promise.all([
      demo.dispatch(call("/api/v1/admin/changesets/cs_a/publish", { method: "POST", headers: reviewer })),
      demo.dispatch(call("/api/v1/admin/changesets/cs_b/publish", { method: "POST", headers: reviewer })),
    ]);
    expect([left.status, right.status].sort()).toEqual([200, 409]);
    expect(await demo.repo.currentVersion("demo-a")).toBe(2);
    const loser = left.status === 409 ? "cs_a" : "cs_b";
    const patched = await demo.dispatch(
      call(`/api/v1/admin/changesets/${loser}`, {
        method: "PATCH",
        headers: operator,
        body: JSON.stringify({ base_version: 2 }),
      }),
    );
    expect(patched.status).toBe(200);
    const republish = await bodyOf(
      await demo.dispatch(call(`/api/v1/admin/changesets/${loser}/publish`, { method: "POST", headers: reviewer })),
    );
    expect(republish.version).toBe(3);

    const report = await bodyOf(
      await demo.dispatch(
        call("/api/v1/reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dataset_id: "demo-a",
            message: "G2 đã mở lại",
            related_node_ids: ["G2"],
          }),
        }),
      ),
    );
    expect(report.status).toBe("pending_review");
    expect(report.conflicts.some((item: { rule_id: string }) => item.rule_id === "rule_a" || item.rule_id === "rule_s0_g1_closed")).toBe(
      true,
    );
    const rules = (await demo.repo.getSnapshot("demo-a", 3))?.rules.map((rule) => rule.id) ?? [];
    expect(rules).not.toContain("rule_from_report");
    const listed = await bodyOf(await demo.dispatch(call("/api/v1/admin/reports?dataset_id=demo-a", { headers: operator })));
    expect(listed.reports).toHaveLength(1);
  });

  it("reset chỉ chạy khi người duyệt xác nhận", async () => {
    const demo = app();
    await demo.dispatch(
      call("/api/v1/admin/changesets", {
        method: "POST",
        headers: reviewer,
        body: JSON.stringify({
          id: "cs_s1",
          dataset_id: "demo-a",
          base_version: 1,
          rules: [ruleS1()],
          evidence: [noticeS1()],
        }),
      }),
    );
    await demo.dispatch(call("/api/v1/admin/changesets/cs_s1/publish", { method: "POST", headers: reviewer }));
    const denied = await demo.dispatch(
      call("/api/v1/admin/datasets/demo-a/reset", {
        method: "POST",
        headers: operator,
        body: JSON.stringify({ confirm: "reset-demo-a" }),
      }),
    );
    expect(denied.status).toBe(403);
    const open = await demo.dispatch(
      call("/api/v1/admin/datasets/demo-a/reset", {
        method: "POST",
        body: JSON.stringify({ confirm: "reset-demo-a" }),
      }),
    );
    expect(open.status).toBe(401);
    const reset = await bodyOf(
      await demo.dispatch(
        call("/api/v1/admin/datasets/demo-a/reset", {
          method: "POST",
          headers: reviewer,
          body: JSON.stringify({ confirm: "reset-demo-a" }),
        }),
      ),
    );
    expect(reset.version).toBe(1);
    expect(await demo.repo.currentVersion("demo-a")).toBe(1);
    expect(await demo.repo.getChangeset("cs_s1")).toBeNull();
  });

  it("preview khi chưa có engine không ghi dữ liệu", async () => {
    const demo = app(null);
    await demo.dispatch(
      call("/api/v1/admin/changesets", {
        method: "POST",
        headers: operator,
        body: JSON.stringify({
          id: "cs_s1",
          dataset_id: "demo-a",
          base_version: 1,
          rules: [ruleS1()],
          evidence: [noticeS1()],
        }),
      }),
    );
    const preview = await demo.dispatch(
      call("/api/v1/admin/changesets/cs_s1/preview", {
        method: "POST",
        headers: reviewer,
        body: JSON.stringify({ depart_at: "2026-10-01T18:05:00+07:00" }),
      }),
    );
    expect(preview.status).toBe(503);
    expect(await demo.repo.currentVersion("demo-a")).toBe(1);
  });
});
