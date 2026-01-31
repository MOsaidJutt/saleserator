import React, { useEffect, useRef, useState, forwardRef } from 'react'; // Ensure React is imported
import api from '../api';

function makeSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function throttle(fn, wait) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
}

const VideoPlayer = forwardRef(function VideoPlayer(
  { courseId, assetId, setData, videoRef, onComplete }, // Ensure onComplete is passed as a prop
  forwardedRef,
) {
  const internalRef = useRef(null);
  const ref = forwardedRef || videoRef || internalRef;

  const hbTimerRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const sessionIdRef = useRef(makeSessionId());
  const completedOnceRef = useRef(false);

  const [src, setSrc] = useState(null);
  const [error, setError] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  const pushUp = (patch) => {
    if (typeof setData === 'function') setData(patch);
  };

  // Fetch stream URL on asset change
  useEffect(() => {
    let on = true;
    setError('');
    setSrc(null);
    (async () => {
      try {
        const res = await api.get(`/users/courses/asset/${assetId}/stream-url`);
        if (!on) return;
        const url = res?.data?.url;
        setSrc(url || null);
        if (!url) setError('No video URL returned for this asset.');
      } catch (e) {
        if (!on) return;
        console.error('Failed to fetch stream URL', e);
        setError('Failed to fetch video URL.');
      }
    })();
    return () => {
      on = false;
    };
  }, [assetId]);

  // Optionally pull percent/watchedSeconds periodically (and nextCourse if provided)
  const fetchProgress = async (silent = true) => {
    try {
      const res = await api.get(`/user/kpi/progress`, {
        params: { courseId, assetId },
      });
      const percent = Number(res?.data?.percent ?? 0);
      const watchedSeconds = Number(res?.data?.watchedSeconds ?? 0);
      const nextCourse = res?.data?.nextCourse || null;
      const patch = {};
      if (Number.isFinite(percent)) patch.percent = percent;
      if (Number.isFinite(watchedSeconds))
        patch.watchedSeconds = watchedSeconds;
      if (nextCourse) patch.nextCourse = nextCourse;
      if (Object.keys(patch).length) pushUp(patch);
      if (!silent) console.debug('progress percent', percent);
    } catch {
      /* ignore */
    }
  };

  // Post KPI event
  const postEvent = async (el, event) => {
    const positionSec = Math.floor(el?.currentTime || 0);
    const durationSec = Math.max(1, Math.floor(el?.duration || 0));
    if (!(positionSec > 1 && durationSec > 1)) return;

    try {
      const res = await api.post('/users/kpi/track/video', {
        courseId,
        assetId,
        positionSec,
        durationSec,
        event,
        sessionId: sessionIdRef.current,
      });

      const {
        percent,
        nextVideoId,
        perVideo,
        deltaWatched,
        watchedSeconds,
        nextCourse,
      } = res?.data || {};

      if (Number.isFinite(Number(percent)))
        pushUp({ percent: Number(percent) });
      if (nextVideoId) pushUp({ nextVideoId });

      if (Array.isArray(perVideo)) {
        const map = {};
        for (const pv of perVideo) {
          if (pv?.asset_id != null) {
            map[pv.asset_id] = {
              lastPosition: pv.last_position ?? 0,
              duration_seconds: pv.duration_seconds ?? 0,
              completed: Boolean(pv.completed),
            };
          }
        }
        pushUp({ perVideo: map });
      }

      if (Number.isFinite(Number(watchedSeconds)))
        pushUp({ watchedSeconds: Number(watchedSeconds) });
      else if (Number.isFinite(Number(deltaWatched)))
        pushUp({ deltaWatched: Number(deltaWatched) });

      if (nextCourse) pushUp({ nextCourse }); // ← forward recommendation
    } catch (e) {
      console.warn('kpi event failed', event, e?.message || e);
    }
  };

  const startHeartbeat = () => {
    if (hbTimerRef.current) clearInterval(hbTimerRef.current);
    hbTimerRef.current = setInterval(() => {
      const el = ref?.current;
      if (!el) return;
      if (!el.paused && !document.hidden && el.currentTime > 1) {
        postEvent(el, 'heartbeat');
      }
    }, 10000);
  };

  const stopHeartbeat = () => {
    if (hbTimerRef.current) clearInterval(hbTimerRef.current);
    hbTimerRef.current = null;
  };

  // Wire up video events
  useEffect(() => {
    const el = ref?.current;
    if (!el || !courseId || !assetId || !src) return;

    const onLoadedMetadata = async () => {
      sessionIdRef.current = makeSessionId();
      setIsCompleted(false);
      completedOnceRef.current = false;
      await fetchProgress(true);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = setInterval(() => fetchProgress(true), 30000);
    };

    const onPlay = async () => {
      await postEvent(el, 'play');
      startHeartbeat();
    };

    const onPause = async () => {
      stopHeartbeat();
      await postEvent(el, 'pause');
    };

    const onSeeked = async () => {
      await postEvent(el, 'seeked');
    };

    const onEnded = async () => {
      stopHeartbeat();
      await postEvent(el, 'ended');
      const positionSec = Math.floor(el.currentTime || 0);
      const durationSec = Math.max(1, Math.floor(el.duration || 0));
      if (durationSec - positionSec <= 1) setIsCompleted(true);
      await fetchProgress(false);
    };

    const onVisibilityChange = () => {
      if (document.hidden) onPause();
    };

    const onTimeUpdate = throttle(() => {
      if (ref?.current && !ref.current.paused && !document.hidden) {
        postEvent(ref.current, 'timeupdate');
      }
    }, 5000);

    // Attach
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTimeUpdate);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Cleanup
    return () => {
      stopHeartbeat();
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTimeUpdate);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [courseId, assetId, src, ref]);

  useEffect(() => {
    if (isCompleted && ref?.current && !completedOnceRef.current) {
      completedOnceRef.current = true;
      postEvent(ref.current, 'completed');
      try {
        onComplete?.({ courseId, assetId });
      } catch {
        /*ignore*/
      }
    }
  }, [isCompleted]);

  if (error) return <div className="vw-alert">{error}</div>;

  if (!src) {
    return (
      <div className="vw-skeleton">
        <div className="vw-skeleton__bar" />
        <div className="vw-skeleton__bar" />
        <div className="vw-skeleton__bar" />
      </div>
    );
  }

  return (
    <video
      key={src}
      ref={ref}
      src={src}
      className="vw-video"
      controls
      playsInline
      preload="metadata"
      onError={(e) => {
        console.error('Video error', e?.target?.error);
        alert('Could not load the video. Check console/network for details.');
      }}
    />
  );
});

export default VideoPlayer;
