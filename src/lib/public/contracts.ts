import type {
  PlanResult,
  Place,
  PlaceOperation,
  Evidence,
} from "../../contracts/types";
import type { GeoJsonFeature } from "../../modules/places/catalog";
import type { LayerFlag } from "../../modules/evidence/layer-status";

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
export type PublicPlace = Place & { operation: PlaceOperation | null };
/** Kiên can supply these optional display fields without changing Tu's base contract. */
export type PublicPlan = PlanResult & {
  evidence?: Evidence[];
  evaluated_at?: string;
  next_recompute_at?: string | null;
  destination_node_id?: string;
};
export type PublicQuery = {
  dataset_id: string;
  place_id: string;
  origin_node_id: string;
  mode: "motorcycle" | "walk";
  purpose: "customer";
  depart_at: string;
};
export type PublicView = {
  layer: LayerData;
  places: PublicPlace[];
  plan: PublicPlan | null;
  planError?: string;
  evidence: Evidence[];
};
export type MapSelection = {
  featureId: string;
  type: string;
  id: string;
  label: string;
};
