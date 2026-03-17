import React, { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Brush,
} from "recharts";
import "./courierWidget.css";

const PALETTE = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#8B5CF6",
  "#22C55E",
  "#F97316",
  "#3B82F6",
  "#E11D48",
];

const COLOR_BY_STATUS = {
  "dispatch inward": "#4F46E5",
  "dispatch outward": "#F97316",
  "received inward": "#10B981",
  "received outward": "#06B6D4",
  "hardware ready": "#F59E0B",
  "out of stock": "#E11D48",
  observation: "#EC4899",
};

const SERIES_META = {
  hardwareReady: { label: "Hardware Ready", color: "#F59E0B" },
  dispatchInward: { label: "Dispatch Inward", color: "#4F46E5" },
  dispatchOutward: { label: "Dispatch Outward", color: "#F97316" },
  receivedInward: { label: "Received Inward", color: "#10B981" },
  receivedOutward: { label: "Received Outward", color: "#06B6D4" },
  outOfStock: { label: "Out Of Stock", color: "#E11D48" },

};

// ------------------------
// Helpers
// ------------------------
function normalize(raw) {
  if (!raw) return [];
  return Object.entries(raw)
    .filter(([status]) => status.toLowerCase() !== "unknown")
    .map(([status, obj]) => {
      const total = typeof obj === "number" ? obj : obj?.total ?? 0;
      return { status, total, ...obj };
    })
    .sort((a, b) => b.total - a.total);
}

