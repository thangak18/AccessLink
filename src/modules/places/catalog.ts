import type { DatasetSnapshot, Place } from "../../contracts/types";
import { DomainError } from "../../domain/errors";
import type { DatasetRepository } from "../../infrastructure/db/repository";
import { layerFlags, parkingAccepts, type LayerFlag } from "../evidence/layer-status";

export type GeoJsonFeature = {
  type: "Feature";
  id: string;
  geometry: Place["location"] | DatasetSnapshot["edges"][number]["geometry"] | DatasetSnapshot["work_zones"][number]["geometry"];
  properties: Record<string, unknown>;
};

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function matchesQuery(place: Place, query: string | null): boolean {
  if (!query || !query.trim()) return true;
  const needle = fold(query);
  const fields = [place.name, ...place.aliases].map(fold);
  if (fields.some((value) => value === needle)) return true;
  if (needle.length >= 3 && fields.some((value) => value.includes(needle))) return true;
  return fields.some((value) => value.split(/\s+/).includes(needle));
}

function parseInstant(value: string): Date {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new DomainError("INVALID_TIME", "Thời điểm cần có múi giờ, ví dụ 2026-10-01T17:00:00+07:00.", 400);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError("INVALID_TIME", "Thời điểm không hợp lệ.", 400);
  }
  return date;
}

