import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import Nav from "../../components/Navbar";
import { motion } from "framer-motion";
import "../../components/adminuistyles/Dashboard.css";

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "all", label: "All Time" },
];

function formatNum(n) {
  return (Number(n) || 0).toLocaleString();
}

function pctChange(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p <= 0 && c > 0) return { pct: 100, dir: "up" };
  if (p <= 0 && c <= 0) return { pct: 0, dir: "flat" };
  const raw = ((c - p) / p) * 100;
  const pct = Math.round(raw);
  return { pct, dir: raw > 0 ? "up" : raw < 0 ? "down" : "flat" };
}

function Delta({ current, previous }) {
  const d = pctChange(current, previous);
  const cls = d.dir === "up" ? "up" : d.dir === "down" ? "down" : "flat";
  const label = d.dir === "up" ? `+${d.pct}%` : d.dir === "down" ? `${d.pct}%` : "0%";
  return <span className={`cc-delta ${cls}`}>{label} vs last period</span>;
}

function SPIcon({ size = 14, color = "#3b82f6" }) {
  const w = size;
  const h = Math.round(size * 1.2);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 120"
      fill="none"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M50 5 L90 27.5 L90 72.5 L50 95 L10 72.5 L10 27.5 Z" fill={color} />
      <path
        d="M50 25 C35 25 30 30 30 40 C30 50 35 52 45 55 C52 57 55 58 55 63 C55 68 52 70 45 70 C38 70 35 68 32 65 L25 75 C30 80 37 82 45 82 C58 82 67 77 67 63 C67 50 60 48 50 45 C43 43 42 42 42 38 C42 34 45 32 50 32 C55 32 58 34 60 37 L68 28 C63 23 57 25 50 25 Z"
        fill="white"
      />
    </svg>
  );
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [data, setData] = useState({
    period: "daily",
    team_sp: { current: 0, previous: 0 },
    activity_summary: {},
    category_totals: {
      combat_ops: { current: 0, previous: 0 },
      rd_intel: { current: 0, previous: 0 },
      training: { current: 0, previous: 0 },
    },
    top_performers: [],
    at_risk_reps: [],
    recent_activity: [],
    quota_progress: { sp_month: 0, goal_sp_month: null },
  });

  const [tvUrl, setTvUrl] = useState("");
  const [tvLoading, setTvLoading] = useState(false);
  const [tvMsg, setTvMsg] = useState("");

  const fetchDashboard = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await api.get("/admin/dashboard", { params: { period } });
      setData(res?.data || {});
    } catch (e) {
      console.error(e);
      setErr("Failed to load Command Reporting data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const generateTvLink = async () => {
    setTvMsg("");
    setTvLoading(true);
    try {
      const res = await api.post("/admin/tv/token");
      const url = res?.data?.tv_url;

      if (!url) {
        setTvMsg("TV link generated but server did not return a URL.");
        return;
      }

      const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      setTvUrl(absolute);
      setTvMsg("TV link generated successfully.");
    } catch (err) {
      console.error(err);
      setTvMsg("Failed to generate TV link.");
    } finally {
      setTvLoading(false);
    }
  };

  const copyTvLink = async () => {
    if (!tvUrl) return;
    try {
      await navigator.clipboard.writeText(tvUrl);
      setTvMsg("Copied to clipboard.");
    } catch {
      setTvMsg("Copy failed — please copy manually.");
    }
  };

  const leaderboardRows = useMemo(() => {
    const rows = Array.isArray(data?.top_performers) ? [...data.top_performers] : [];
    const cleaned = rows.filter((r) => String(r?.user_name || "").trim().length > 0);
    cleaned.sort((a, b) => Number(a.rank || 999999) - Number(b.rank || 999999));
    return cleaned.slice(0, 10);
  }, [data]);

  const cardMotion = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  };

  if (loading) return <div className="loading">Loading Command Reporting…</div>;

  const teamSpCur = data?.team_sp?.current ?? 0;
  const teamSpPrev = data?.team_sp?.previous ?? 0;

  const dealsCur = data?.activity_summary?.deals_current ?? 0;
  const dealsPrev = data?.activity_summary?.deals_previous ?? 0;

  // CATEGORY KPI totals
  const combatCur = data?.category_totals?.combat_ops?.current ?? 0;
  const combatPrev = data?.category_totals?.combat_ops?.previous ?? 0;

  const intelCur = data?.category_totals?.rd_intel?.current ?? 0;
  const intelPrev = data?.category_totals?.rd_intel?.previous ?? 0;

  const trainingCur = data?.category_totals?.training?.current ?? 0;
  const trainingPrev = data?.category_totals?.training?.previous ?? 0;

  return (
    <div>
      <Nav />

      <div className="admin-dashboard">
        <div className="cc-header">
          <div>
            <h1 className="cc-title">Command Reporting</h1>
            <p className="cc-sub">Team performance analytics and mission breakdown.</p>
          </div>

          <div className="cc-period" role="tablist" aria-label="Period filter">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`cc-chip ${period === p.key ? "active" : ""}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {err && (
          <div className="summary-card" style={{ gridColumn: "1 / -1", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Error</h3>
            <div className="admin-subtle" style={{ marginTop: 8 }}>
              {err}
            </div>
          </div>
        )}

        <div className="dashboard-content">
          {/* KPI row */}
          <motion.div className="cc-kpi blue" {...cardMotion}>
            <div className="cc-kpi-label">TOTAL SP GENERATED</div>
            <div className="cc-kpi-value">
              {formatNum(teamSpCur)} <SPIcon size={14} color="#3b82f6" />
            </div>
            <div className="cc-kpi-sub">
              <Delta current={teamSpCur} previous={teamSpPrev} />
            </div>
          </motion.div>

          <motion.div className="cc-kpi red" {...cardMotion}>
            <div className="cc-kpi-label">DEALS CLOSED</div>
            <div className="cc-kpi-value">{formatNum(dealsCur)}</div>
            <div className="cc-kpi-sub">
              <Delta current={dealsCur} previous={dealsPrev} />
            </div>
          </motion.div>

          <motion.div className="cc-kpi green" {...cardMotion}>
            <div className="cc-kpi-label">COMBAT OPS ACTIVITY</div>
            <div className="cc-kpi-value">{formatNum(combatCur)}</div>
            <div className="cc-kpi-sub">
              <Delta current={combatCur} previous={combatPrev} />
            </div>
          </motion.div>

          {/* ✅ NEW KPI BOX */}
          <motion.div className="cc-kpi blue" {...cardMotion}>
            <div className="cc-kpi-label">R&amp;D / INTEL ACTIVITY</div>
            <div className="cc-kpi-value">{formatNum(intelCur)}</div>
            <div className="cc-kpi-sub">
              <Delta current={intelCur} previous={intelPrev} />
            </div>
          </motion.div>

          {/* ✅ NEW KPI BOX */}
          <motion.div className="cc-kpi green" {...cardMotion}>
            <div className="cc-kpi-label">TRAINING ACTIVITY</div>
            <div className="cc-kpi-value">{formatNum(trainingCur)}</div>
            <div className="cc-kpi-sub">
              <Delta current={trainingCur} previous={trainingPrev} />
            </div>
          </motion.div>

          {/* Rankings table */}
          <motion.div className="summary-card cc-table-card" {...cardMotion}>
            <div className="cc-card-head">
              <h3 className="cc-card-title">Team Rankings</h3>
              <button className="cc-link" type="button" disabled title="CSV export coming next">
                Export CSV
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="cc-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Rank</th>
                    <th>Agent</th>
                    <th className="right">Combat</th>
                    <th className="right">R&D/Intel</th>
                    <th className="right">Training</th>
                    <th className="right">Victories</th>
                    <th className="right">Total SP</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 16, color: "rgba(148,163,184,.95)" }}>
                        No data yet.
                      </td>
                    </tr>
                  ) : (
                    leaderboardRows.map((r, idx) => {
                      const rowCls =
                        idx === 0 ? "cc-row-1" : idx === 1 ? "cc-row-2" : idx === 2 ? "cc-row-3" : "";
                      return (
                        <tr key={r.user_id || `${r.user_name}-${idx}`} className={rowCls}>
                          <td>
                            <div className="cc-rankpill">#{Number(r.rank || idx + 1)}</div>
                          </td>
                          <td>
                            <div className="cc-agent">{r.user_name}</div>
                            <div className="cc-agent-sub">—</div>
                          </td>
                          <td className="cc-right">{formatNum(r.combat_count)}</td>
                          <td className="cc-right">{formatNum(r.rd_intel_count)}</td>
                          <td className="cc-right">{formatNum(r.training_count)}</td>
                          <td className="cc-right">{formatNum(r.deals_count)}</td>
                          <td className="cc-right">
                            <span className="cc-sp">
                              {formatNum(r.sp)} <SPIcon size={12} color="#3b82f6" />
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Mission distribution side panel */}
          <motion.div className="cc-side" {...cardMotion}>
            <h3 className="cc-card-title" style={{ marginBottom: 10 }}>
              Mission Distribution
            </h3>

            <div className="admin-subtle">
              Training (course/video completions) is ignored for now per your setup.
            </div>

            <div className="cc-insight">
              <strong style={{ color: "white" }}>Insight:</strong> R&amp;D/Intel activities logged:{" "}
              <strong style={{ color: "white" }}>{formatNum(intelCur)}</strong> this period.
            </div>
          </motion.div>

          {/* TV Mode card */}
          <motion.div className="summary-card tv-card" style={{ gridColumn: "1 / -1" }} {...cardMotion}>
            <h3 style={{ marginTop: 0 }}>TV Mode</h3>
            <p className="admin-subtle">Generate a secure, read-only TV screen link for office displays.</p>

            <div className="cc-tv-controls">
              <button type="button" className="admin-btn" onClick={generateTvLink} disabled={tvLoading}>
                {tvLoading ? "Generating…" : "Generate TV Link"}
              </button>

              {tvUrl && (
                <>
                  <button type="button" className="admin-btn ghost" onClick={copyTvLink}>
                    Copy
                  </button>

                  <a href={tvUrl} target="_blank" rel="noreferrer" className="admin-btn link">
                    Open
                  </a>
                </>
              )}

              <button type="button" className="admin-btn ghost" onClick={fetchDashboard}>
                Refresh
              </button>
            </div>

            {tvUrl && (
              <div className="tv-link-wrap">
                <input value={tvUrl} readOnly className="cc-tv-input" />
                <div className="admin-subtle">Keep this link private. Generate a new one if needed.</div>
              </div>
            )}

            {tvMsg && (
              <div className="admin-subtle" style={{ marginTop: 10 }}>
                {tvMsg}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
