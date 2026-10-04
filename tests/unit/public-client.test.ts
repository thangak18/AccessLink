import { describe, expect, it, vi, afterEach } from "vitest";
import { fixtureView, scenarioTime } from "@/features/access-explorer/fixtures";
import { assertSameVersion, loadLiveView } from "@/features/access-explorer/api";
const query = {
  dataset_id: "demo-a",
  place_id: "place_a",
  origin_node_id: "O",
  mode: "motorcycle" as const,
  purpose: "customer" as const,
  depart_at: scenarioTime("S0"),
};
afterEach(() => vi.unstubAllGlobals());
describe("public integration boundaries", () => {
  it("never invents a fixture route for unsupported time, origin or mode", () => {
    expect(
      fixtureView("S0", { ...query, depart_at: scenarioTime("S1") }).plan,
    ).toBeNull();
    expect(
      fixtureView("S0", { ...query, origin_node_id: "P" }).plan,
    ).toBeNull();
    expect(fixtureView("S0", { ...query, mode: "walk" }).plan).toBeNull();
  });
  it("rejects mixing old route and new map versions", () => {
    const before = fixtureView("S0", query),
      after = fixtureView("S1", { ...query, depart_at: scenarioTime("S1") });
    expect(() => assertSameVersion(after.layer, before.plan, 2, 2)).toThrow(
      "ẩn tuyến cũ",
    );
    expect(() =>
      assertSameVersion(after.layer, after.plan, 2, 2),
    ).not.toThrow();
  });
  it("does not substitute canned routes when live planner is missing", async () => {
    const sample = fixtureView("S0", query);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              url.endsWith("/version")
                ? { current_version: 1 }
                : url.includes("access-layer")
                  ? sample.layer
                  : url.includes("/places?")
                    ? { data_version: 1, places: sample.places }
                    : { error: { code: "NOT_FOUND", message: "missing" } },
            ),
            { status: url.endsWith("/access-plans") ? 404 : 200 },
          ),
      ),
    );
    const actual = await loadLiveView(query, new AbortController().signal);
    expect(actual.plan).toBeNull();
    expect(actual.planError).toContain("Kiên");
  });
});