function bboxOf(geometry: GeoJsonFeature["geometry"]): [number, number, number, number] | null {
  const coords: number[][] = [];
  if (geometry.type === "Point") coords.push(geometry.coordinates);
  else if (geometry.type === "LineString") coords.push(...geometry.coordinates);
  else coords.push(...geometry.coordinates[0]);
  if (coords.length === 0) return null;
  const lons = coords.map((pair) => pair[0]);
  const lats = coords.map((pair) => pair[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function intersects(
  left: [number, number, number, number],
  right: [number, number, number, number],
): boolean {
  return left[0] <= right[2] && left[2] >= right[0] && left[1] <= right[3] && left[3] >= right[1];
}

export function parseBbox(value: string): [number, number, number, number] {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new DomainError("INVALID_BBOX", "bbox dạng minLon,minLat,maxLon,maxLat.", 400);
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon >= maxLon || minLat >= maxLat) {
    throw new DomainError("INVALID_BBOX", "bbox cần min nhỏ hơn max.", 400);
  }
  return [minLon, minLat, maxLon, maxLat];
}

export function featureCollection(snapshot: DatasetSnapshot): GeoJsonFeature[] {
  const features: GeoJsonFeature[] = [];
  for (const zone of snapshot.work_zones) {
    features.push({
      type: "Feature",
      id: `zone/${zone.id}`,
      geometry: zone.geometry,
      properties: { feature_type: "work_zone", id: zone.id, name: zone.name, is_simulated: true },
    });
  }
  for (const place of snapshot.places) {
    features.push({
      type: "Feature",
      id: `place/${place.id}`,
      geometry: place.location,
      properties: {
        feature_type: "place",
        id: place.id,
        name: place.name,
        entrance_node_id: place.entrance_node_id,
        is_simulated: true,
      },
    });
  }
  for (const node of snapshot.nodes) {
    features.push({
      type: "Feature",
      id: `node/${node.id}`,
      geometry: node.geometry,
      properties: {
        feature_type: "access_node",
        id: node.id,
        node_type: node.type,
        label: node.label,
        place_id: node.place_id,
        is_simulated: true,
      },
    });
  }
  for (const edge of snapshot.edges) {
    features.push({
      type: "Feature",
      id: `edge/${edge.id}`,
      geometry: edge.geometry,
      properties: {
        feature_type: "access_edge",
        id: edge.id,
        from_node: edge.from_node,
        to_node: edge.to_node,
        length_m: edge.length_m,
        length_source: "fixture_table",
        allowed_modes: edge.allowed_modes,
        direction: edge.direction,
        is_simulated: true,
      },
    });
  }
  return features;
}

export class PlaceCatalog {
  constructor(private readonly repo: DatasetRepository) {}

  async list(datasetId: string, query: string | null, version: number | null) {
    const snapshot = await this.snapshot(datasetId, version);
    const places = snapshot.places.filter((place) => matchesQuery(place, query));
    return {
      dataset_id: snapshot.dataset_id,
      data_version: snapshot.version,
      data_kind: snapshot.data_kind,
      is_simulated: snapshot.is_simulated,
      places: places.map((place) => this.detail(snapshot, place)),
    };
  }

  async get(datasetId: string, placeId: string, version: number | null) {
    const snapshot = await this.snapshot(datasetId, version);
    const place = snapshot.places.find((item) => item.id === placeId);
    if (!place) throw new DomainError("PLACE_NOT_FOUND", `Không có địa điểm ${placeId} trong cụm.`, 404);
    return {
      dataset_id: snapshot.dataset_id,
      data_version: snapshot.version,
      data_kind: snapshot.data_kind,
      is_simulated: snapshot.is_simulated,
      place: this.detail(snapshot, place),
    };
  }

  async layer(datasetId: string, version: number | null, bbox: string | null, at: string | null) {
    const snapshot = await this.snapshot(datasetId, version);
    let features = featureCollection(snapshot);
    if (bbox) {
      const box = parseBbox(bbox);
      features = features.filter((feature) => {
        const bounds = bboxOf(feature.geometry);
        return bounds ? intersects(bounds, box) : false;
      });
    }
    const evaluatedAt = at ? parseInstant(at) : null;
    const flags: LayerFlag[] | null = evaluatedAt ? layerFlags(snapshot, evaluatedAt) : null;
    const transfer = evaluatedAt
      ? snapshot.transfer_rules.map((rule) => ({
          node_id: rule.node_id,
          from_mode: rule.from_mode,
          to_mode: rule.to_mode,
          accepting: parkingAccepts(snapshot, rule.node_id, evaluatedAt),
        }))
      : null;
    return {
      dataset_id: snapshot.dataset_id,
      data_version: snapshot.version,
      data_kind: snapshot.data_kind,
      is_simulated: snapshot.is_simulated,
      geometry_note: snapshot.geometry_note,
      evaluated_at: at,
      transfer,
      flags,
      feature_collection: { type: "FeatureCollection" as const, features },
    };
  }

  async version(datasetId: string) {
    const current = await this.repo.currentVersion(datasetId);
    if (current === null) throw new DomainError("DATASET_NOT_FOUND", `Không có dataset ${datasetId}.`, 404);
    const snapshot = await this.snapshot(datasetId, current);
    return {
      dataset_id: snapshot.dataset_id,
      name: snapshot.name,
      current_version: snapshot.version,
      published_at: snapshot.published_at,
      data_kind: snapshot.data_kind,
      is_simulated: snapshot.is_simulated,
      environment: snapshot.environment,
    };
  }

  private detail(snapshot: DatasetSnapshot, place: Place) {
    const operation = snapshot.operations.find((item) => item.place_id === place.id) ?? null;
    return { ...place, operation };
  }

  private async snapshot(datasetId: string, version: number | null): Promise<DatasetSnapshot> {
    if (!datasetId) throw new DomainError("VALIDATION", "Thiếu dataset_id.", 400);
    if (!(await this.repo.hasDataset(datasetId))) {
      throw new DomainError("DATASET_NOT_FOUND", `Không có dataset ${datasetId}.`, 404);
    }
    const resolved = version ?? (await this.repo.currentVersion(datasetId));
    if (resolved === null) throw new DomainError("VERSION_NOT_FOUND", "Dataset chưa có version.", 404);
    const snapshot = await this.repo.getSnapshot(datasetId, resolved);
    if (!snapshot) throw new DomainError("VERSION_NOT_FOUND", `Không có version ${resolved}.`, 404);
    return snapshot;
  }
}
