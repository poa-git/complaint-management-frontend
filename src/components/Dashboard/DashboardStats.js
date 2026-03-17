// DashboardStats.js
import React, { useMemo, useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Brush,
  Legend
} from "recharts";
import { Chip, Fade, Grow } from "@mui/material";
import "./dashboardStats.css";

/* ====== Colors & Labels ====== */
const PALETTE = [
  "#4F46E5", "#10B981", "#F59E0B", "#EC4899", "#06B6D4",
  "#8B5CF6", "#22C55E", "#F97316", "#3B82F6", "#E11D48",
  "#84CC16", "#F472B6", "#14B8A6", "#A855F7", "#EF4444"
];

const SERIES = {
  total:   { label: "Total",      color: "#334155", icon: "📊" },
  success: { label: "Successful", color: "#22C55E", icon: "✅" },
  expired: { label: "Expired",    color: "#EF4444", icon: "⏰" },
  rate:    { label: "Success %",  color: "#4F46E5", icon: "📈" },
};

const DEFAULT_CITY_ORDER = [
  "Karachi","Lahore","Islamabad","Peshawar","Hyderabad","Quetta",
  "Sukkur","Sadiqabad","Bahawalpur","Multan","Sahiwal","Jhang",
  "Faisalabad","Sargodha","Sialkot","Jhelum","Abbottabad",
];

const CHART_THEMES = {
  default: "Default",
  modern: "Modern",
  minimal: "Minimal"
};

/* ====== Normalization ====== */
const normalizeStatus = (s) => (s ? s.toString().trim().toLowerCase() : "");
const SUCCESS = ["successful", "success", "successfull", "done", "completed", "delivered"];
const EXPIRED = ["expired", "closed", "timeout", "cancelled", "failed"];
const PENDING = ["pending", "in-progress", "processing", "assigned"];

const isSuccess = (s) => SUCCESS.some((lbl) => normalizeStatus(s).includes(lbl));
const isExpired = (s) => EXPIRED.some((lbl) => normalizeStatus(s).includes(lbl));
const isPending = (s) => PENDING.some((lbl) => normalizeStatus(s).includes(lbl));
const pct = (n, d) => (d ? ((n / d) * 100) : 0);

/* ====== Helpers ====== */
// (kept for other uses; not used for Engineer/Visitor anymore)
function topNWithOthers(rows, n, labelKey = "label") {
  if (rows.length <= n) return rows;
  const sorted = [...rows].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const agg = rest.reduce(
    (acc, r) => {
      acc.total += r.total || 0;
      acc.success += r.success || 0;
      acc.expired += r.expired || 0;
      acc.pending += r.pending || 0;
      return acc;
    },
    { [labelKey]: "Others", total: 0, success: 0, expired: 0, pending: 0 }
  );
  return [...top, agg.total ? agg : []].filter(Boolean);
}

function toHBarData(rows, labelKey = "label") {
  return rows.map((r, i) => ({
    name: r[labelKey],
    total: r.total || 0,
    success: r.success || 0,
    expired: r.expired || 0,
    pending: r.pending || 0,
    rate: Number(pct(r.success, r.total).toFixed(1)),
    color: PALETTE[i % PALETTE.length],
  }));
}

const sortByTotalDesc = (rows) =>
  [...rows].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

// Number formatting helpers
const nf = new Intl.NumberFormat();
const fmt = (n) => {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return nf.format(n);
};

// Y-axis tick renderer: truncates long labels, shows full value on hover
const YTick = ({ x, y, payload }) => {
  const full = String(payload?.value ?? "");
  const short = full.length > 18 ? `${full.slice(0, 16)}…` : full;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={4} textAnchor="end" className="ds-y-tick">
        <title>{full}</title>
        {short}
      </text>
    </g>
  );
};

