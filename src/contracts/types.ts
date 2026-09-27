/** Hình học trao đổi GeoJSON, thứ tự [longitude, latitude], WGS84. */

export type TravelMode = "motorcycle" | "walk" | "car";
export type CustomerPurpose = "customer" | "delivery";
export type Direction = "forward" | "reverse" | "both";
export type RuleEffect = "closed" | "allowed";
export type RouteStatus = "available" | "needs_verification" | "no_plan_found";
export type DataKind = "simulated" | "field";
export type VerificationStatus = "demo_only" | "needs_verification" | "verified";
export type ReviewStatus = "pending" | "approved" | "needs_review";
export type PlaceStatus = "open" | "closed" | "unconfirmed";
export type NodeType = "origin" | "parking" | "entrance" | "junction" | "gate";
export type DatasetEnvironment = "demo" | "field";

export type LngLat = [number, number];

export type PointGeometry = { type: "Point"; coordinates: LngLat };
export type LineGeometry = { type: "LineString"; coordinates: LngLat[] };
export type PolygonGeometry = { type: "Polygon"; coordinates: LngLat[][] };

/** Khoảng giờ địa phương Asia/Ho_Chi_Minh, gồm đầu, không gồm cuối. */
export type TimeWindow = { start: string; end: string };

export type Place = {
  id: string;
  name: string;
  aliases: string[];
  location: PointGeometry;
  operator_id: string | null;
  entrance_node_id: string;
};

export type PlaceOperation = {
  place_id: string;
  status: PlaceStatus;
  opening_windows: TimeWindow[];
  evidence_ids: string[];
  review_due_at: string | null;
};

export type AccessNode = {
  id: string;
  place_id: string | null;
  type: NodeType;
  geometry: PointGeometry;
  label: string;
  evidence_ids: string[];
};

export type AccessEdge = {
  id: string;
  from_node: string;
  to_node: string;
  geometry: LineGeometry;
  length_m: number;
  allowed_modes: TravelMode[];
  direction: Direction;
  evidence_ids: string[];
};

export type WorkZone = {
  id: string;
  name: string;
  geometry: PolygonGeometry;
  source_ids: string[];
};

export type AccessRule = {
  id: string;
  target_type: "access_node" | "access_edge";
  target_id: string;
  mode: TravelMode[];
  purpose: CustomerPurpose[];
  direction: Direction;
  effect: RuleEffect;
  valid_from: string;
  valid_to: string | null;
  time_windows: TimeWindow[];
  evidence_ids: string[];
  version: number;
  is_simulated: boolean;
  verification_status: VerificationStatus;
};

export type Evidence = {
  id: string;
  type: "survey" | "notice" | "report" | "observation";
  source_type: "synthetic" | "field";
  source_url: string | null;
  is_simulated: boolean;
  verification_status: VerificationStatus;
  review_status: ReviewStatus;
  created_at: string;
  observed_at: string | null;
  published_at: string | null;
  reviewed_at: string | null;
  review_due_at: string | null;
  authority_scope: string;
  rights: string;
  content: string;
};

export type TransferRule = {
  id: string;
  node_id: string;
  from_mode: TravelMode;
  to_mode: TravelMode;
  windows: TimeWindow[];
  transfer_seconds: number;
  evidence_ids: string[];
};

/**
 * Ảnh dữ liệu đã công bố. Bản ghi bất biến theo `version`.
 * Chiều dài dùng cho kiểm thử là `length_m`. Tọa độ chỉ là sơ đồ.
 */
export type DatasetSnapshot = {
  dataset_id: string;
  name: string;
  environment: DatasetEnvironment;
  version: number;
  data_kind: DataKind;
  is_simulated: boolean;
  timezone: "Asia/Ho_Chi_Minh";
  geometry_note: string;
  published_at: string;
  places: Place[];
  operations: PlaceOperation[];
  nodes: AccessNode[];
  edges: AccessEdge[];
  work_zones: WorkZone[];
  rules: AccessRule[];
  evidence: Evidence[];
  transfer_rules: TransferRule[];
};

export type ChangeSetStatus = "draft" | "published";

export type ChangeSet = {
  id: string;
  dataset_id: string;
  base_version: number;
  status: ChangeSetStatus;
  rules: AccessRule[];
  evidence: Evidence[];
  note: string;
  created_by: string;
  created_at: string;
  published_version: number | null;
  reviewer_id: string | null;
  published_at: string | null;
};

export type Report = {
  id: string;
  dataset_id: string;
  data_version: number;
  message: string;
  related_node_ids: string[];
  status: "pending_review";
  created_at: string;
};

export type AuditEntry = {
  id: string;
  dataset_id: string;
  actor_id: string;
  action: string;
  changeset_id: string | null;
  before_version: number | null;
  after_version: number | null;
  at: string;
};

/**
 * Hợp đồng nháp để Kiên chốt `planAccess`.
 * Preview chỉ so sánh kết quả engine trả về, không tự tìm đường.
 */
export type PlanQuery = {
  dataset_id: string;
  origin_node_id: string;
  place_id: string;
  mode: "motorcycle" | "walk";
  purpose: "customer";
  depart_at: string;
};

export type PlanLeg = {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  mode: "motorcycle" | "walk";
  length_m: number;
};

export type PlanResult = {
  route_status: RouteStatus;
  data_kind: DataKind;
  data_version: number;
  place_id: string;
  mode: "motorcycle" | "walk";
  legs: PlanLeg[];
  walk_length_m: number | null;
  limitations: string[];
};

export interface AccessPlanner {
  plan(snapshot: DatasetSnapshot, query: PlanQuery): Promise<PlanResult>;
}
