// routes/kpi.js
const express = require('express');
const pool = require('../../db');
const { auth } = require('../../middleware/auth');
const router = express.Router();

const VIDEO_COMPLETION_POINTS = 5;
const COURSE_COMPLETION_POINTS = 50;

// ---------- helper: find next recommended course in same category ----------
async function getNextCourseSameCategory(userId, courseId) {
  // Step 1: Get all courses in the same category, excluding the current course
  const q = await pool.query(
    `
    WITH base AS (
      SELECT
        c2.id,
        c2.title,
        c2.category,
        c2.points,
        c2.created_at,
        COALESCE(up.progress_percent, 0) AS user_percent
      FROM courses c2
      JOIN courses c ON c.id = $2
      LEFT JOIN user_progress up
        ON up.course_id = c2.id
       AND up.user_id = $1
      WHERE c2.category = c.category
        AND c2.id <> $2
        AND COALESCE(c2.hidden, FALSE) = FALSE
    )
    SELECT id, title, category, points, user_percent
      FROM base
     ORDER BY (user_percent >= 100)::int ASC,
              user_percent ASC,
              created_at DESC NULLS LAST,
              id ASC
    `,
    [userId, courseId],
  );

  // Step 2: Check if the current course is completed (100% progress)
  const progressQuery = await pool.query(
    'SELECT progress_percent FROM user_progress WHERE user_id = $1 AND course_id = $2',
    [userId, courseId],
  );

  const progress = progressQuery.rows[0]?.progress_percent || 0;

  // If the current course isn't completed (progress < 100%), don't recommend any next course yet
  if (progress !== 100) {
    return null;
  }

  // Step 3: Check for the next course in the same category
  for (let course of q.rows) {
    const nextCourseId = course.id;

    // Step 4: Fetch the progress of the next course (separate query)
    const nextCourseProgressQuery = await pool.query(
      'SELECT progress_percent FROM user_progress WHERE user_id = $1 AND course_id = $2',
      [userId, nextCourseId],
    );

    const nextCourseProgress =
      nextCourseProgressQuery.rows[0]?.progress_percent || 0;

    // Step 5: Check if the next course is already completed (100% progress)
    if (nextCourseProgress === 100) {
      continue; // Skip recommending this course if it is already 100% complete
    }

    // Step 6: Check if the user is enrolled in this next course
    const enrollmentQuery = await pool.query(
      'SELECT 1 FROM user_courses WHERE user_id = $1 AND course_id = $2',
      [userId, nextCourseId],
    );

    const isEnrolled = enrollmentQuery.rowCount > 0;

    // If the user is enrolled in the next course and it's not completed yet, recommend it
    if (isEnrolled && nextCourseProgress < 100) {
      return course; // Recommend the next course
    }
  }

  // If no suitable course is found, return null
  return null;
}

// ---------- shared aggregate SQL ----------
const aggregateSql = `
  WITH total AS (
    SELECT COALESCE(SUM(ca.duration_seconds), 0)::numeric AS t
      FROM course_assets ca
     WHERE ca.course_id = $2
       AND COALESCE(ca.duration_seconds, 0) > 0
  ),
  watched AS (
    SELECT COALESCE(SUM(LEAST(uvp.position_sec, uvp.duration_sec)), 0)::numeric AS w
      FROM user_video_progress uvp
      JOIN course_assets ca ON ca.id = uvp.asset_id
     WHERE uvp.user_id = $1
       AND ca.course_id = $2
  ),
  next_video AS (
    SELECT ca.id AS next_video_id
      FROM course_assets ca
     WHERE ca.course_id = $2
       AND ca.id > $3
     ORDER BY ca.id ASC
     LIMIT 1
  ),
  per_video AS (
    SELECT uvp.asset_id,
           uvp.position_sec AS last_position,
           ca.duration_seconds,
           COALESCE(uvp.completed, FALSE) AS completed
    FROM user_video_progress uvp
    JOIN course_assets ca ON ca.id = uvp.asset_id
    WHERE uvp.user_id = $1
      AND ca.course_id = $2
  )
  SELECT CASE WHEN total.t > 0 THEN ROUND((watched.w / total.t) * 100)
              ELSE 0 END AS percent,
         (SELECT next_video_id FROM next_video) AS next_video_id,
         (SELECT jsonb_agg(jsonb_build_object(
             'asset_id', pv.asset_id,
             'last_position', pv.last_position,
             'duration_seconds', pv.duration_seconds,
             'completed', pv.completed
          )) FROM per_video pv) AS per_video,
         CAST(watched.w AS int) AS watched_seconds
    FROM total, watched
`;

/**
 * GET /kpi/progress?courseId=...&assetId=...
 */