// Tiny progress bar for KPIs
function Progress({ value }) {
  return (
    <div className="ds-progress">
      <div
        className="ds-progress-fill"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ====== Custom Tooltip ====== */
const CustomTooltip = ({ active, payload, label, theme = "light" }) => {
  if (!active || !payload || !payload.length) return null;

  const isDark = theme === "dark";
  const baseStyle = {
    backgroundColor: isDark ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)",
    border: "none",
    borderRadius: 16,
    boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
    fontSize: 14,
    padding: "16px 20px",
    backdropFilter: "blur(10px)",
    color: isDark ? "#F8FAFC" : "#0F172A"
  };

  return (
    <div style={baseStyle}>
      <p style={{ margin: 0, fontWeight: 600, marginBottom: 8, color: isDark ? "#E2E8F0" : "#475569" }}>
        {label}
      </p>
      {payload.map((entry, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div
            style={{
              width: 8,
              height: 8,
              backgroundColor: entry.color,
              borderRadius: "50%",
              boxShadow: `0 0 8px ${entry.color}40`
            }}
          />
          <span style={{ fontSize: 12, opacity: 0.8 }}>{entry.name}:</span>
          <span style={{ fontWeight: 700, marginLeft: "auto" }}>
            {entry.name === "Success Rate" ? `${entry.value}%` : Number(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ====== Component ====== */
export default function DashboardStats({
  schedules,
  filterDate,
  cityOrder = DEFAULT_CITY_ORDER,
  showVisitorTable = true,
  topNPerChart = 12, // remains available for City chart if you still want "Others" there
  theme = "default",
  enableAnimations = true,
  showTrends = false,
  /** Force a white/light UI regardless of OS/browser theme */
  forceLight = true,
}) {
  // State
  const [showVisitor, setShowVisitor] = useState(showVisitorTable);
  const [selectedMetric, setSelectedMetric] = useState("total");
  const [chartTheme, setChartTheme] = useState(theme);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null);

  // Filter by date
  const dayEvents = useMemo(
    () => (schedules || []).filter((e) => e.scheduledFor === filterDate),
    [schedules, filterDate]
  );

  // Totals
  const totals = useMemo(() => {
    const total = dayEvents.length;
    const success = dayEvents.filter((e) => isSuccess(e.status)).length;
    const expired = dayEvents.filter((e) => isExpired(e.status)).length;
    const pending = dayEvents.filter((e) => isPending(e.status)).length;
    const rate = pct(success, total);
    return { date: filterDate, total, success, expired, pending, rate, other: total - success - expired - pending };
  }, [dayEvents, filterDate]);

  // City breakdown (keeps optional "Others" behavior for very long lists)
  const cityRows = useMemo(() => {
    const orderLower = cityOrder.map((c) => c.toLowerCase());
    const buckets = new Map();

    for (const e of dayEvents) {
      const raw = e.city || "";
      const idx = orderLower.indexOf(raw.toLowerCase());
      const key = idx !== -1 ? cityOrder[idx] : `Others:${raw || "-"}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(e);
    }

    const byCity = [];
    let oTotal = 0, oSucc = 0, oExp = 0, oPend = 0;

    for (const city of cityOrder) {
      const list = buckets.get(city) || [];
      const total = list.length;
      const success = list.filter((e) => isSuccess(e.status)).length;
      const expired = list.filter((e) => isExpired(e.status)).length;
      const pending = list.filter((e) => isPending(e.status)).length;
      byCity.push({ label: city, total, success, expired, pending });
      buckets.delete(city);
    }

    // Aggregate all non-listed cities under "Others" (unchanged)
    for (const [, list] of buckets.entries()) {
      const total = list.length;
      const success = list.filter((e) => isSuccess(e.status)).length;
      const expired = list.filter((e) => isExpired(e.status)).length;
      const pending = list.filter((e) => isPending(e.status)).length;
      oTotal += total; oSucc += success; oExp += expired; oPend += pending;
    }

    if (oTotal > 0) byCity.push({ label: "Others", total: oTotal, success: oSucc, expired: oExp, pending: oPend });

    // You can keep topNWithOthers here OR show them all; leaving as before:
    return toHBarData(topNWithOthers(byCity, topNPerChart));
  }, [dayEvents, cityOrder, topNPerChart]);

  // Engineer breakdown — FULL LIST, no "Others"
  const engineerRows = useMemo(() => {
    const map = new Map();
    for (const e of dayEvents) {
      const k = e.engineerName || "-"; // engineerName is your visitorName (per your domain)
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    const rows = Array.from(map.entries()).map(([name, list]) => {
      const total = list.length;
      const success = list.filter((x) => isSuccess(x.status)).length;
      const expired = list.filter((x) => isExpired(x.status)).length;
      const pending = list.filter((x) => isPending(x.status)).length;
      return { label: name, total, success, expired, pending };
    });

    // sort and return ALL
    return toHBarData(sortByTotalDesc(rows));
  }, [dayEvents]);

  // Visitor breakdown — FULL LIST, no "Others" (only if you keep this section)
  const visitorRows = useMemo(() => {
    if (!showVisitorTable) return [];
    const map = new Map();
    for (const e of dayEvents) {
      const k = e.performedBy || "-";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    const rows = Array.from(map.entries()).map(([name, list]) => {
      const total = list.length;
      const success = list.filter((x) => isSuccess(x.status)).length;
      const expired = list.filter((x) => isExpired(x.status)).length;
      const pending = list.filter((x) => isPending(x.status)).length;
      return { label: name, total, success, expired, pending };
    });

    // sort and return ALL
    return toHBarData(sortByTotalDesc(rows));
  }, [dayEvents, showVisitorTable]);

  // Pie data
  const pieData = useMemo(() => ([
    { name: "Successful", value: totals.success, color: SERIES.success.color, icon: SERIES.success.icon },
    { name: "Expired",    value: totals.expired, color: SERIES.expired.color, icon: SERIES.expired.icon },
    { name: "Pending",    value: totals.pending, color: "#F59E0B",             icon: "⏳" },
    { name: "Other",      value: totals.other,   color: "#E2E8F0",             icon: "📄" },
  ].filter(item => item.value > 0)), [totals]);

  // Handlers
  const handleMetricChange = useCallback((metric) => setSelectedMetric(metric), []);
  const handleThemeChange = useCallback((newTheme) => setChartTheme(newTheme), []);

  // Loading shim
  useEffect(() => {
    if (enableAnimations && filterDate) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [filterDate, enableAnimations]);

  /* ====== Early returns ====== */
  if (!filterDate) {
    return (
      <div className="ds-card ds-card--empty">
        <div className="ds-empty">
          <div className="ds-empty-icon">📅</div>
          <div className="ds-empty-title">No Date Selected</div>
          <div className="ds-empty-subtitle">Pick a date to see detailed analytics and insights</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="ds-wrap ds-wrap--loading">
        <div className="ds-loading">
          <div className="ds-loading-spinner"></div>
          <div className="ds-loading-text">Loading analytics...</div>
        </div>
      </div>
    );
  }

  /* ====== Render ====== */
  return (
    <Fade in={true} timeout={600}>
      <div className={`ds-wrap ${forceLight ? "ds-light" : ""}`}>
        {/* Header */}
        <div className="ds-head">
          <div className="ds-title-section">
            <div className="ds-title">
              <span className="ds-icon">📈</span>
              <span>Analytics Dashboard</span>
              <Chip label={filterDate} variant="outlined" size="small" className="ds-date-chip" />
            </div>
            <div className="ds-subtitle">Performance insights and success metrics</div>
          </div>

          <div className="ds-controls">
            <div className="ds-theme-selector">
              {Object.entries(CHART_THEMES).map(([key, label]) => (
                <button
                  key={key}
                  className={`ds-theme-btn ${chartTheme === key ? "active" : ""}`}
                  onClick={() => handleThemeChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ds-kpis">
              {Object.entries(SERIES).map(([key, series]) => (
                <div
                  key={key}
                  className={`ds-kpi ${selectedMetric === key ? "ds-kpi--active" : ""}`}
                  onClick={() => handleMetricChange(key)}
                  onMouseEnter={() => setHoveredSection(key)}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <div className="ds-kpi-icon">{series.icon}</div>
                  <div className="ds-kpi-content">
                    <span className="ds-kpi-label">{series.label}</span>
                    <span className={`ds-kpi-val ${key === "success" ? "ds-kpi-green" : key === "expired" ? "ds-kpi-red" : ""}`}>
                      {key === "rate" ? `${totals.rate.toFixed(1)}%` : nf.format(totals[key === "total" ? "total" : key])}
                    </span>
                    {key === "rate" && (
                      <div className="ds-kpi-extra">
                        <Progress value={totals.rate} />
                      </div>
                    )}
                  </div>
                  {hoveredSection === key && <div className="ds-kpi-highlight" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="ds-grid">
          {/* Donut */}
          <Grow in={true} timeout={800}>
            <section className="ds-card ds-card--donut">
              <div className="ds-card-header">
                <div className="ds-card-title"><span className="ds-card-icon">🎯</span>Success Distribution</div>
                <div className="ds-card-subtitle">Overall performance breakdown</div>
              </div>

              <div className="ds-donut">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={85}
                      outerRadius={125}
                      paddingAngle={3}
                      isAnimationActive={enableAnimations}
                      animationDuration={1200}
                      animationBegin={0}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RTooltip content={<CustomTooltip theme={"light"} />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="ds-donut-center">
                  <div className="ds-donut-rate">{Number(totals.rate.toFixed(1))}%</div>
                  <div className="ds-donut-sub">Success Rate</div>
                  <div className="ds-donut-trend">
                    {showTrends ? (totals.rate > 75 ? "📈" : totals.rate > 50 ? "📊" : "📉") : null}
                  </div>
                </div>
              </div>

              <div className="ds-legend">
                {pieData.map((item, index) => (
                  <div key={index} className="ds-legend-row">
                    <div className="ds-legend-item">
                      <span className="ds-legend-icon">{item.icon}</span>
                      <span className="ds-dot" style={{ background: item.color }} />
                      <span className="ds-legend-label">{item.name}</span>
                    </div>
                    <div className="ds-legend-values">
                      <span className="ds-legend-count">{nf.format(item.value)}</span>
                      <span className="ds-legend-percent">
                        ({totals.total ? ((item.value / totals.total) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </Grow>

          {/* City */}
          <Grow in={true} timeout={1000}>
            <section className="ds-card">
              <div className="ds-card-header">
                <div className="ds-card-title"><span className="ds-card-icon">🏙️</span>Performance by City</div>
                <div className="ds-card-subtitle">Geographic distribution and success rates</div>
              </div>

              <div className="ds-chart">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={cityRows} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
                    {/* soft gradients */}
                    <defs>
                      <linearGradient id="gradSuccess" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity="1" />
                      </linearGradient>
                      <linearGradient id="gradExpired" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity="1" />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} tickFormatter={fmt} />
                    <YAxis type="category" dataKey="name" width={140} tick={<YTick />} />
                    <RTooltip content={<CustomTooltip theme={"light"} />} />
                    <Legend />

                    <Bar dataKey="total"   name="Total"      fill="#94a3b8"             barSize={20} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations} />
                    <Bar dataKey="success" name="Successful" fill="url(#gradSuccess)"   barSize={20} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations}>
                      <LabelList dataKey="success" position="right" className="ds-bar-label" formatter={fmt} />
                    </Bar>
                    <Bar dataKey="pending" name="Pending"    fill="#F59E0B"             barSize={20} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations} />
                    <Bar dataKey="expired" name="Expired"    fill="url(#gradExpired)"   barSize={20} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations} />

                    <Brush height={20} travellerWidth={10} stroke="#E2E8F0" fill="rgba(79, 70, 229, 0.1)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </Grow>

          {/* Engineer */}
          <Grow in={true} timeout={1200}>
            <section className="ds-card">
              <div className="ds-card-header">
                <div className="ds-card-title"><span className="ds-card-icon">👨‍💼</span>Engineer Performance</div>
                <div className="ds-card-subtitle">Individual success metrics and workload</div>
              </div>

              <div className="ds-chart">
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={engineerRows} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
                    <defs>
                      <linearGradient id="gradSuccess2" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity="1" />
                      </linearGradient>
                      <linearGradient id="gradExpired2" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity="1" />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} tickFormatter={fmt} />
                    <YAxis type="category" dataKey="name" width={160} tick={<YTick />} />
                    <RTooltip content={<CustomTooltip theme={"light"} />} />
                    <Legend />

                    <Bar dataKey="total"   name="Total"      fill="#94a3b8"             barSize={18} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations} />
                    <Bar dataKey="success" name="Successful" fill="url(#gradSuccess2)"  barSize={18} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations}>
                      <LabelList dataKey="success" position="right" className="ds-bar-label" formatter={fmt} />
                    </Bar>
                    <Bar dataKey="pending" name="Pending"    fill="#F59E0B"             barSize={18} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations} />
                    <Bar dataKey="expired" name="Expired"    fill="url(#gradExpired2)"  barSize={18} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations} />

                    <Brush height={20} travellerWidth={10} stroke="#E2E8F0" fill="rgba(79, 70, 229, 0.1)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </Grow>

          {/* Visitor */}
          {/* {showVisitorTable && (
            <Grow in={true} timeout={1400}>
              <section className="ds-card">
                <div className="ds-card-header">
                  <div className="ds-card-title">
                    <span className="ds-card-icon">🚶‍♂️</span>
                    Visitor Performance
                    <button
                      className={`ds-toggle ${showVisitor ? "ds-toggle--active" : ""}`}
                      onClick={() => setShowVisitor((v) => !v)}
                      title={showVisitor ? "Hide Chart" : "Show Chart"}
                    >
                      {showVisitor ? <><span className="ds-toggle-icon">👁️</span>Hide</> : <><span className="ds-toggle-icon">👁️‍🗨️</span>Show</>}
                    </button>
                  </div>
                  <div className="ds-card-subtitle">Performance tracking by visitor assignments</div>
                </div>

                {showVisitor && (
                  <Fade in={showVisitor} timeout={400}>
                    <div className="ds-chart">
                      <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={visitorRows} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
                          <defs>
                            <linearGradient id="gradSuccess3" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#22C55E" stopOpacity="1" />
                            </linearGradient>
                            <linearGradient id="gradExpired3" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#EF4444" stopOpacity="1" />
                            </linearGradient>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} tickFormatter={fmt} />
                          <YAxis type="category" dataKey="name" width={160} tick={<YTick />} />
                          <RTooltip content={<CustomTooltip theme={"light"} />} />
                          <Legend />

                          <Bar dataKey="total"   name="Total"      fill="#94a3b8"             barSize={18} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations} />
                          <Bar dataKey="success" name="Successful" fill="url(#gradSuccess3)"  barSize={18} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations}>
                            <LabelList dataKey="success" position="right" className="ds-bar-label" formatter={fmt} />
                          </Bar>
                          <Bar dataKey="pending" name="Pending"    fill="#F59E0B"             barSize={18} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations} />
                          <Bar dataKey="expired" name="Expired"    fill="url(#gradExpired3)"  barSize={18} radius={[4, 4, 4, 4]} isAnimationActive={enableAnimations} />

                          <Brush height={20} travellerWidth={10} stroke="#E2E8F0" fill="rgba(79, 70, 229, 0.1)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Fade>
                )}
              </section>
            </Grow>
          )} */}
        </div>

        {/* Footer */}
        <Fade in={true} timeout={1600}>
          <div className="ds-footer">
            <div className="ds-summary">
              <div className="ds-summary-title">📋 Quick Summary</div>
              <div className="ds-summary-content">
                <div className="ds-summary-item">
                  <strong>{nf.format(totals.total)}</strong> total visits scheduled
                </div>
                <div className="ds-summary-item">
                  <strong>{nf.format(totals.success)}</strong> successfully completed
                </div>
                <div className="ds-summary-item">
                  Success rate: <strong className="ds-success-rate">{totals.rate.toFixed(1)}%</strong>
                </div>
              </div>
            </div>
          </div>
        </Fade>
      </div>
    </Fade>
  );
}

DashboardStats.propTypes = {
  schedules: PropTypes.arrayOf(PropTypes.object).isRequired,
  filterDate: PropTypes.string,
  cityOrder: PropTypes.arrayOf(PropTypes.string),
  showVisitorTable: PropTypes.bool,
  topNPerChart: PropTypes.number,
  theme: PropTypes.oneOf(Object.keys(CHART_THEMES)),
  enableAnimations: PropTypes.bool,
  showTrends: PropTypes.bool,
  forceLight: PropTypes.bool,
};
