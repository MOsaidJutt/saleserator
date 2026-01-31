// backend/routes/courses.js
const express = require('express');
const pool = require('../../db');
const { auth } = require('../../middleware/auth');
const router = express.Router();

// Optional AWS setup (for S3 videos)
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3 = new S3Client({ region: process.env.AWS_REGION });
const S3_BUCKET = process.env.AWS_S3_BUCKET;

// --- Presign TTL (same idea as admin) ---
const PRESIGN_TTL = Number(process.env.S3_PRESIGN_TTL || 600);

// --- helper to pre-sign GETs for private bucket (mirrors admin logic) ---
function guessMimeFromKey(key) {
  const ext = (key.split('.').pop() || '').toLowerCase();
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm3u8') return 'application/vnd.apple.mpegurl';
  if (ext === 'mp3') return 'audio/mpeg';
  return undefined; // let S3 decide
}

async function signGetUrl({ key, fileName, expiresIn = PRESIGN_TTL }) {
  const ResponseContentType = guessMimeFromKey(key);
  const ResponseContentDisposition = fileName
    ? `inline; filename="${encodeURIComponent(fileName)}"`
    : 'inline';

  const cmd = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ...(ResponseContentType ? { ResponseContentType } : {}),
    ResponseContentDisposition,
  });

  return getSignedUrl(s3, cmd, { expiresIn });
}

// -------------------------------------------
// Role Middleware
// -------------------------------------------
const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) return next();
    return res
      .status(403)
      .json({ message: 'Forbidden: Insufficient permissions' });
  };
};

// -------------------------------------------
// 1️⃣ BASIC USER COURSE ROUTES
// -------------------------------------------

// Enrolled / approved courses for current user (HIDDEN EXCLUDED)
router.get('/my', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.category, c.points, c.media_type,
              c.asset_url, c.thumbnail_url, c.duration_seconds,
              COALESCE(up.progress_percent, 0) AS progress_percent
         FROM user_courses uc
         JOIN courses c ON c.id = uc.course_id
    LEFT JOIN user_progress up
           ON up.user_id = uc.user_id AND up.course_id = uc.course_id
        WHERE uc.user_id = $1
          AND c.is_active = TRUE
          AND c.hidden = FALSE
     ORDER BY c.title`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /courses/my error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Catalog of active courses (user doesn’t have)
router.get('/catalog', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.category, c.points, c.media_type,
              c.asset_url, c.thumbnail_url, c.duration_seconds
         FROM courses c
        WHERE c.is_active = TRUE
          AND c.hidden = FALSE
          AND c.id NOT IN (SELECT course_id FROM user_courses WHERE user_id=$1)
     ORDER BY c.title`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /courses/catalog error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// (Optional) available list alias at /courses
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.category, c.points, c.media_type, c.asset_url, c.thumbnail_url, c.duration_seconds
         FROM courses c
        WHERE c.is_active = TRUE
          AND c.hidden = FALSE
     ORDER BY c.title`,
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /courses error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Request course access (user)
router.post('/request', auth, async (req, res) => {
  const { course_id } = req.body || {};
  if (!course_id)
    return res.status(400).json({ message: 'course_id required' });

  await pool.query(
    'INSERT INTO course_requests (user_id, course_id, status) VALUES ($1, $2, $3)',
    [req.user.id, course_id, 'pending'],
  );
  res.status(201).json({ ok: true });
});

// Admin: List course assets
router.get('/:id/assets', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, kind, s3_key, mime_type, size_bytes, duration_seconds,
              quality_label, is_default, created_at
         FROM course_assets
        WHERE course_id = $1
     ORDER BY is_default DESC, created_at DESC, id DESC`,
      [id],
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /courses/:id/assets error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ------------------------------------------------------
// User's own course requests (for AvailableCourses)
// ------------------------------------------------------
router.get('/requests/mine', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cr.course_id, cr.status AS request_status
         FROM course_requests cr
        WHERE cr.user_id = $1`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /courses/requests/mine error:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// -------------------------------------------
// 2️⃣ COURSE DETAILS & STREAMING
// -------------------------------------------

// Get course detail (for user) — REQUIRE course active, then enrollment
router.get('/detail/:courseId', auth, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  try {
    const { rows: courseRows } = await pool.query(
      `SELECT id, title, category, points, duration_seconds, description, is_active, hidden
         FROM courses
        WHERE id=$1`,
      [courseId],
    );
    if (!courseRows.length)
      return res.status(404).json({ error: 'Course not found.' });

    const course = courseRows[0];

    // Block hidden / inactive courses
    if (course.hidden) {
      return res.status(403).json({ error: 'Course is hidden.' });
    }
    if (!course.is_active) {
      return res.status(403).json({ error: 'Course is inactive.' });
    }

    // Verify enrollment (if your flows require it)
    const approved = await pool.query(
      `SELECT 1 FROM user_courses WHERE user_id=$1 AND course_id=$2`,
      [userId, courseId],
    );
    if (!approved.rowCount)
      return res
        .status(403)
        .json({ error: 'You are not enrolled in this course.' });

    // Course videos
    const { rows: videos } = await pool.query(
      `SELECT id, file_name, kind, duration_seconds, public_url
         FROM course_assets
        WHERE course_id=$1 AND kind='video'
     ORDER BY id ASC`,
      [courseId],
    );

    // Canonical percent from user_progress
    const { rows: percentRows } = await pool.query(
      `SELECT progress_percent
         FROM user_progress
        WHERE user_id=$1 AND course_id=$2`,
      [userId, courseId],
    );
    const percent = percentRows[0]?.progress_percent ?? 0;

    // Per-video playhead snapshot
    let userProgress = [];
    if (videos.length) {
      const ids = videos.map((v) => v.id);
      const { rows } = await pool.query(
        `SELECT asset_id, position_sec, duration_sec,
                COALESCE(completed, false) AS completed
           FROM user_video_progress
          WHERE user_id=$1 AND asset_id = ANY($2::int[])`,
        [userId, ids],
      );
      userProgress = rows;
    }

    res.json({ course, videos, userProgress, percent });
  } catch (err) {
    console.error('GET /courses/detail/:courseId error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get playback URL for a video (presigned S3 GET) — REQUIRE course active
router.get('/asset/:assetId/stream-url', auth, async (req, res) => {
  const { assetId } = req.params;
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, course_id, kind, s3_key, public_url, mime_type, file_name
         FROM course_assets
        WHERE id=$1`,
      [assetId],
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Asset not found.' });
    const asset = rows[0];

    if (asset.kind !== 'video')
      return res.status(400).json({ error: 'Not a video asset.' });

    // Course must be active & not hidden
    const { rows: courseRows } = await pool.query(
      `SELECT is_active, hidden FROM courses WHERE id=$1`,
      [asset.course_id],
    );
    if (!courseRows.length)
      return res.status(404).json({ error: 'Course not found.' });
    if (courseRows[0].hidden)
      return res.status(403).json({ error: 'Course is hidden.' });
    if (!courseRows[0].is_active)
      return res.status(403).json({ error: 'Course is inactive.' });

    // Require enrollment
    const { rowCount: allowed } = await pool.query(
      `SELECT 1 FROM user_courses WHERE user_id=$1 AND course_id=$2`,
      [userId, asset.course_id],
    );
    if (!allowed)
      return res.status(403).json({ error: 'Not enrolled in this course.' });

    if (!S3_BUCKET || !asset.s3_key)
      return res
        .status(500)
        .json({ error: 'Missing S3 configuration or file key.' });

    // Presign for private bucket
    const url = await signGetUrl({
      key: asset.s3_key,
      fileName: asset.file_name || 'video',
      expiresIn: PRESIGN_TTL,
    });

    res.json({ url, expiresIn: PRESIGN_TTL });
  } catch (err) {
    console.error('GET /courses/asset/:assetId/stream-url error:', err);
    res.status(500).json({ error: 'Error generating stream URL.' });
  }
});

