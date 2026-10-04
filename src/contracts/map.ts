import type { DatasetSnapshot, Place, PlanResult, TravelMode } from "./types";

/** Shared map contracts; usable by customer and operator UIs without feature imports. */
export type GeoJsonFeature = {
  type: "Feature";
  id: string;
  geometry: Place["location"] | DatasetSnapshot["edges"][number]["geometry"] | DatasetSnapshot["work_zones"][number]["geometry"];
  properties: Record<string, unknown>;
};
export type DisplayStatus = "open" | "closed" | "needs_verification" | "not_allowed";
export type LayerFlag = {
  target_type: "access_node" | "access_edge";
  target_id: string;
  mode: TravelMode;
  status: DisplayStatus;
};
export type LayerData = {
  dataset_id: string;
  data_version: number;
  data_kind: "simulated" | "field";
  is_simulated: boolean;
  geometry_note: string;
  evaluated_at: string | null;
  flags: LayerFlag[] | null;
  feature_collection: { type: "FeatureCollection"; features: GeoJsonFeature[] };
};
export type MapSelection = { featureId: string; type: string; id: string; label: string };
export type MapRoute = Pick<PlanResult, "data_version" | "legs">;
