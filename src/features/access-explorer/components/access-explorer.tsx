"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  fixtureView,
  scenarios,
  scenarioTime,
  type ScenarioId,
} from "@/features/access-explorer/fixtures";
import { loadLiveView, readJson, sendReport } from "@/features/access-explorer/api";
import type {
  MapSelection,
  PublicQuery,
  PublicView,
} from "@/features/access-explorer/types";
const AccessMap = dynamic(() => import("@/components/map/access-map"), {
  ssr: false,
  loading: () => <div className="map-skeleton">Đang mở bản đồ…</div>,
});
const statusText = {
  available: "Có phương án tiếp cận",
  needs_verification: "Cần xác minh thêm",
  no_plan_found: "Chưa tìm thấy lối phù hợp",
};
const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").toLowerCase();
const prettyTime = (s: string | null | undefined) =>
  s
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(s))
    : "Chưa có";

export function AccessExplorer() {
  const [source, setSource] = useState<"fixture" | "api">("fixture");
  const [scenario, setScenario] = useState<ScenarioId>("S0");
  const [placeId, setPlace] = useState("place_a");
  const [mode, setMode] = useState<"motorcycle" | "walk">("motorcycle");
  const [origin, setOrigin] = useState("O");
  const [departure, setDeparture] = useState("2026-10-01T17:00");
  const [clockRunning, setClockRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<PublicView | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncWarning, setSyncWarning] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<MapSelection | null>(null);
  const [reportNode, setReportNode] = useState("G2");
  const [message, setMessage] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const serial = useRef(0);
  const currentVersion = useRef<number | null>(null);
  const departAt =
    source === "fixture"
      ? scenarioTime(scenario)
      : departure
        ? `${departure}${departure.length === 16 ? ":00" : ""}+07:00`
        : "";
  const requestKey = [source, scenario, placeId, mode, origin, departAt].join(
    "|",
  );
  const active = loadedKey === requestKey ? view : null;
  const plan = active?.plan;
  const selectedPlace = active?.places.find((p) => p.id === placeId);

  useEffect(() => {
    const read = () => {
      const id = new URLSearchParams(location.search).get("place");
      if (id) setPlace(id);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++serial.current;
    setLoading(true);
    setError("");
    const timeout = window.setTimeout(
      () =>
        controller.abort(new Error("Máy chủ phản hồi quá lâu. Hãy thử lại.")),
      15000,
    );
    const query: PublicQuery = {
      dataset_id: "demo-a",
      place_id: placeId,
      origin_node_id: origin,
      mode,
      purpose: "customer",
      depart_at: departAt,
    };
    const promise = !departAt
      ? Promise.reject(new Error("Hãy chọn giờ xuất phát."))
      : source === "fixture"
        ? Promise.resolve(fixtureView(scenario, query))
        : loadLiveView(query, controller.signal);
    promise
      .then((next) => {
        if (sequence !== serial.current || controller.signal.aborted) return;
        currentVersion.current = next.layer.data_version;
        setView(next);
        setLoadedKey(requestKey);
      })
      .catch((reason) => {
        if (sequence !== serial.current) return;
        setView(null);
        setLoadedKey("");
        setError(
          reason instanceof Error ? reason.message : "Không tải được dữ liệu.",
        );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (sequence === serial.current) setLoading(false);
      });
    return () => {
      ++serial.current;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [requestKey, refresh]); // Query key represents every request input.

  useEffect(() => {
    if (source !== "api") return;
    const controller = new AbortController();
    const poll = window.setInterval(() => {
      readJson<{ current_version: number }>("/api/v1/datasets/demo-a/version", {
        signal: controller.signal,
      })
        .then((v) => {
          setSyncWarning("");
          if (currentVersion.current !== v.current_version) {
            currentVersion.current = v.current_version;
            setRefresh((n) => n + 1);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setSyncWarning(
              "Mất kết nối cập nhật. Dữ liệu đang hiển thị có thể đã cũ.",
            );
        });
    }, 5000);
    return () => {
      clearInterval(poll);
      controller.abort();
    };
  }, [source]);
  useEffect(() => {
    if (source !== "api" || !clockRunning) return;
    const timer = setInterval(
      () =>
        setDeparture((value) => {
          const time = Date.parse(
            `${value}${value.length === 16 ? ":00" : ""}+07:00`,
          );
          return Number.isFinite(time)
            ? new Date(time + 60000 + 7 * 3600000).toISOString().slice(0, 19)
            : value;
        }),
      60000,
    );
    return () => clearInterval(timer);
  }, [source, clockRunning]);
  useEffect(() => {
    if (source !== "api" || !clockRunning || !plan?.next_recompute_at) return;
    const nextTime = Date.parse(plan.next_recompute_at);
    const delay = nextTime - Date.parse(departAt);
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = setTimeout(
      () =>
        setDeparture(
          new Date(nextTime + 7 * 3600000).toISOString().slice(0, 19),
        ),
      Math.min(delay, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [source, clockRunning, plan?.next_recompute_at, departAt]);

  function choosePlace(id: string) {
    setPlace(id);
    setShareStatus("");
    const url = new URL(location.href);
    url.searchParams.set("place", id);
    history.replaceState(null, "", url);
  }
  function selectFeature(item: MapSelection) {
    setSelected(item);
    if (item.type === "access_node") setReportNode(item.id);
    if (["A", "B", "C"].includes(item.id))
      choosePlace(`place_${item.id.toLowerCase()}`);
    if (item.type === "place") choosePlace(item.id);
  }
  async function report(event: React.FormEvent) {
    event.preventDefault();
    setReportStatus("");
    if (!message.trim()) return;
    if (source === "fixture") {
      setReportStatus(
        "Phản ánh mẫu đã ghi nhận trên màn hình này; chưa gửi máy chủ. Trạng thái lối đi không đổi.",
      );
      return;
    }
    setSending(true);
    try {
      const result = await sendReport(message.trim(), [reportNode]);
      setReportStatus(
        `Đã tiếp nhận ${result.id}. Chờ người vận hành xác minh; lối đi chưa thay đổi.`,
      );
      setMessage("");
    } catch (reason) {
      setReportStatus(
        reason instanceof Error ? reason.message : "Gửi chưa thành công.",
      );
    } finally {
      setSending(false);
    }
  }
  const places = active?.places ?? view?.places ?? [];
  const filtered = places.filter((p) =>
    fold(`${p.name} ${p.aliases.join(" ")}`).includes(fold(search)),
  );
  const origins = (active?.layer.feature_collection.features ?? []).filter(
    (f) => f.properties.feature_type === "access_node",
  );
  const badge =
    source === "fixture"
      ? "ĐÁP ÁN MẪU · KHÔNG PHẢI ENGINE"
      : "KẾT NỐI API · DỮ LIỆU DEMO";

  return (
    <main>
      <header className="app-header">
        <a className="brand" href="/">
          <span className="brand-icon">↗</span>
          <span>
            AccessLink<small>LỐI TIẾP CẬN</small>
          </span>
        </a>
        <div className="header-note">
          Một địa điểm.
          <br />
          <strong>Đúng lối để đến.</strong>
        </div>
        <span className="team-label">
          NEXROUTE <b>DEMO / 2026</b>
        </span>
      </header>
      <div className="notice-bar">
        <span className="status-dot" />
        <strong>Dữ liệu mô phỏng</strong>
        <span>
          Địa điểm, tọa độ và quãng đường dùng để kiểm thử. Không dùng dẫn đường
          thực tế.
        </span>
      </div>
      <section className="intro">
        <div>
          <p className="eyebrow">ĐIỂM ĐẾN VẪN Ở ĐÓ</p>
          <h1>
            Tìm lối tiếp cận
            <br className="mobile-break" /> phù hợp.
          </h1>
          <p>
            Lối mặt tiền bị chặn? Xem cửa vào, chỗ gửi xe và chặng đi bộ cuối.
          </p>
        </div>
        <div className="intro-index">
          <span>01</span>
          <p>
            KHU DEMO A<br />
            <b>Cụm 3 địa điểm</b>
          </p>
        </div>
      </section>
      <section className="demo-controls" aria-label="Điều khiển demo">
        <div className="segmented">
          <button
            aria-pressed={source === "fixture"}
            onClick={() => {
              setSource("fixture");
              setOrigin("O");
              setReportStatus("");
            }}
          >
            Kịch bản mẫu
          </button>
          <button
            aria-pressed={source === "api"}
            onClick={() => {
              setSource("api");
              setReportStatus("");
            }}
          >
            API tích hợp
          </button>
        </div>
        {source === "fixture" ? (
          <label className="scenario-select">
            Tình huống
            <select
              aria-label="Tình huống demo"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as ScenarioId)}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="api-note">
            Tự kiểm tra phiên bản mỗi 5 giây. Phương án lấy từ máy chủ; không
            thay bằng đáp án mẫu.
          </p>
        )}
        <span className="engine-badge">{badge}</span>
      </section>
      {source === "api" && syncWarning && (
        <p role="status" className="sync-warning">
          {syncWarning}
        </p>
      )}
      <div className="workspace">
        <aside className="search-panel panel">
          <div className="panel-title">
            <span className="step-number">1</span>
            <h2>Bạn muốn đến đâu?</h2>
          </div>
          <label className="field-label" htmlFor="search">
            Tìm trong khu demo
          </label>
          <div className="search-box">
            <span>⌕</span>
            <input
              id="search"
              placeholder="Tên địa điểm, ví dụ A…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="place-list" aria-label="Địa điểm">
            {filtered.map((p) => (
              <button
                key={p.id}
                className={`place-card ${placeId === p.id ? "active" : ""}`}
                onClick={() => choosePlace(p.id)}
                aria-pressed={placeId === p.id}
              >
                <span className="place-symbol">{p.entrance_node_id}</span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    Thông tin hoạt động:{" "}
                    {p.operation?.status === "open"
                      ? "mở cửa"
                      : p.operation?.status === "closed"
                        ? "đóng cửa"
                        : "chưa xác nhận"}
                  </small>
                </span>
                <span className="place-arrow">↗</span>
              </button>
            ))}
            {!filtered.length && (
              <p className="empty-state">
                {loading
                  ? "Đang tải địa điểm…"
                  : "Không có địa điểm khớp. Thử A, B hoặc C."}
              </p>
            )}
          </div>
          <div className="divider" />
          <label className="field-label" htmlFor="origin">
            Điểm xuất phát
          </label>
          <select
            id="origin"
            value={origin}
            disabled={source === "fixture"}
            onChange={(e) => setOrigin(e.target.value)}
          >
            {source === "fixture" || !origins.length ? (
              <option value="O">O · Điểm xuất phát demo</option>
            ) : (
              origins.map((f) => (
                <option key={f.id} value={String(f.properties.id)}>
                  {String(f.properties.id)} · {String(f.properties.label)}
                </option>
              ))
            )}
          </select>
          <span className="field-label">Phương tiện</span>
          <div className="mode-picker">
            <button
              aria-pressed={mode === "motorcycle"}
              onClick={() => setMode("motorcycle")}
            >
              ◉ Xe máy
            </button>
            <button
              aria-pressed={mode === "walk"}
              onClick={() => setMode("walk")}
            >
              ↟ Đi bộ
            </button>
          </div>
          <label className="field-label" htmlFor="departure">
            Giờ xuất phát · GMT+7
          </label>
          <input
            id="departure"
            type="datetime-local"
            step="1"
            value={
              source === "fixture"
                ? scenarioTime(scenario).slice(0, 16)
                : departure
            }
            disabled={source === "fixture"}
            onChange={(e) => setDeparture(e.target.value)}
          />
          {source === "api" && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={clockRunning}
                onChange={(e) => setClockRunning(e.target.checked)}
              />{" "}
              Chạy đồng hồ demo (1 phút/phút)
            </label>
          )}
          <p className="small-note">
            {source === "fixture"
              ? "Giờ và điểm xuất phát cố định theo đáp án mẫu; không nội suy sang truy vấn khác."
              : "Thay đổi giờ hoặc phiên bản sẽ tải lại cả lớp bản đồ và phương án."}
          </p>
          <button
            className="secondary full"
            onClick={() => setRefresh((n) => n + 1)}
            disabled={loading}
          >
            {loading ? "Đang tải…" : "↻ Tải lại dữ liệu"}
          </button>
        </aside>
        <section className="map-panel" aria-label="Không gian tiếp cận">
          <div className="map-heading">
            <span>
              <span className="step-number">2</span> Khám phá lối tiếp cận
            </span>
            <small>
              {loading
                ? "Đang đồng bộ…"
                : active
                  ? `Phiên bản ${active.layer.data_version}`
                  : "Chưa có dữ liệu"}
            </small>
          </div>
          {active && !loading ? (
            <AccessMap
              layer={active.layer}
              plan={active.plan}
              mode={mode}
              selectedIds={[
                `node/${selectedPlace?.entrance_node_id ?? ""}`,
                ...(selected ? [selected.featureId] : []),
              ]}
              onSelect={selectFeature}
            />
          ) : (
            <div className="map-skeleton">
              <span className="loading-icon">⌖</span>
              {error || "Đang đồng bộ bản đồ và phương án…"}
              {error && (
                <button
                  className="secondary"
                  onClick={() => setRefresh((n) => n + 1)}
                >
                  Thử lại
                </button>
              )}
            </div>
          )}
          <div className="map-caption">
            <span>ⓘ</span>
            <p>
              {source === "fixture"
                ? scenarios.find((s) => s.id === scenario)?.note
                : "Chọn điểm trên bản đồ để xem tên và gắn phản ánh. Lớp bản đồ và tuyến phải cùng phiên bản."}
            </p>
          </div>
          {selected && (
            <div className="selection-card">
              <strong>
                Đang chọn: {selected.id} · {selected.label}
              </strong>
              <span>Đối tượng này có thể được gắn vào phản ánh bên dưới.</span>
            </div>
          )}
        </section>
        <aside
          className="route-panel panel"
          aria-live="polite"
          aria-busy={loading}
        >
          <div className="panel-title">
            <span className="step-number">3</span>
            <h2>Phương án tiếp cận</h2>
          </div>
          {loading ? (
            <p className="empty-state">Đang kiểm tra lựa chọn…</p>
          ) : error ? (
            <div role="alert" className="route-alert">
              {error}
            </div>
          ) : active?.planError ? (
            <div className="route-alert" role="status">
              <strong>Chưa có phương án để hiển thị</strong>
              <p>{active.planError}</p>
            </div>
          ) : plan ? (
            <>
              <div className={`route-status ${plan.route_status}`}>
                <span>{plan.route_status === "available" ? "✓" : "!"}</span>
                <strong>{statusText[plan.route_status]}</strong>
              </div>
              <h3 className="destination-title">
                {selectedPlace?.name ?? placeId}
                <small>
                  Cửa đích{" "}
                  {plan.destination_node_id ??
                    selectedPlace?.entrance_node_id ??
                    "chưa rõ"}
                </small>
              </h3>
              {plan.route_status === "available" && (
                <div className="distance">
                  <strong data-testid="walk-distance">
                    {plan.walk_length_m ?? "—"}
                    <span> m</span>
                  </strong>
                  <p>
                    chặng đi bộ
                    <br />
                    <small>
                      Chiều dài trong dữ liệu{" "}
                      {source === "fixture" ? "mẫu" : "API"}
                    </small>
                  </p>
                </div>
              )}
              {plan.route_status === "no_plan_found" ? (
                <p className="route-explanation">
                  Chưa có phương án hợp lệ trong phạm vi dữ liệu này. Hãy đổi
                  phương tiện hoặc giờ và kiểm tra lại với địa điểm.
                </p>
              ) : (
                <ol className="route-steps">
                  {plan.legs.map((leg, index) => (
                    <li key={`${index}-${leg.edge_id}`} className={leg.mode}>
                      <span className="leg-dot">{index + 1}</span>
                      <div>
                        <strong>
                          {leg.from_node_id} → {leg.to_node_id}
                        </strong>
                        <small>
                          {leg.mode === "motorcycle" ? "Xe máy" : "Đi bộ"} ·{" "}
                          {leg.length_m} m
                        </small>
                        {index > 0 &&
                          plan.legs[index - 1].mode !== leg.mode && (
                            <em>
                              Gửi xe tại {leg.from_node_id} rồi chuyển sang đi
                              bộ
                            </em>
                          )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {plan.route_status === "needs_verification" && (
                <p className="route-explanation">
                  Chưa đủ bằng chứng xác nhận lối đi. Liên hệ địa điểm trước khi
                  sử dụng.
                </p>
              )}
              {!!plan.limitations.length && (
                <div className="limitations">
                  {plan.limitations.map((r) => (
                    <p key={r}>
                      {(
                        {
                          g2_needs_verification:
                            "G2 cần kiểm tra lại thông tin.",
                          transfer_unavailable: "Điểm P đã hết giờ nhận xe.",
                          no_plan_in_scope:
                            "Chưa tìm thấy lối trong cụm dữ liệu.",
                        } as Record<string, string>
                      )[r] ?? r}
                    </p>
                  ))}
                </div>
              )}
              <div className="version-stamp">
                v{plan.data_version} ·{" "}
                {prettyTime(plan.evaluated_at ?? departAt)}
                <br />
                {source === "fixture"
                  ? "Đáp án mẫu có sẵn, chưa chạy engine."
                  : "Kết quả trả từ API tích hợp."}
              </div>
            </>
          ) : (
            <p className="empty-state">Chọn một địa điểm để bắt đầu.</p>
          )}
          <button
            className="secondary full"
            onClick={async () => {
              try {
                const url = new URL(location.href);
                url.searchParams.set("place", placeId);
                await navigator.clipboard.writeText(url.href);
                setShareStatus("Đã sao chép link địa điểm.");
              } catch {
                setShareStatus(
                  "Không sao chép được. Bạn có thể lấy link từ thanh địa chỉ.",
                );
              }
            }}
          >
            ↗ Chia sẻ địa điểm
          </button>
          <p role="status" className="small-note">
            {shareStatus}
          </p>
        </aside>
      </div>
      <section className="support-grid">
        <div className="evidence-panel panel">
          <p className="eyebrow">DỮ LIỆU CÓ NGỮ CẢNH</p>
          <h2>Nguồn & thời điểm kiểm tra</h2>
          <p className="section-description">
            Duyệt dữ liệu vào demo không đồng nghĩa đã xác minh thực địa.
          </p>
          {active?.evidence.length ? (
            <details>
              <summary>
                Xem {active.evidence.length} bản ghi nguồn mô phỏng
              </summary>
              <div className="evidence-list">
                {active.evidence.map((e) => (
                  <article key={e.id}>
                    <strong>{e.content}</strong>
                    <p>
                      Loại:{" "}
                      {e.source_type === "synthetic" ? "mô phỏng" : "thực địa"}{" "}
                      · Duyệt: {e.review_status}
                    </p>
                    <small>
                      Ngày duyệt: {prettyTime(e.reviewed_at)} · Hạn kiểm tra:{" "}
                      {prettyTime(e.review_due_at)}
                      <br />
                      Quan sát thực địa: {prettyTime(e.observed_at)}
                    </small>
                  </article>
                ))}
              </div>
            </details>
          ) : (
            <p className="small-note">
              {source === "api"
                ? "API phương án chưa cung cấp bản ghi nguồn. Không suy ra rằng lối đi đã được xác minh."
                : "Đang tải nguồn dữ liệu."}
            </p>
          )}
        </div>
        <form className="report-panel panel" onSubmit={report}>
          <p className="eyebrow">BỔ SUNG TỪ CỘNG ĐỒNG</p>
          <h2>Thông tin lối đi đã thay đổi?</h2>
          <p className="section-description">
            Phản ánh sẽ chờ kiểm tra, không tự thay đổi tuyến.
          </p>
          <label htmlFor="report-node" className="field-label">
            Vị trí liên quan
          </label>
          <select
            id="report-node"
            value={reportNode}
            onChange={(e) => setReportNode(e.target.value)}
          >
            {["O", "P", "G1", "G2", "G3", "J", "A", "B", "C"].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <label htmlFor="report" className="field-label">
            Nội dung phản ánh
          </label>
          <textarea
            id="report"
            rows={3}
            maxLength={2000}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ví dụ: Lối G2 đang bị chắn, cần kiểm tra lại…"
          />
          <button className="primary" disabled={sending || !message.trim()}>
            {sending
              ? "Đang gửi…"
              : source === "fixture"
                ? "Thử phản ánh mẫu →"
                : "Gửi phản ánh →"}
          </button>
          <p role="status" className="small-note">
            {reportStatus ||
              (source === "fixture"
                ? "Chế độ mẫu chỉ minh họa thao tác. Chuyển sang API tích hợp để gửi lên máy chủ demo."
                : "Phản ánh được gửi vào bộ dữ liệu demo của API.")}
          </p>
        </form>
      </section>
      <footer>
        <span>
          ↗ <strong>AccessLink</strong> · Lối Tiếp Cận
        </span>
        <span>NexRoute / MLAI Hackathon · Bản thử nghiệm</span>
      </footer>
    </main>
  );
}
