"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type {
  LayerData,
  MapSelection,
  MapRoute,
} from "@/contracts/map";

export type AccessMapProps = {
  layer: LayerData;
  plan: MapRoute | null;
  mode: "motorcycle" | "walk";
  selectedIds: string[];
  onSelect: (selection: MapSelection) => void;
};
/** Shared presentation component; no fetching, publication or admin policy. */
export default function AccessMap({
  layer,
  plan,
  mode,
  selectedIds,
  onSelect,
}: AccessMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const select = useRef(onSelect);
  const [base, setBase] = useState(false);
  const [tileError, setTileError] = useState(false);
  select.current = onSelect;
  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 14,
      maxZoom: 21,
      zoomSnap: 0.25,
    }).fitBounds(
      [
        [10.7752, 106.6942],
        [10.7774, 106.6974],
      ],
      { paddingTopLeft: [28, 72], paddingBottomRight: [28, 90] },
    );
    L.control.zoom({ position: "bottomright" }).addTo(instance);
    instance.attributionControl.setPrefix(false);
    instance.attributionControl.addAttribution("NexRoute · Sơ đồ mô phỏng");
    map.current = instance;
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !base) return;
    setTileError(false);
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxNativeZoom: 19,
        maxZoom: 21,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(map.current);
    tiles.on("tileerror", () => setTileError(true));
    return () => {
      tiles.remove();
    };
  }, [base]);
  useEffect(() => {
    if (!map.current) return;
    const group = L.featureGroup().addTo(map.current);
    const labels: Record<string, string> = {
      open: "Có thông tin lối đi",
      closed: "Đang đóng",
      needs_verification: "Cần kiểm tra",
      not_allowed: "Không dành cho phương tiện này",
    };
    const statusOf = (id: string, type: string) =>
      layer.flags?.find(
        (f) =>
          f.target_id === id &&
          f.target_type === type &&
          f.mode ===
            (type === "access_node" && id.startsWith("G") ? "walk" : mode),
      )?.status;
    // No HTML from API data is inserted in labels or tooltips.
    for (const feature of layer.feature_collection.features) {
      const p = feature.properties;
      const id = String(p.id),
        type = String(p.feature_type);
      const state = statusOf(id, type);
      const selected = selectedIds.includes(feature.id);
      const color =
        state === "closed"
          ? "#cf5b42"
          : state === "needs_verification"
            ? "#bc851c"
            : "#97aca5";
      const geometry = feature.geometry;
      let shape: L.Layer;
      if (geometry.type === "Polygon") {
        shape = L.polygon(
          geometry.coordinates.map((ring) =>
            ring.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
          ),
          {
            color: "#b69871",
            weight: 1,
            dashArray: "5 7",
            fillColor: "#e8d9be",
            fillOpacity: 0.22,
          },
        );
      } else if (geometry.type === "LineString") {
        shape = L.polyline(
          geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          {
            color,
            weight: selected ? 8 : 5,
            opacity: 0.75,
            dashArray: state === "closed" ? "5 7" : undefined,
          },
        );
      } else {
        if (type === "place") continue; // Entrance markers carry place selection at the same coordinate.
        const [lng, lat] = geometry.coordinates;
        const el = document.createElement("div");
        el.className = `map-node ${p.node_type === "entrance" ? "destination" : ""} ${selected ? "selected" : ""} ${state ?? ""}`;
        el.textContent = id;
        el.setAttribute(
          "aria-label",
          `${String(p.label ?? id)} · ${labels[state ?? ""] ?? "Điểm trên bản đồ"}`,
        );
        shape = L.marker([lat, lng], {
          icon: L.divIcon({
            html: el,
            className: "node-shell",
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
          keyboard: true,
          title: String(p.label ?? id),
          zIndexOffset: selected ? 900 : 100,
        });
      }
      const tooltip = document.createElement("span");
      tooltip.textContent = `${String(p.label ?? p.name ?? id)}${state ? ` · ${labels[state]}` : ""}`;
      shape.bindTooltip(tooltip, { direction: "top" });
      shape.on("click", () =>
        select.current({
          featureId: feature.id,
          id,
          type,
          label: String(p.label ?? p.name ?? id),
        }),
      );
      shape.addTo(group);
    }
    if (plan && plan.data_version === layer.data_version) {
      for (const leg of plan.legs) {
        const feature = layer.feature_collection.features.find(
          (f) => f.id === `edge/${leg.edge_id}`,
        );
        if (!feature || feature.geometry.type !== "LineString") continue;
        L.polyline(
          feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          {
            color: leg.mode === "motorcycle" ? "#345b99" : "#117b64",
            weight: 7,
            opacity: 0.95,
            dashArray: leg.mode === "walk" ? "2 11" : undefined,
            interactive: false,
          },
        ).addTo(group);
      }
    }
    return () => {
      group.remove();
    };
  }, [layer, plan, mode, selectedIds]);
  return (
    <div className="map-frame">
      <div
        ref={host}
        className="map-canvas"
        aria-label="Bản đồ tương tác Khu demo A"
        data-testid="access-map"
      />
      <div className="map-top">
        <span className="map-label">
          KHU DEMO A <b>· v{layer.data_version}</b>
        </span>
        <button className="map-toggle" onClick={() => setBase(!base)}>
          {base ? "Ẩn nền địa lý" : "Xem nền địa lý"}
        </button>
      </div>
      {base && (
        <div className="basemap-note">
          {tileError
            ? "Không tải được một số ô nền. Lớp dữ liệu vẫn dùng được."
            : "Vị trí minh họa; không khớp cửa hàng thực địa."}
        </div>
      )}
      <button
        className="recenter"
        aria-label="Về toàn bộ khu demo"
        onClick={() =>
          map.current?.fitBounds(
            [
              [10.7748, 106.6938],
              [10.7778, 106.6978],
            ],
            { padding: [30, 55] },
          )
        }
      >
        ⌖ Toàn khu
      </button>
      <div className="map-legend">
        <span>
          <i className="legend-line ride" />
          Xe máy
        </span>
        <span>
          <i className="legend-line walk" />
          Đi bộ
        </span>
        <span>
          <i className="legend-dot closed" />
          Lối đóng
        </span>
        <span>
          <i className="legend-dot stale" />
          Cần kiểm tra
        </span>
      </div>
    </div>
  );
}
