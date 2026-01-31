import React, { useEffect, useRef, useState } from 'react';
import Nav from '../../components/Navbar';
import api from '../../api';
import '../../components/useruistyles/ActivityForm.css';

const LABELS = {
  calls: 'Cold Call',
  emails: 'Sent Email',
  textMessages: 'Text Message',
  appointments: 'Booked Meeting',
  presentations: 'Presentation',
  deals: 'Closed Deal',
  socialMediaPosts: 'Social Media Post',
  networkingEvents: 'Networking Event',
  doorsKnocked: 'Doors Knocked',
  referralsReceived: 'Referrals Received',
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const CATEGORIES = [
  { key: 'combat', label: 'Combat Ops' },
  { key: 'intel', label: 'R&D / Intel' },
  { key: 'training', label: 'Training' },
];

const MISSIONS_BY_CATEGORY = {
  combat: [
    { key: 'calls', accent: 'cyan' },
    { key: 'emails', accent: 'cyan' },
    { key: 'appointments', accent: 'blue' },
    { key: 'textMessages', accent: 'cyan' },
    { key: 'doorsKnocked', accent: 'cyan' },
    { key: 'presentations', accent: 'blue' },
    { key: 'deals', accent: 'red' },
  ],
  intel: [
    { key: 'socialMediaPosts', accent: 'cyan' },
    { key: 'networkingEvents', accent: 'blue' },
    { key: 'referralsReceived', accent: 'blue' },
  ],
  training: [],
};

const clampInt = (n) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SPIcon({ size = 16, color = '#00c1de' }) {
  const w = size;
  const h = Math.round(size * 1.2);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 120"
      fill="none"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path d="M50 5 L90 27.5 L90 72.5 L50 95 L10 72.5 L10 27.5 Z" fill={color} />
      <path
        d="M50 25 C35 25 30 30 30 40 C30 50 35 52 45 55 C52 57 55 58 55 63 C55 68 52 70 45 70 C38 70 35 68 32 65 L25 75 C30 80 37 82 45 82 C58 82 67 77 67 63 C67 50 60 48 50 45 C43 43 42 42 42 38 C42 34 45 32 50 32 C55 32 58 34 60 37 L68 28 C63 23 57 25 50 25 Z"
        fill="white"
      />
    </svg>
  );
}