// -------------------------------------------
// 3️⃣ (LEGACY) VIDEO PROGRESS → PROXY TO KPI
// -------------------------------------------
router.post('/asset/:assetId/progress', auth, async (req, res) => {
  const { assetId } = req.params;
  const { positionSec = 0, durationSec = 0 } = req.body || {};
  const userId = req.user.id;

  try {
    // Verify the asset and course
    const { rows } = await pool.query(
      `SELECT course_id FROM course_assets WHERE id=$1 AND kind='video'`,
      [assetId],
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Video asset not found.' });
    const courseId = rows[0].course_id;

    // Verify enrollment
    const allowed = await pool.query(
      `SELECT 1 FROM user_courses WHERE user_id=$1 AND course_id=$2`,
      [userId, courseId],
    );
    if (!allowed.rowCount)
      return res.status(403).json({ error: 'Not enrolled in this course.' });

    // === KPI-style tracking (unchanged) ===
    const dur = Math.max(1, Math.floor(Number(durationSec) || 0));
    const pos = Math.max(
      0,
      Math.min(Math.floor(Number(positionSec) || 0), dur),
    );
    const today = new Date().toISOString().slice(0, 10);

    await pool.query('BEGIN');

    const lastRowQ = await pool.query(
      `SELECT position_sec
         FROM user_video_progress
        WHERE user_id = $1 AND asset_id = $2
        FOR UPDATE`,
      [userId, assetId],
    );
    const lastPos = lastRowQ.rowCount
      ? Math.max(0, Number(lastRowQ.rows[0].position_sec || 0))
      : 0;
    const rawDelta = pos - lastPos;
    const deltaWatched = Math.max(0, Math.min(rawDelta, 30)); // safety cap

    await pool.query(
      `INSERT INTO user_video_progress (user_id, asset_id, position_sec, duration_sec, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, asset_id)
       DO UPDATE SET
         position_sec = GREATEST(EXCLUDED.position_sec, user_video_progress.position_sec),
         duration_sec = GREATEST(EXCLUDED.duration_sec, user_video_progress.duration_sec),
         updated_at   = NOW()`,
      [userId, assetId, pos, dur],
    );

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

    await pool.query('COMMIT');

    const { rows: updatedProgress } = await pool.query(
      `SELECT progress_percent
         FROM user_progress
        WHERE user_id=$1 AND course_id=$2`,
      [userId, courseId],
    );

    res.json({
      ok: true,
      progress_percent: updatedProgress[0]?.progress_percent ?? 0,
    });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error(
      'POST /courses/asset/:assetId/progress error (proxy to KPI):',
      err,
    );
    res.status(500).json({ error: 'Database error while saving progress.' });
  }
});

// -------------------------------------------
// 4️⃣ Canonical course percent (simple read)
// -------------------------------------------
router.get('/detail/:courseId/progress', auth, async (req, res) => {
  const userId = req.user.id;
  const { courseId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT progress_percent
         FROM user_progress
        WHERE user_id=$1 AND course_id=$2`,
      [userId, courseId],
    );
    res.json({ percent: Number(rows?.[0]?.progress_percent || 0) });
  } catch (err) {
    console.error('GET /courses/detail/:courseId/progress error:', err);
    res.status(500).json({ error: 'Failed to read progress' });
  }
});

module.exports = router;
