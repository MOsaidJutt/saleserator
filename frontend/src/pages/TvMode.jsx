import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import "../components/TvMode.css";

const PERIODS = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
  { key: "all", label: "All Time" },
];

function normalizeRow(r) {
  const name = r?.name || r?.email || "Unknown";
  const points = Number(r?.total_points ?? r?.points ?? 0) || 0;
  const rank = Number(r?.rank ?? 0) || 0;
  return { name, points, rank };
}

function formatPoints(n) {
  return (Number(n) || 0).toLocaleString();
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Get backend origin for SSE.
 * - If you have REACT_APP_API_ORIGIN=http://localhost:5000 in frontend .env, it will use that.
 * - Otherwise it tries to infer from axios baseURL.
 * - Fallback: http://localhost:5000
 */
function getApiOriginFromAxios(apiInstance) {
  try {
    const baseURL = apiInstance?.defaults?.baseURL;
    if (!baseURL) return "http://localhost:5000";
    const u = new URL(baseURL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:5000";
  }
}

export default function TvMode() {
  const [period, setPeriod] = useState("daily");
  const [rows, setRows] = useState([]);
  const [ticker, setTicker] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [dealBanner, setDealBanner] = useState(null); // { id, userName, points }
  const [spPopups, setSpPopups] = useState([]); // { id, userName, points }

  // ✅ NEW: rank up overlay
  const [rankUpBanner, setRankUpBanner] = useState(null); 
  // { id, userName, prevRank, newRank, totalSp }

  const bannerTimerRef = useRef(null);
  const rankTimerRef = useRef(null);

  const token = useMemo(() => new URLSearchParams(window.location.search).get("token"), []);

  const normalized = useMemo(() => rows.map(normalizeRow), [rows]);
  const top10 = useMemo(() => [...normalized].sort((a, b) => b.points - a.points).slice(0, 10), [normalized]);
  const top3 = useMemo(() => top10.slice(0, 3), [top10]);

  const pushTicker = (text, kind = "boost") => {
    setTicker((prev) => {
      const next = [{ id: `${Date.now()}-${Math.random()}`, time: nowTime(), text, kind }, ...prev];
      return next.slice(0, 14);
    });
  };

  const spawnSpPopup = (userName, points) => {
    const id = `${Date.now()}-${Math.random()}`;
    setSpPopups((prev) => [...prev, { id, userName, points }]);
    window.setTimeout(() => {
      setSpPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1400);
  };

  const showDealBanner = (userName, points) => {
    const id = `${Date.now()}-${Math.random()}`;
    setDealBanner({ id, userName, points });
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setDealBanner(null), 2200);
  };

  // ✅ NEW: Rank up banner
  const showRankUpBanner = (userName, prevRank, newRank, totalSp) => {
    const id = `${Date.now()}-${Math.random()}`;
    setRankUpBanner({ id, userName, prevRank, newRank, totalSp });

    if (rankTimerRef.current) window.clearTimeout(rankTimerRef.current);
    rankTimerRef.current = window.setTimeout(() => setRankUpBanner(null), 3800);
  };

  const fetchLeaderboard = async (opts = {}) => {
    if (!token) {
      setErr("TV token missing. Open this screen using the generated TV URL.");
      setLoading(false);
      return;
    }

    setErr("");
    try {
      const res = await api.get("/tv/leaderboard", {
        params: { period, ...(opts.refresh ? { refresh: 1 } : {}) },
        headers: { "x-tv-token": token },
      });

      const list = Array.isArray(res?.data?.results) ? res.data.results : [];
      setRows(list);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (e) {
      console.error(e);
      setErr("Failed to load TV Mode data (invalid token, period, or server error).");
      setLoading(false);
    }
  };

  // Poll
  useEffect(() => {
    let alive = true;
    setLoading(true);

    (async () => {
      if (!alive) return;
      await fetchLeaderboard();
    })();

    const interval = window.setInterval(() => {
      if (!alive) return;
      fetchLeaderboard();
    }, 12000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // ✅ SSE events (LIVE FEED)
  useEffect(() => {
    if (!token) return;

    const API_ORIGIN =
      process.env.REACT_APP_API_ORIGIN ||
      getApiOriginFromAxios(api);

    const esUrl = `${API_ORIGIN}/tv/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(esUrl);

    es.onopen = () => {
      // console.log("SSE connected:", esUrl);
    };

    es.addEventListener("activity_logged", (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const userName = data?.userName || data?.name || "Someone";
        const points = Number(data?.points || data?.awardedPoints || 0);

        if (points > 0) {
          spawnSpPopup(userName, points);
          pushTicker(`${userName} +${formatPoints(points)} SP`, points >= 500 ? "deal" : "boost");
          fetchLeaderboard();
        }
      } catch {}
    });

    es.addEventListener("deal_closed", (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const userName = data?.userName || data?.name || "Someone";
        const points = Number(data?.points || data?.awardedPoints || 0);

        showDealBanner(userName, points);
        pushTicker(`${userName} CLOSED A DEAL! +${formatPoints(points)} SP`, "deal");
        fetchLeaderboard();
      } catch {}
    });

    // ✅ NEW: rank_up event
    es.addEventListener("rank_up", (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const userName = data?.userName || "Someone";
        const prevRank = data?.prevRank || "Rookie";
        const newRank = data?.newRank || "Rookie";
        const totalSp = Number(data?.totalSp || 0);

        showRankUpBanner(userName, prevRank, newRank, totalSp);
        pushTicker(`${userName} RANKED UP! ${prevRank} → ${newRank}`, "deal");

        // make leaderboard feel instant
        fetchLeaderboard();
      } catch {}
    });

    es.addEventListener("ping", () => {});
    es.onerror = () => {
      // console.log("SSE error (will auto-reconnect)");
    };

    return () => {
      es.close();
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
      if (rankTimerRef.current) window.clearTimeout(rankTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, period]);

  return (
    <div className="tv-root">
      {/* ✅ NEW: Big centered Rank Up overlay */}
      {rankUpBanner && (
        <div className="tv-rankup-overlay" key={rankUpBanner.id} aria-hidden="true">
          <div className="tv-rankup-card">
            <div className="tv-rankup-title">RANK UP</div>
            <div className="tv-rankup-name">{rankUpBanner.userName}</div>
            <div className="tv-rankup-sub">
              {rankUpBanner.prevRank} → <strong>{rankUpBanner.newRank}</strong>
            </div>
            <div className="tv-rankup-foot">{formatPoints(rankUpBanner.totalSp)} SP</div>
          </div>
        </div>
      )}

      {dealBanner && (
        <div className="tv-deal-banner" key={dealBanner.id}>
          <div className="tv-deal-title">DEAL CLOSED</div>
          <div className="tv-deal-sub">
            {dealBanner.userName} • +{formatPoints(dealBanner.points)} SP
          </div>
        </div>
      )}

      <div className="tv-popup-layer" aria-hidden="true">
        {spPopups.map((p) => (
          <div key={p.id} className="tv-sp-popup">
            <span className="tv-sp-popup-name">{p.userName}</span>
            <span className="tv-sp-popup-points">+{formatPoints(p.points)} SP</span>
          </div>
        ))}
      </div>

      <div className="tv-wrap">
        <header className="tv-header">
          <div>
            <div className="tv-title">TV MODE</div>
            <div className="tv-sub">Live Leaderboard Broadcast</div>
          </div>

          <div className="tv-controls">
            <div className="tv-period">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  className={`tv-chip ${period === p.key ? "active" : ""}`}
                  onClick={() => setPeriod(p.key)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="tv-meta">
              <span className="tv-dot" />
              <span>
                {err
                  ? err
                  : lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Loading…"}
              </span>
            </div>
          </div>
        </header>

        <main className="tv-main">
          <section className="tv-left">
            <div className="tv-card">
              <div className="tv-card-head">
                <div className="tv-card-title">PODIUM</div>
                <div className="tv-card-hint">Top 3</div>
              </div>

              <div className="tv-podium">
                <Podium place={2} row={top3[1]} />
                <Podium place={1} row={top3[0]} />
                <Podium place={3} row={top3[2]} />
              </div>
            </div>

            <div className="tv-card">
              <div className="tv-card-head">
                <div className="tv-card-title">TOP 10</div>
                <div className="tv-card-hint">{PERIODS.find((p) => p.key === period)?.label}</div>
              </div>

              {loading ? (
                <div className="tv-empty">Loading leaderboard…</div>
              ) : top10.length === 0 ? (
                <div className="tv-empty">No leaderboard data yet.</div>
              ) : (
                <ol className="tv-list">
                  {top10.map((r, idx) => (
                    <li key={`${r.name}-${idx}`} className="tv-row">
                      <div className="tv-rank">#{idx + 1}</div>
                      <div className="tv-name">{r.name}</div>
                      <div className="tv-points">{formatPoints(r.points)} SP</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="tv-right">
            <div className="tv-card">
              <div className="tv-card-head">
                <div className="tv-card-title">LIVE FEED</div>
                <div className="tv-card-hint">Big moments</div>
              </div>

              {ticker.length === 0 ? (
                <div className="tv-empty">Waiting for activity…</div>
              ) : (
                <ul className="tv-feed">
                  {ticker.map((t) => (
                    <li key={t.id} className={`tv-feed-item ${t.kind}`}>
                      <div className="tv-feed-time">{t.time}</div>
                      <div className="tv-feed-text">{t.text}</div>
                      <div className="tv-feed-tag">{t.kind === "deal" ? "DEAL" : "BOOST"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="tv-foot">Shortcuts: 1=Today, 2=Week, 3=Month, 4=All, R=Refresh</div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Podium({ place, row }) {
  const name = row?.name ?? "—";
  const points = row?.points ?? 0;

  return (
    <div className={`podium p${place}`}>
      <div className="podium-top">
        <div className="podium-place">#{place}</div>
        <div className="podium-name">{name}</div>
        <div className="podium-points">{formatPoints(points)} SP</div>
      </div>
      <div className="podium-base" />
    </div>
  );
}