function percent(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function normalizeTrend(raw) {
  if (!raw) return [];
  const parseISO = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d); // local midnight
  };
  const fmtLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const entries = Object.entries(raw);
  if (!entries.length) return [];

  // sort date keys lexicographically (YYYY-MM-DD works)
  const dateKeys = entries.map(([d]) => d).sort();
  const end = parseISO(dateKeys[dateKeys.length - 1]);
  const start = new Date(end);
  start.setDate(start.getDate() - 30);

  // detect present series
  const seriesSet = new Set();
  for (const [, v] of entries) {
    if (typeof v === "number") seriesSet.add("hardwareReady");
    else if (v && typeof v === "object")
      Object.keys(v).forEach((k) => seriesSet.add(k));
  }
  const series = Array.from(seriesSet).filter((k) => SERIES_META[k]);

  const out = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = fmtLocalYMD(d); // <-- no UTC conversion
    const v = raw[iso];

    const row = { date: iso, dateMs: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() };
    if (typeof v === "number") {
      row.hardwareReady = v;
    } else if (v && typeof v === "object") {
      for (const key of series) row[key] = Number(v[key] ?? 0);
    } else {
      for (const key of series) row[key] = 0;
    }
    out.push(row);
  }
  return out;
}
// ------------------------
// Main Widget
// ------------------------
const CourierStatusWidget = ({
  data,
  trendData,
  loading,
  error,
  onSliceClick,
}) => {
  // ✅ Hooks first
  const rows = useMemo(() => normalize(data), [data]);
  const trendRows = useMemo(() => normalizeTrend(trendData), [trendData]);

  const presentSeries = useMemo(() => {
    if (!trendRows.length) return [];
    return Object.keys(trendRows[0]).filter(
      (k) => k !== "date" && k !== "dateMs" && SERIES_META[k]
    );
  }, [trendRows]);

  // Multi-select state for trend series
  const [selectedSeries, setSelectedSeries] = useState([]);

  // Keep selected series in sync with what's available
  // Reset selection when new data arrives
  useEffect(() => {
    if (!trendRows.length) {
      setSelectedSeries([]);
    } else {
      const newSeries = presentSeries;
      setSelectedSeries((prev) => {
        if (!prev.length) return newSeries; // default select all
        return prev.filter((s) => newSeries.includes(s));
      });
    }
  }, [trendRows, presentSeries]);

  const totalAll = useMemo(() => {
    return rows.reduce((s, r) => {
      const name = r.status.toLowerCase();
      if (name === "received outward" || name === "dispatch outward") return s;
      return s + (r.total || 0);
    }, 0);
  }, [rows]);

  const hardwareReady = useMemo(
    () => rows.find((r) => r.status.toLowerCase() === "hardware ready"),
    [rows]
  );

  const chartData = useMemo(
    () =>
      rows.map((r, i) => ({
        name: r.status,
        value: r.total,
        color:
          COLOR_BY_STATUS[r.status.toLowerCase()] ||
          PALETTE[i % PALETTE.length],
      })),
    [rows]
  );
  // ------------------------
  // Early returns AFTER hooks
  // ------------------------
  if (loading) {
    return (
      <section className="cwg-card">
        <div className="cwg-title">
          <div className="cwg-title-icon">📊</div>
          Lab Status
        </div>
        <div className="cwg-loading">
          <div className="cwg-spinner"></div>
          <span>Loading courier stats…</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cwg-card">
        <div className="cwg-title">
          <div className="cwg-title-icon">⚠️</div>
          Lab Status
        </div>
        <div className="cwg-error">
          <div className="cwg-error-icon">❌</div>
          {error}
        </div>
      </section>
    );
  }

  if (!rows.length) return null;

  const hrTotal = hardwareReady?.total || 0;
  const hrApprovedFoc = hardwareReady?.hardwareReadyApprovedFoc || 0;
  const hrWaitApproval = hardwareReady?.hardwareReadyWaitApproval || 0;

  // Toggle UI for trend series (white theme, pill checkboxes)
  const toggleBar = (
    <div
      className="cwg-series-toggle"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}
    >
      {presentSeries.map((key) => {
        const active = selectedSeries.includes(key);
        const color = SERIES_META[key]?.color || "#3B82F6";
        return (
          <button
            key={key}
            type="button"
            onClick={() =>
              setSelectedSeries((prev) =>
                prev.includes(key)
                  ? prev.filter((s) => s !== key)
                  : [...prev, key]
              )
            }
            className="cwg-chip"
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${active ? color : "#E2E8F0"}`,
              background: active ? "#ffffff" : "#ffffff",
              boxShadow: active ? `inset 0 0 0 2px ${color}20` : "none",
              color: "#334155",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all .15s ease",
            }}
            title={SERIES_META[key]?.label || key}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
                display: "inline-block",
                boxShadow: "0 1px 2px rgba(0,0,0,.15)",
              }}
            />
            {SERIES_META[key]?.label || key}
          </button>
        );
      })}
    </div>
  );

  return (
    <section className="cwg-card">
      <div className="cwg-header">
        <div className="cwg-title">
          <div className="cwg-title-icon">🔬</div>
          Lab Status Overview
          <span style={{ fontSize: 12, color: "#22C55E", marginLeft: 8 }}>
            ● Live
          </span>
        </div>

        <div className="cwg-total-badge">
          <span className="cwg-total-label">Total</span>
          <span className="cwg-total-value">{totalAll.toLocaleString()}</span>
        </div>
      </div>

      <div className="cwg-grid">
        {/* Donut */}
        <div className="cwg-chart-container">
          <div className="cwg-chart">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={75}
                  outerRadius={120}
                  paddingAngle={3}
                  onClick={(e) => onSliceClick && onSliceClick(e?.name)}
                  className="cwg-pie-hover"
                  isAnimationActive={false} // <-- add this
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      className="cwg-pie-cell"
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(v, name) => [
                    `${v.toLocaleString()} (${percent(v, totalAll)}%)`,
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
                    fontSize: "14px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center total */}
            <div className="cwg-chart-center">
              <div className="cwg-center-value">
                {totalAll.toLocaleString()}
              </div>
              <div className="cwg-center-label">Total Items</div>
            </div>
          </div>

          {/* Legend */}
          <div className="cwg-legend">
            {chartData.map((d, i) => (
              <div key={i} className="cwg-legend-row">
                <div className="cwg-legend-indicator">
                  <span className="cwg-dot" style={{ background: d.color }} />
                </div>
                <div className="cwg-legend-content">
                  <span className="cwg-legend-name">{d.name}</span>
                  <div className="cwg-legend-stats">
                    <span className="cwg-legend-val">
                      {d.value.toLocaleString()}
                    </span>
                    <span className="cwg-legend-percent">
                      {percent(d.value, totalAll)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown + Trend */}
        <div className="cwg-right">
          <div className="cwg-breakdown">
            <div className="cwg-break-header">
              <div className="cwg-break-title">
                <span className="cwg-break-icon">⚙️</span>
                Hardware Ready
              </div>
              <div className="cwg-break-total">{hrTotal.toLocaleString()}</div>
            </div>

            <div className="cwg-break-rows">
              <div className="cwg-break-row">
                <div className="cwg-break-indicator">
                  <span className="cwg-pill cwg-pill-green" />
                  <span className="cwg-break-status">Approved + FOC</span>
                </div>
                <div className="cwg-break-value">
                  <strong>{hrApprovedFoc.toLocaleString()}</strong>
                  <span className="cwg-break-percent">
                    {hrTotal ? percent(hrApprovedFoc, hrTotal) : 0}%
                  </span>
                </div>
              </div>

              <div className="cwg-break-row">
                <div className="cwg-break-indicator">
                  <span className="cwg-pill cwg-pill-amber" />
                  <span className="cwg-break-status">Wait For Approval</span>
                </div>
                <div className="cwg-break-value">
                  <strong>{hrWaitApproval.toLocaleString()}</strong>
                  <span className="cwg-break-percent">
                    {hrTotal ? percent(hrWaitApproval, hrTotal) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trend + Toggle */}
          <div className="cwg-trend">
            <div
              className="cwg-trend-title"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>📈 Trend per Date</span>
            </div>

            {/* Toggle bar (only if we have series) */}
            {presentSeries.length > 0 && toggleBar}

            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={trendRows}
                margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dateMs"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(ts) =>
                    new Date(ts).toLocaleDateString(undefined, {
                      month: "short",
                      day: "2-digit",
                    })
                  }
                  tickMargin={8}
                  minTickGap={20}
                  padding={{ left: 8, right: 8 }}
                />
                <YAxis allowDecimals={false} tickMargin={8} />
                <Tooltip
                  labelFormatter={(ts) =>
                    new Date(ts).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })
                  }
                  formatter={(val, name) => {
                    const meta = SERIES_META[name] || { label: name };
                    return [`${val}`, meta.label];
                  }}
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                    fontSize: "14px",
                  }}
                />

                {presentSeries
                  .filter((key) => selectedSeries.includes(key))
                  .map((key) => (
                    <Line
                      key={key}
                      dataKey={key}
                      name={SERIES_META[key]?.label || key}
                      type="monotone"
                      stroke={SERIES_META[key]?.color || "#3B82F6"}
                      strokeWidth={3}
                      dot={false}
                      connectNulls
                      isAnimationActive={false} // <-- add this
                    />
                  ))}
                <Brush
                  dataKey="dateMs"
                  height={18}
                  travellerWidth={8}
                  stroke="#E2E8F0"
                />
              </LineChart>
            </ResponsiveContainer>

            {!trendRows.length && (
              <div
                className="cwg-note"
                style={{ marginTop: 8, color: "#94a3b8" }}
              >
                No trend data yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CourierStatusWidget;