router.get('/progress', auth, async (req, res) => {
  const userId = req.user.id;
  const courseId = Number(req.query.courseId);
  const assetId = Number(req.query.assetId || 0);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'courseId is required' });
  }
  try {
    const progQ = await pool.query(aggregateSql, [userId, courseId, assetId]);
    const row = progQ.rows?.[0] || {};

    let nextCourse = null;
    if (!row.next_video_id) {
      nextCourse = await getNextCourseSameCategory(userId, courseId);
    }

    return res.json({
      ok: true,
      percent: row.percent || 0,
      nextVideoId: row.next_video_id || null,
      perVideo: row.per_video || [],
      watchedSeconds: row.watched_seconds || 0,
      nextCourse,
    });
  } catch (e) {
    console.error('GET /kpi/progress', e);
    return res.status(500).json({ error: 'Failed to load progress' });
  }
});

/**
 * POST /kpi/track/video
 * Body: { courseId, assetId, positionSec, durationSec, sessionId }
 */
router.post('/track/video', auth, async (req, res) => {
  const userId = req.user.id;
  const {
    courseId,
    assetId,
    positionSec,
    durationSec,
    sessionId = null,
  } = req.body || {};

  if (
    !courseId ||
    !assetId ||
    !Number.isFinite(positionSec) ||
    !Number.isFinite(durationSec)
  ) {
    return res
      .status(400)
      .json({
        error: 'courseId, assetId, positionSec, durationSec are required',
      });
  }
  if (!sessionId) {
    return res
      .status(400)
      .json({ error: 'Session ID is required to track video progress' });
  }

  const dur = Math.max(1, Math.floor(durationSec));
  const pos = Math.max(0, Math.min(Math.floor(positionSec), dur));
  const today = new Date().toISOString().slice(0, 10);

  // Return aggregates even if not played (pos <= 1)
  if (pos <= 1) {
    try {
      const progQ = await pool.query(aggregateSql, [userId, courseId, assetId]);
      const row = progQ.rows?.[0] || {};
      let nextCourse = null;
      if (!row.next_video_id) {
        nextCourse = await getNextCourseSameCategory(userId, courseId);
      }
      return res.json({
        ok: true,
        deltaWatched: 0,
        percent: row.percent || 0,
        nextVideoId: row.next_video_id || null,
        perVideo: row.per_video || [],
        watchedSeconds: row.watched_seconds || 0,
        nextCourse,
        message: 'Video clicked but not played, no progress logged.',
      });
    } catch (e) {
      console.error('POST /kpi/track/video (read aggregates fallback)', e);
      return res.json({ ok: true, message: 'No progress logged.' });
    }
  }

  try {
    await pool.query('BEGIN');

    const lastRowQ = await pool.query(
      `SELECT position_sec, session_id
         FROM user_video_progress
        WHERE user_id = $1 AND asset_id = $2
        FOR UPDATE`,
      [userId, assetId],
    );

    if (lastRowQ.rowCount > 0) {
      const lastPos = Math.max(0, Number(lastRowQ.rows[0].position_sec || 0));
      const lastSessionId = lastRowQ.rows[0].session_id;

      if (pos <= lastPos && sessionId === lastSessionId) {
        const progQ = await pool.query(aggregateSql, [
          userId,
          courseId,
          assetId,
        ]);
        const row = progQ.rows?.[0] || {};
        let nextCourse = null;
        if (!row.next_video_id) {
          nextCourse = await getNextCourseSameCategory(userId, courseId);
        }
        await pool.query('COMMIT');
        return res.json({
          ok: true,
          deltaWatched: 0,
          percent: row.percent || 0,
          nextVideoId: row.next_video_id || null,
          perVideo: row.per_video || [],
          watchedSeconds: row.watched_seconds || 0,
          nextCourse,
          message: 'No progress change detected, no update made.',
        });
      }
    }

    // Credit forward movement (cap 30s per ping)
    const lastPosForDelta =
      lastRowQ.rowCount > 0
        ? Math.max(0, Number(lastRowQ.rows[0].position_sec || 0))
        : 0;
    const rawDelta = pos - lastPosForDelta;
    const deltaWatched = Math.max(0, Math.min(rawDelta, 30));

    // Upsert + tolerant completion
    await pool.query(
      `
      INSERT INTO user_video_progress (user_id, asset_id, position_sec, duration_sec, session_id, completed, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id, asset_id)
      DO UPDATE SET
        position_sec = GREATEST(EXCLUDED.position_sec, user_video_progress.position_sec),
        duration_sec = GREATEST(EXCLUDED.duration_sec, user_video_progress.duration_sec),
        session_id   = COALESCE(EXCLUDED.session_id, user_video_progress.session_id),
        completed    = user_video_progress.completed
                       OR (GREATEST(EXCLUDED.position_sec, user_video_progress.position_sec)
                           >= GREATEST(EXCLUDED.duration_sec, user_video_progress.duration_sec) - 1),
        updated_at   = NOW()
      `,
      [userId, assetId, pos, dur, sessionId, pos >= dur - 1],
    );

    // Daily aggregates
    await pool.query(
      `INSERT INTO daily_learning_activity (user_id, course_id, activity_date, seconds_watched, assets_viewed)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (user_id, course_id, activity_date)
       DO UPDATE SET seconds_watched = daily_learning_activity.seconds_watched + EXCLUDED.seconds_watched`,
      [userId, courseId, today, deltaWatched],
    );

    await pool.query(
      `WITH ins AS (
         INSERT INTO daily_asset_ledger (user_id, course_id, asset_id, activity_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING 1
       )
       UPDATE daily_learning_activity d
          SET assets_viewed = d.assets_viewed + 1
        WHERE d.user_id = $1
          AND d.course_id = $2
          AND d.activity_date = $4
          AND EXISTS (SELECT 1 FROM ins)`,
      [userId, courseId, assetId, today],
    );

    // Course aggregates
    const progQ = await pool.query(aggregateSql, [userId, courseId, assetId]);
    const row = progQ.rows?.[0] || {};
    const percent = row.percent || 0;

    const prevProgQ = await pool.query(
      `SELECT progress_percent FROM user_progress WHERE user_id=$1 AND course_id=$2 FOR UPDATE`,
      [userId, courseId],
    );
    const prevPercent = Number(prevProgQ.rows?.[0]?.progress_percent ?? 0);

    await pool.query(
      `INSERT INTO user_progress (user_id, course_id, progress_percent, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, course_id)
       DO UPDATE SET progress_percent = EXCLUDED.progress_percent, updated_at = NOW()`,
      [userId, courseId, percent],
    );

    // Log video completion exactly once
    const sel = await pool.query(
      `SELECT completed
         FROM user_video_progress
        WHERE user_id = $1 AND asset_id = $2`,
      [userId, assetId],
    );
    const definitiveCompleted = sel.rows?.[0]?.completed === true;

    if (definitiveCompleted) {
      await pool.query(
        `INSERT INTO activities (user_id, activity_type, points, value, date_logged, category_id)
         SELECT $1, 'video_completed', $2, $3, NOW(), $4
         WHERE NOT EXISTS (
           SELECT 1 FROM activities
           WHERE user_id = $1 AND activity_type = 'video_completed' AND value = $3
         )`,
        [userId, VIDEO_COMPLETION_POINTS, assetId, 3],
      );
    }
    // Log course completion exactly once (transition to 100)
    if (percent >= 100 && prevPercent < 100) {
      await pool.query(
        `INSERT INTO activities (user_id, activity_type, points, value, date_logged, category_id)
         SELECT $1, 'course_completed', $2, $3, NOW(), $4
         WHERE NOT EXISTS (
           SELECT 1 FROM activities
           WHERE user_id = $1 AND activity_type = 'course_completed' AND value = $3
         )`,
        [userId, COURSE_COMPLETION_POINTS, courseId, 3],
      );
    }

    let nextCourse = null;
    if (!row.next_video_id) {
      nextCourse = await getNextCourseSameCategory(userId, courseId);
    }

    await pool.query('COMMIT');
    
    // non-blocking: refresh leaderboard snapshots for relevant periods
    pool
      .query("SELECT refresh_leaderboard($1::text, $2::date)", [
        'daily',
        today,
      ])
      .catch((err) =>
        console.error('refresh_leaderboard (activity single daily) failed', err),
      );
    pool
      .query("SELECT refresh_leaderboard($1::text, $2::date)", [
        'weekly',
        today,
      ])
      .catch((err) =>
        console.error('refresh_leaderboard (activity single weekly) failed', err),
      );
    pool
      .query("SELECT refresh_leaderboard($1::text, $2::date)", [
        'monthly',
        today,
      ])
      .catch((err) =>
        console.error('refresh_leaderboard (activity single monthly) failed', err),
      );
    pool
      .query("SELECT refresh_leaderboard($1::text, $2::date)", [
        'all',
        today,
      ])
      .catch((err) =>
        console.error('refresh_leaderboard (activity all) failed', err),
      );
    return res.json({
      ok: true,
      deltaWatched,
      percent,
      nextVideoId: row.next_video_id || null,
      perVideo: row.per_video || [],
      watchedSeconds: row.watched_seconds || 0,
      nextCourse,
    });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('POST /kpi/track/video', e);
    return res.status(500).json({ error: 'Tracking failed' });
  }
});

module.exports = router;