export default function ActivityPage() {
  const [date] = useState(todayStr());
  const [weights, setWeights] = useState(null);
  const [tab, setTab] = useState('combat');

  const [recent, setRecent] = useState([]);
  const [notice, setNotice] = useState('');
  const [savingKey, setSavingKey] = useState(null);

  // REAL source for today's total (fixes the 12-item cap bug)
  const [todayTotal, setTodayTotal] = useState(0);

  // animated number shown in UI
  const [displayTotal, setDisplayTotal] = useState(0);
  const animRef = useRef(null);

  // SP popups
  const [spPopups, setSpPopups] = useState([]);
  const popupIdRef = useRef(1);

  // Level-up popup (big centered)
  const [levelPopup, setLevelPopup] = useState(null); // {from,to}
  const levelTimerRef = useRef(null);

  const ptsEach = (key) => clampInt(Number(weights?.[key] || 0));

  const popupColorFor = (key) => {
    if (key === 'deals') return '#ff3b3b';
    if (key === 'appointments' || key === 'presentations') return '#3b82f6';
    return '#00c1de';
  };

  const spawnSpPopup = (x, y, pts, label, color) => {
    const id = `${Date.now()}-${popupIdRef.current++}`;
    setSpPopups((prev) => [...prev, { id, x, y, pts, label, color }]);
    window.setTimeout(() => {
      setSpPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1200);
  };

  const showLevelUpCenter = (from, to) => {
    setLevelPopup({ from, to });
    if (levelTimerRef.current) window.clearTimeout(levelTimerRef.current);
    levelTimerRef.current = window.setTimeout(() => setLevelPopup(null), 2600);
  };

  // Animate displayTotal -> todayTotal
  useEffect(() => {
    const start = displayTotal;
    const end = todayTotal;
    if (start === end) return;

    const duration = 450;
    const t0 = performance.now();

    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(start + (end - start) * eased);
      setDisplayTotal(val);
      if (p < 1) animRef.current = requestAnimationFrame(step);
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [todayTotal]);

  // Load weights
  useEffect(() => {
    let on = true;

    (async () => {
      try {
        const res = await api.get('/users/activity/weights');
        if (!on) return;
        setWeights(res.data || null);
      } catch {
        if (!on) return;
        setWeights({
          calls: 2,
          emails: 1,
          textMessages: 1,
          appointments: 10,
          presentations: 15,
          deals: 50,
          socialMediaPosts: 3,
          networkingEvents: 20,
          doorsKnocked: 3,
          referralsReceived: 25,
        });
      }
    })();

    return () => {
      on = false;
      if (levelTimerRef.current) window.clearTimeout(levelTimerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Hydrate today's total + recent (fix refresh reset)
  useEffect(() => {
    let on = true;

    (async () => {
      try {
        const [todayRes, recentRes] = await Promise.all([
          api.get(`/users/activity/today?date=${date}`),
          api.get(`/users/activity/recent?date=${date}&limit=12`),
        ]);

        if (!on) return;

        const total = clampInt(todayRes?.data?.totalToday ?? 0);
        setTodayTotal(total);
        setDisplayTotal(total);

        const items = Array.isArray(recentRes?.data?.items) ? recentRes.data.items : [];
        const built = items.map((it) => {
          const typeTitle = String(it.activityType || '').trim();
          const recoveredKey =
            Object.keys(LABELS).find((k) => LABELS[k] === typeTitle) || null;

          const key = recoveredKey || 'misc';
          const pts = clampInt(it.points);
          const color = recoveredKey ? popupColorFor(recoveredKey) : '#00c1de';

          return {
            at: `${it.activityId || Date.now()}`,
            time: nowTime(), // without created_at we can't reconstruct exact time
            key,
            label: recoveredKey ? LABELS[recoveredKey] : typeTitle || 'Activity',
            pts,
            color,
          };
        });

        setRecent(built);
      } catch (err) {
        console.error('Hydrate mission log failed', err);
      }
    })();

    return () => {
      on = false;
    };
  }, [date]);

  const logOne = async (e, key) => {
    setNotice('');
    if (!weights) return;

    const value = 1;
    const predictedPts = ptsEach(key) * value;

    setSavingKey(key);

    // coords for SP popup only
    let x = e?.clientX;
    let y = e?.clientY;
    if ((!x || !y) && e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
    x = x ?? window.innerWidth / 2;
    y = y ?? window.innerHeight / 2;

    try {
      const payload = { activityType: key, value, dateLogged: date };
      const res = await api.post('/users/activity/log', payload);

      const awarded = clampInt(res?.data?.awardedPoints ?? predictedPts);

      // ✅ FIX: todayTotal grows forever, not capped by 12 recent items
      setTodayTotal((prev) => prev + awarded);

      // SP popup
      const color = popupColorFor(key);
      spawnSpPopup(x, y, awarded, LABELS[key] || key, color);

      // recent list display only
      setRecent((prev) =>
        [
          {
            at: new Date().toISOString(),
            time: nowTime(),
            key,
            label: LABELS[key] || key,
            pts: awarded,
            color,
          },
          ...prev,
        ].slice(0, 12),
      );

      // big center level-up popup (only if backend says rankedUp)
      const backendRank = res?.data?.rank;

      // TEMP DEBUG (keep until you see it working once)
      console.log('rank payload:', backendRank);

      // rankedUp might be boolean true, or 1, or "true" depending on serialization
      const rankedUp =
        backendRank?.rankedUp === true ||
        backendRank?.rankedUp === 1 ||
        backendRank?.rankedUp === 'true';

      if (backendRank && rankedUp) {
        showLevelUpCenter(
          backendRank.prevRankName || 'Rookie',
          backendRank.rankName || 'Rookie'
        );
      }
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error;
      setNotice(msg ? String(msg) : 'Failed to log activity. Please try again.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="page-root activity-page">
      <Nav />

      {/* SP popup layer */}
      <div className="ml-popup-layer" aria-hidden="true">
        {spPopups.map((p) => (
          <div
            key={p.id}
            className="ml-sp-popup"
            style={{ left: p.x, top: p.y, color: p.color }}
          >
            <span className="ml-sp-popup-points">+{p.pts}</span>
            <SPIcon size={34} color={p.color} />
          </div>
        ))}
      </div>

      {/* BIG CENTER LEVEL UP (outside popup layer so it always shows) */}
      {levelPopup && (
        <div className="ml-lv-overlay" aria-hidden="true">
          <div className="ml-lv-card">
            <div className="ml-lv-burst" aria-hidden="true" />
            <div className="ml-lv-title">LEVEL UP</div>
            <div className="ml-lv-sub">
              {levelPopup.from} → <strong>{levelPopup.to}</strong>
            </div>
            <div className="ml-lv-foot">New rank unlocked. Keep pushing.</div>
          </div>
        </div>
      )}

      <div className="page-wrap activity-wrap">
        <section className="ml-panel">
          <header className="ml-head">
            <h1 className="ml-title">Mission Log</h1>
            <p className="ml-sub">
              Select a category and log your activities to earn SP.
            </p>

            <div className="ml-topbar">
              <div className="ml-total">
                <span className="k">Total SP Today</span>
                <span className="v">{displayTotal}</span>
              </div>

              <div className="ml-tabs">
                {CATEGORIES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`ml-tab ${tab === t.key ? 'active' : ''}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="ml-body">
            {notice && <div className="ml-notice error">{notice}</div>}

            <div className="ml-grid">
              {(MISSIONS_BY_CATEGORY[tab] || []).length === 0 ? (
                <div className="ml-empty">Training missions coming soon.</div>
              ) : (
                (MISSIONS_BY_CATEGORY[tab] || []).map((m) => {
                  const label = LABELS[m.key] || m.key;
                  const pts = ptsEach(m.key);
                  const busy = savingKey === m.key;

                  return (
                    <button
                      key={m.key}
                      type="button"
                      className={`ml-card ${m.accent} ${busy ? 'busy' : ''}`}
                      onClick={(ev) => logOne(ev, m.key)}
                      disabled={!weights || !!savingKey}
                      aria-busy={busy}
                      title="Click to log this activity"
                    >
                      <div className="ml-card-left">
                        <div className="ml-card-title">{label}</div>
                        <div className="ml-card-sub">Click to log this activity</div>
                      </div>

                      <div className="ml-card-right">
                        <div className="ml-pill">
                          +{pts}
                          <SPIcon size={16} color={popupColorFor(m.key)} />
                        </div>
                      </div>

                      <span className="ml-charge" aria-hidden="true" />
                    </button>
                  );
                })
              )}
            </div>

            <section className="ml-recent">
              <div className="ml-recent-head">
                <span className="dot" />
                <h2>Recent Activity</h2>
              </div>

              {recent.length === 0 ? (
                <div className="ml-recent-empty">
                  No activity logged yet today. Get to work, soldier!
                </div>
              ) : (
                <ul className="ml-recent-list">
                  {recent.map((r, i) => (
                    <li key={`${r.at}-${i}`} className="ml-recent-item">
                      <div className="ml-recent-left">
                        <span className="ml-check" aria-hidden="true">
                          ✓
                        </span>
                        <div className="ml-recent-meta">
                          <span className="name">{r.label}</span>
                          <span className="time">{r.time}</span>
                        </div>
                      </div>

                      <span className="pts" style={{ color: r.color }}>
                        +{r.pts} <SPIcon size={14} color={r.color} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
