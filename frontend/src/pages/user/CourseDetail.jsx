import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import Nav from '../../components/Navbar';
import '../../components/useruistyles/CourseDetail.css';

// compact duration like "1h 02m" / "3m 40s" / "42s"
function fmtShort(sec = 0) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m${s ? ' ' + s + 's' : ''}`;
  return `${s}s`;
}

// hh:mm:ss
function fmtHMS(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [h, m, ss]
    .map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, '0')))
    .join(':');
}

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // live aggregates from /kpi/progress
  const [agg, setAgg] = useState({
    percent: null,
    watchedSeconds: 0,
    perVideo: [],
  });

  const [completedMap, setCompletedMap] = useState({}); // { [assetId]: true }

  // Load static course data (title, videos, etc.)
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        setError('');
        const res = await api.get(`/users/courses/detail/${courseId}`);
        if (!on) return;
        setData(res.data);
      } catch (e) {
        if (!on) return;
        console.error('Failed to load course detail', e);
        setError('Failed to load course details. Please refresh.');
      }
    })();
    return () => {
      on = false;
    };
  }, [courseId]);

  // Load dynamic aggregates: percent, watchedSeconds, perVideo (for completed flags)
  useEffect(() => {
    if (!courseId) return;
    let on = true;
    (async () => {
      try {
        const r = await api.get('/users/kpi/progress', {
          params: { courseId },
        });
        if (!on) return;

        const percent = Number(r?.data?.percent ?? 0);
        const watchedSeconds = Number(r?.data?.watchedSeconds ?? 0);
        const perVideoArr = Array.isArray(r?.data?.perVideo)
          ? r.data.perVideo
          : [];

        setAgg({
          percent: Number.isFinite(percent) ? percent : 0,
          watchedSeconds: Number.isFinite(watchedSeconds) ? watchedSeconds : 0,
          perVideo: perVideoArr,
        });

        // Build completion map for buttons/badges
        const map = {};
        for (const pv of perVideoArr) {
          if (pv?.asset_id != null) map[pv.asset_id] = !!pv.completed;
        }
        setCompletedMap(map);
      } catch (e) {
        // keep page usable even if this call fails
        console.warn('Failed to fetch live progress', e);
      }
    })();
    return () => {
      on = false;
    };
  }, [courseId]);

  if (error) {
    return (
      <div>
        <Nav />
        <div className="cd-wrap">
          <div className="cd-status">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Nav />
        <div className="cd-wrap">
          <div className="cd-status">Loading…</div>
        </div>
      </div>
    );
  }

  // Prefer live percent from KPI; fall back to API percent if not yet loaded
  const percentLive = agg.percent;
  const percentFallback = Number(data?.percent ?? 0);
  const percent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Number.isFinite(percentLive) && percentLive !== null
          ? percentLive
          : percentFallback,
      ),
    ),
  );

  const videos = Array.isArray(data.videos) ? data.videos : [];
  const course = data.course || {};
  const category = course.category || '—';
  const points = Number.isFinite(course.points)
    ? course.points
    : (course.points ?? '—');
  const description =
    (
      course.description ??
      course.long_description ??
      course.overview ??
      course.summary ??
      ''
    )
      .toString()
      .trim() || '—';

  return (
    <div>
      <Nav />
      <div className="cd-wrap">
        {/* Header / Title / Progress */}
        <section className="cd-header">
          <div className="cd-header__inner">
            {/* Title row: title left, Back button right */}
            <div className="cd-header__top">
              <h2 className="cd-title">Course Title: {course.title}</h2>

              <button
                className="cd-back"
                onClick={() => navigate('/dashboard')}
              >
                ← Back to Dashboard
              </button>
            </div>

            {/* Course meta (white, one-per-line) */}
            <div className="cd-meta">
              <div className="cd-meta__row">
                <div className="cd-meta__item">
                  <strong>Category:</strong> {category}
                </div>
              </div>
              <div className="cd-meta__row">
                <div className="cd-meta__item">
                  <strong>Points:</strong> {points}
                </div>
              </div>
              <div className="cd-meta__row">
                <div className="cd-meta__item cd-meta__item--full">
                  <strong>Description:</strong> {description}
                </div>
              </div>
            </div>

            {/* NEW: total time spent under progress */}
            <div className="cd-meta" style={{ marginTop: '0.35rem' }}>
              <div className="cd-meta__row">
                <div className="cd-meta__item">
                  <strong>Time spent:</strong> {fmtHMS(agg.watchedSeconds || 0)}
                </div>
              </div>
            </div>

            <div className="cd-progress">
              <div className="cd-progress__track">
                <div
                  className="cd-progress__fill"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <small className="cd-progress__text">{percent}% complete</small>
            </div>
          </div>
        </section>

        {/* Lessons */}
        <section className="cd-section">
          <div className="cd-section__head">Lessons</div>
          <div className="cd-section__body">
            <div className="cd-video-list">
              {videos.length === 0 ? (
                <div className="cd-empty">No videos yet.</div>
              ) : (
                videos.map((v, i) => {
                  const isCompleted = !!completedMap[v.id];
                  const watchLabel = isCompleted ? 'Watch again' : 'Watch';
                  return (
                    <div className="cd-video" key={v.id} tabIndex={0}>
                      <div className="cd-video__index">{i + 1}.</div>
                      <div className="cd-video__main">
                        <div className="cd-video__title">
                          <span className="cd-video__name">
                            {v.file_name || 'Video'}
                          </span>
                          {isCompleted && (
                            <span className="cd-badge cd-badge--done">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <div className="cd-video__meta">
                          {Number.isFinite(v.duration_seconds) &&
                          v.duration_seconds > 0
                            ? fmtShort(v.duration_seconds)
                            : '–'}
                        </div>
                      </div>
                      <Link
                        to={`/courses/${courseId}/video/${v.id}`}
                        state={{
                          fileName: v.file_name,
                          courseTitle: course.title,
                        }}
                        className={`cd-watch ${isCompleted ? 'cd-watch--again' : ''}`}
                        aria-label={`${watchLabel} ${v.file_name}`}
                        title={watchLabel}
                      >
                        {watchLabel}
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
