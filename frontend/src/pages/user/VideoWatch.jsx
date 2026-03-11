import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api';
import Nav from '../../components/Navbar';
import VideoPlayer from '../../components/VideoPlayer';
import '../../components/useruistyles/VideoWatch.css';
import { useAuth } from '../../context/AuthContext';

// ─── SP Icon (same as ActivityForm) ───────────────────────────────
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

// ─── Confetti burst ────────────────────────────────────────────────
function ConfettiBurst() {
  const colors = ['#00c1de', '#ff3b3b', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
  const pieces = Array.from({ length: 48 }, (_, i) => {
    const color = colors[i % colors.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const duration = 1.2 + Math.random() * 0.8;
    const size = 6 + Math.random() * 8;
    return { color, left, delay, duration, size, id: i };
  });

  return (
    <div className="vw-confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="vw-confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function VideoWatch() {
  const { user } = useAuth();
  const slug = user?.company_slug;

  const { courseId, assetId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const initialName = location?.state?.fileName || null;
  const initialCourseTitle = location?.state?.courseTitle || null;

  const [fileName, setFileName] = useState(initialName);
  const [courseTitle, setCourseTitle] = useState(initialCourseTitle);
  const [error, setError] = useState('');

  const [kpi, setKpi] = useState({
    percent: 0,
    totalTimeSpent: 0,
    nextVideoId: null,
    nextCourse: null,
    perVideo: {},
  });

  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const videoRef = useRef(null);

  // ─── Popup state ───────────────────────────────────────────────
  const [spPopups, setSpPopups] = useState([]);
  const popupIdRef = useRef(1);

  // Video complete — small centered toast
  const [videoCompletePopup, setVideoCompletePopup] = useState(null); // { pts }
  const videoTimerRef = useRef(null);

  // Course complete — big overlay with confetti
  const [courseCompletePopup, setCourseCompletePopup] = useState(null); // { pts }
  const courseTimerRef = useRef(null);

  // Track which asset IDs and course we've already shown popups for
  const shownVideoIds = useRef(new Set());
  const shownCourseComplete = useRef(false);

  const VIDEO_PTS = 5;
  const COURSE_PTS = 50;

  const spawnSpPopup = useCallback((pts, color = '#00c1de') => {
    const id = `${Date.now()}-${popupIdRef.current++}`;
    // spawn near center of player
    const x = window.innerWidth * 0.35;
    const y = window.innerHeight * 0.4;
    setSpPopups((prev) => [...prev, { id, x, y, pts, color }]);
    window.setTimeout(() => {
      setSpPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1400);
  }, []);

  const showVideoComplete = useCallback((pts) => {
    setVideoCompletePopup({ pts });
    if (videoTimerRef.current) window.clearTimeout(videoTimerRef.current);
    videoTimerRef.current = window.setTimeout(() => setVideoCompletePopup(null), 2400);
    spawnSpPopup(pts, '#00c1de');
  }, [spawnSpPopup]);

  const showCourseComplete = useCallback((pts) => {
    setCourseCompletePopup({ pts });
    if (courseTimerRef.current) window.clearTimeout(courseTimerRef.current);
    courseTimerRef.current = window.setTimeout(() => setCourseCompletePopup(null), 4000);
    spawnSpPopup(pts, '#22c55e');
  }, [spawnSpPopup]);

  // ─── Load course + videos ──────────────────────────────────────
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const res = await api.get(`/users/courses/detail/${courseId}`);
        if (!on) return;
        const data = res.data;
        setCourseTitle(data?.course?.title || 'Course');
        const vids = Array.isArray(data?.videos) ? data.videos : [];
        setVideos(vids);
        const current = vids.find((v) => String(v.id) === String(assetId)) || vids[0];
        setFileName(current?.file_name || 'Video');
        setCurrentVideo(current);
      } catch (e) {
        if (!on) return;
        setError('Failed to load video metadata.');
      }
    })();
    return () => { on = false; };
  }, [courseId, assetId]);

  // ─── Seed KPI from /kpi/progress ──────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    let on = true;
    (async () => {
      try {
        const res = await api.get(`/users/kpi/progress`, { params: { courseId, assetId } });
        if (!on) return;

        const percent = Number(res?.data?.percent ?? 0);
        const watchedSeconds = Number(res?.data?.watchedSeconds ?? 0);
        const nextVideoId = res?.data?.nextVideoId || null;
        const nextCourse = res?.data?.nextCourse || null;

        const perVideoArr = Array.isArray(res?.data?.perVideo) ? res.data.perVideo : [];
        const perVideoMap = {};
        for (const pv of perVideoArr) {
          if (pv?.asset_id != null) {
            perVideoMap[pv.asset_id] = {
              lastPosition: pv.last_position ?? 0,
              duration_seconds: pv.duration_seconds ?? 0,
              completed: !!pv.completed,
            };
            // Pre-mark already completed videos so we don't re-popup them
            if (pv.completed) shownVideoIds.current.add(pv.asset_id);
          }
        }

        // Pre-mark course if already complete
        if (percent >= 100) shownCourseComplete.current = true;

        setKpi((prev) => ({
          ...prev,
          percent: Number.isFinite(percent) ? percent : prev.percent,
          totalTimeSpent: Number.isFinite(watchedSeconds) ? watchedSeconds : prev.totalTimeSpent,
          nextVideoId,
          nextCourse,
          perVideo: perVideoMap,
        }));
      } catch {}
    })();
    return () => { on = false; };
  }, [courseId, assetId]);

  const isTrue = (v) => v === true || v === 'true' || v === 1 || v === '1';

  const onSelectVideo = (vId) => {
    const nextVideo = videos.find((v) => v.id === vId);
    if (nextVideo) {
      setFileName(nextVideo.file_name);
      setCurrentVideo(nextVideo);
      navigate(`/${slug}/courses/${courseId}/video/${vId}`, { replace: true });
    }
  };

  const clampPct = (n) => Math.max(0, Math.min(100, n || 0));

  const nc = kpi?.nextCourse;
  const isHidden = isTrue(nc?.hidden);
  const canShowNextCourse = !!(nc && !isHidden);

  // ─── applyTimePatch — detect completions and fire popups ──────
  function applyTimePatch(prev, patch) {
    const next = { ...prev, ...patch };

    const ws = Number(patch.watchedSeconds ?? patch.watched_seconds);
    const dw = Number(patch.deltaWatched ?? patch.delta_watched);

    if (Number.isFinite(ws)) {
      next.totalTimeSpent = ws;
    } else if (Number.isFinite(dw) && dw > 0) {
      next.totalTimeSpent = (Number(prev.totalTimeSpent) || 0) + dw;
    }

    if (Array.isArray(patch.perVideo)) {
      const map = {};
      for (const pv of patch.perVideo) {
        if (pv?.asset_id != null) {
          map[pv.asset_id] = {
            lastPosition: pv.last_position ?? 0,
            duration_seconds: pv.duration_seconds ?? 0,
            completed: !!pv.completed,
          };

          // Fire video complete popup — only once per asset
          if (pv.completed && !shownVideoIds.current.has(pv.asset_id)) {
            shownVideoIds.current.add(pv.asset_id);
            showVideoComplete(VIDEO_PTS);
          }
        }
      }
      next.perVideo = map;
    }

    // Fire course complete popup — only once
    const newPercent = Number(patch.percent ?? next.percent ?? 0);
    const prevPercent = Number(prev.percent ?? 0);
    if (newPercent >= 100 && prevPercent < 100 && !shownCourseComplete.current) {
      shownCourseComplete.current = true;
      showCourseComplete(COURSE_PTS);
    }

    delete next.watchedSeconds;
    delete next.watched_seconds;
    delete next.deltaWatched;
    delete next.delta_watched;

    return next;
  }

  function formatHMS(sec) {
    const s = Math.floor(sec || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return [h, m, ss]
      .map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, '0')))
      .join(':');
  }

  return (
    <div>
      <Nav />

      {/* ── SP floating popups ─────────────────────────────────── */}
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

      {/* ── Video complete toast ───────────────────────────────── */}
      {videoCompletePopup && (
        <div className="vw-vc-toast" aria-live="polite">
          <div className="vw-vc-toast__icon">✓</div>
          <div className="vw-vc-toast__text">
            <span className="vw-vc-toast__title">Video Complete!</span>
            <span className="vw-vc-toast__pts">
              +{videoCompletePopup.pts} <SPIcon size={14} color="#00c1de" />
            </span>
          </div>
        </div>
      )}

      {/* ── Course complete overlay ────────────────────────────── */}
      {courseCompletePopup && (
        <div className="vw-cc-overlay" aria-live="polite">
          <ConfettiBurst />
          <div className="vw-cc-card">
            <div className="vw-cc-burst" aria-hidden="true" />
            <div className="vw-cc-emoji">🏆</div>
            <div className="vw-cc-title">Course Complete!</div>
            <div className="vw-cc-sub">
              You finished <strong>{courseTitle}</strong>
            </div>
            <div className="vw-cc-pts">
              +{courseCompletePopup.pts} <SPIcon size={22} color="#22c55e" />
            </div>
            <div className="vw-cc-foot">Keep pushing. Next course awaits.</div>
          </div>
        </div>
      )}

      <div className="vw-wrap">
        {/* Header */}
        <div className="vw-header">
          <div className="vw-header-cap">
            <div className="vw-course">Course: {courseTitle || 'Course'}</div>
            <Link
              to="#"
              onClick={(e) => { e.preventDefault(); navigate(-1); }}
              className="vw-back"
            >
              <span aria-hidden>←</span> Back
            </Link>
          </div>
          <div className="vw-title">Video Title: {fileName || 'Video'}</div>
        </div>

        {error && <div className="vw-alert">{error}</div>}

        {/* Main layout 70/30 */}
        <section className="vw-main">
          {/* LEFT: player */}
          <div className="vw-left">
            <div className="vw-player-frame">
              <div className="vw-player__box">
                <VideoPlayer
                  ref={videoRef}
                  courseId={courseId}
                  assetId={assetId}
                  setData={(patchOrFn) => {
                    if (typeof patchOrFn === 'function') {
                      setKpi((prev) => {
                        const patch = patchOrFn(prev) || {};
                        return applyTimePatch(prev, patch);
                      });
                    } else if (patchOrFn && typeof patchOrFn === 'object') {
                      setKpi((prev) => applyTimePatch(prev, patchOrFn));
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Overview */}
          <aside className="vw-right">
            <div className="vw-panel">
              <h3>Progress Overview</h3>
              <div className="vw-stats">
                <p>
                  <strong>Course completion:</strong>{' '}
                  {Math.round(clampPct(kpi.percent || 0))}%
                </p>
                <div className="vw-bar">
                  <div
                    className="vw-bar-fill"
                    style={{ width: `${clampPct(kpi.percent || 0)}%` }}
                  />
                </div>
              </div>
              <div className="vw-stats">
                <p>
                  <strong>Time spent:</strong>{' '}
                  {formatHMS(kpi.totalTimeSpent || 0)}
                </p>
              </div>

              {kpi.nextVideoId ? (
                <>
                  <h4>Next Recommended Video</h4>
                  <button
                    className="vw-next-btn"
                    onClick={() => onSelectVideo(kpi.nextVideoId)}
                  >
                    {videos.find((v) => v.id === kpi.nextVideoId)?.file_name || 'Next Video'}
                  </button>
                </>
              ) : (
                canShowNextCourse && (
                  <>
                    <h4>Next Course in "{nc.category}"</h4>
                    <div className="vw-next-course">
                      <div className="vw-next-course__title">{nc.title}</div>
                      <div className="vw-next-course__meta">
                        {nc.points != null ? `${nc.points} pts` : null}
                      </div>
                      <button
                        className="vw-next-btn"
                        onClick={() => navigate(`/${slug}/courses/detail/${nc.id}`)}
                      >
                        Go to course
                      </button>
                    </div>
                  </>
                )
              )}
            </div>
          </aside>

          {/* FULL-WIDTH PLAYLIST */}
          <div className={`vw-playlist vw-playlist--full ${collapsed ? '' : 'is-collapsed'}`}>
            <div className="vw-playlist__head">
              <h3>Video List</h3>
              <button
                type="button"
                className="vw-playlist__toggle"
                onClick={() => setCollapsed((s) => !s)}
                aria-expanded={!collapsed}
                aria-controls="vw-playlist-body"
                title={collapsed ? 'Expand list' : 'Collapse list'}
              >
                {collapsed ? 'Collapse' : 'Expand'}
              </button>
            </div>

            <div id="vw-playlist-body" className="vw-playlist__body">
              {videos.map((v) => {
                const pv = kpi?.perVideo?.[v.id] || {};
                const pct = v.duration_seconds
                  ? clampPct(Math.round(((pv.lastPosition || 0) / v.duration_seconds) * 100))
                  : 0;
                const isActive = String(v.id) === String(currentVideo?.id);
                return (
                  <button
                    key={v.id}
                    onClick={() => onSelectVideo(v.id)}
                    className={`vw-item ${isActive ? 'active' : ''} ${pv.completed ? 'done' : ''}`}
                    aria-label={`Play ${v.file_name}`}
                  >
                    <div className="vw-item-text">
                      <div className="vw-item-title">{v.file_name}</div>
                      <div className="vw-item-meta">
                        {pv.completed ? '✓ Completed' : `${pct}%`} •{' '}
                        {formatHMS(v.duration_seconds)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}