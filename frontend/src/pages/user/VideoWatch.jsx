import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api';
import Nav from '../../components/Navbar';
import VideoPlayer from '../../components/VideoPlayer';
import '../../components/useruistyles/VideoWatch.css';

export default function VideoWatch() {
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
    perVideo: {}, // { [assetId]: { lastPosition, duration_seconds, completed } }
  });

  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const videoRef = useRef(null);

  // Helper to coerce serialized booleans safely
  const isTrue = (v) => v === true || v === 'true' || v === 1 || v === '1';

  // Load course + videos + current selection
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

        const current =
          vids.find((v) => String(v.id) === String(assetId)) || vids[0];
        setFileName(current?.file_name || 'Video');
        setCurrentVideo(current);
      } catch (e) {
        if (!on) return;
        console.error('Failed to load course details', e);
        setError('Failed to load video metadata.');
      }
    })();
    return () => {
      on = false;
    };
  }, [courseId, assetId]);

  // Seed aggregates immediately from /kpi/progress
  useEffect(() => {
    if (!courseId) return;
    let on = true;
    (async () => {
      try {
        const res = await api.get(`/users/kpi/progress`, {
          params: { courseId, assetId },
        });
        if (!on) return;

        const percent = Number(res?.data?.percent ?? 0);
        const watchedSeconds = Number(res?.data?.watchedSeconds ?? 0);
        const nextVideoId = res?.data?.nextVideoId || null;
        const nextCourse = res?.data?.nextCourse || null;

        const perVideoArr = Array.isArray(res?.data?.perVideo)
          ? res.data.perVideo
          : [];
        const perVideoMap = {};
        for (const pv of perVideoArr) {
          if (pv?.asset_id != null) {
            perVideoMap[pv.asset_id] = {
              lastPosition: pv.last_position ?? 0,
              duration_seconds: pv.duration_seconds ?? 0,
              completed: !!pv.completed,
            };
          }
        }

        setKpi((prev) => ({
          ...prev,
          percent: Number.isFinite(percent) ? percent : prev.percent,
          totalTimeSpent: Number.isFinite(watchedSeconds)
            ? watchedSeconds
            : prev.totalTimeSpent,
          nextVideoId,
          nextCourse,
          perVideo: perVideoMap,
        }));
      } catch (error) {
        //es-lint-disable-no-empty
      }
    })();
    return () => {
      on = false;
    };
  }, [courseId, assetId]);

  const onSelectVideo = (vId) => {
    const nextVideo = videos.find((v) => v.id === vId);
    if (nextVideo) {
      setFileName(nextVideo.file_name);
      setCurrentVideo(nextVideo);
      navigate(`/courses/${courseId}/video/${vId}`, { replace: true });
    }
  };

  const clampPct = (n) => Math.max(0, Math.min(100, n || 0));

  // Compute visibility of "nextCourse" safely (covers string/number booleans)
  const nc = kpi?.nextCourse;
  const isHidden = isTrue(nc?.hidden); // hidden if true/'true'/1/'1'
  const canShowNextCourse = !!(nc && !isHidden);

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
        }
      }
      next.perVideo = map;
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
      <div className="vw-wrap">
        {/* Header (cap + back on the right) */}
        <div className="vw-header">
          <div className="vw-header-cap">
            <div className="vw-course">Course: {courseTitle || 'Course'}</div>
            <Link
              to="#"
              onClick={(e) => {
                e.preventDefault();
                navigate(-1);
              }}
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

          {/* RIGHT: Overview + Next recommended */}
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
                    {videos.find((v) => v.id === kpi.nextVideoId)?.file_name ||
                      'Next Video'}
                  </button>
                </>
              ) : (
                canShowNextCourse && (
                  <>
                    <h4>Next Course in “{nc.category}”</h4>
                    <div className="vw-next-course">
                      <div className="vw-next-course__title">{nc.title}</div>
                      <div className="vw-next-course__meta">
                        {nc.points != null ? `${nc.points} pts` : null}
                      </div>
                      <button
                        className="vw-next-btn"
                        onClick={() => navigate(`/courses/detail/${nc.id}`)}
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
          <div
            className={`vw-playlist vw-playlist--full ${collapsed ? '' : 'is-collapsed'}`}
          >
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
                  ? clampPct(
                      Math.round(
                        ((pv.lastPosition || 0) / v.duration_seconds) * 100,
                      ),
                    )
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
