import { z } from "zod";
import type {
  LayerData,
  PublicPlace,
  PublicPlan,
  PublicQuery,
  PublicView,
} from "./contracts";

const planSchema = z
  .object({
    route_status: z.enum(["available", "needs_verification", "no_plan_found"]),
    data_kind: z.enum(["simulated", "field"]),
    data_version: z.number().int().positive(),
    place_id: z.string(),
    mode: z.enum(["motorcycle", "walk"]),
    walk_length_m: z.number().nonnegative().nullable(),
    limitations: z.array(z.string()),
    legs: z.array(
      z.object({
        edge_id: z.string(),
        from_node_id: z.string(),
        to_node_id: z.string(),
        mode: z.enum(["motorcycle", "walk"]),
        length_m: z.number().nonnegative(),
      }),
    ),
    evaluated_at: z.string().datetime({ offset: true }).optional(),
    next_recompute_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    destination_node_id: z.string().optional(),
    evidence: z
      .array(
        z
          .object({
            id: z.string(),
            content: z.string(),
            source_type: z.enum(["synthetic", "field"]),
            review_status: z.enum(["pending", "approved", "needs_review"]),
            reviewed_at: z.string().datetime({ offset: true }).nullable(),
            review_due_at: z.string().datetime({ offset: true }).nullable(),
            observed_at: z.string().datetime({ offset: true }).nullable(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export async function readJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      response.status === 404 &&
      url.endsWith("/access-plans") &&
      body?.error?.code === "NOT_FOUND"
    )
      throw new Error(
        "API tìm phương án chưa được tích hợp. Đang chờ engine của Kiên.",
      );
    throw new Error(
      body?.error?.message ?? `Không tải được dữ liệu (${response.status}).`,
    );
  }
  if (!body) throw new Error("Máy chủ trả dữ liệu không hợp lệ.");
  return body as T;
}
export function assertSameVersion(
  layer: LayerData,
  plan: PublicPlan | null,
  placesVersion: number,
  requested: number,
): void {
  if (
    layer.data_version !== requested ||
    placesVersion !== requested ||
    (plan && plan.data_version !== requested)
  ) {
    throw new Error(
      "Dữ liệu vừa thay đổi. Đã ẩn tuyến cũ; hãy tải lại để đồng bộ phiên bản.",
    );
  }
}
export async function loadLiveView(
  query: PublicQuery,
  signal: AbortSignal,
): Promise<PublicView> {
  const version = await readJson<{ current_version: number }>(
    `/api/v1/datasets/${query.dataset_id}/version`,
    { signal },
  );
  const params = new URLSearchParams({
    dataset_id: query.dataset_id,
    version: String(version.current_version),
    at: query.depart_at,
  });
  const [layer, catalog, result] = await Promise.all([
    readJson<LayerData>(`/api/v1/access-layer?${params}`, { signal }),
    readJson<{ data_version: number; places: PublicPlace[] }>(
      `/api/v1/places?${params}`,
      { signal },
    ),
    readJson<PublicPlan>("/api/v1/access-plans", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...query, data_version: version.current_version }),
    })
      .then((plan) => {
        const parsed = planSchema.safeParse(plan);
        if (!parsed.success)
          throw new Error(
            "API phương án trả dữ liệu sai định dạng. Đã ẩn tuyến.",
          );
        return {
          plan: parsed.data as PublicPlan,
          error: undefined as string | undefined,
        };
      })
      .catch((error) => {
        if (signal.aborted) throw error;
        return {
          plan: null,
          error:
            error instanceof Error
              ? error.message
              : "Không tải được phương án.",
        };
      }),
  ]);
  assertSameVersion(
    layer,
    result.plan,
    catalog.data_version,
    version.current_version,
  );
  if (
    result.plan &&
    (result.plan.place_id !== query.place_id || result.plan.mode !== query.mode)
  )
    throw new Error("Phương án không khớp lựa chọn. Đã ẩn kết quả.");
  if (result.plan) {
    if (
      result.plan.evaluated_at &&
      Date.parse(result.plan.evaluated_at) !== Date.parse(query.depart_at)
    )
      throw new Error("Phương án không khớp giờ xuất phát. Đã ẩn kết quả.");
    for (const leg of result.plan.legs) {
      const edge = layer.feature_collection.features.find(
        (f) => f.id === `edge/${leg.edge_id}`,
      );
      if (!edge || edge.geometry.type !== "LineString")
        throw new Error(
          "Thiếu hình học chặng đường trong phiên bản bản đồ. Đã ẩn tuyến.",
        );
    }
  }
  return {
    layer,
    places: catalog.places,
    plan: result.plan,
    planError: result.error,
    evidence: result.plan?.evidence ?? [],
  };
}
export async function sendReport(message: string, nodeIds: string[]) {
  return readJson<{ id: string; status: string }>("/api/v1/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dataset_id: "demo-a",
      message,
      related_node_ids: nodeIds,
    }),
  });
}
