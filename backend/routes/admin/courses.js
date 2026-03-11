const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { auth, requireRole } = require('../../middleware/auth');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const S3_BUCKET = process.env.AWS_S3_BUCKET;
const PRESIGN_TTL = Number(process.env.S3_PRESIGN_TTL || 600);
const PUBLIC_BASE =
  process.env.S3_PUBLIC_BASE ||
  `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`;

function randomName(ext = '') {
  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  return ext ? `${id}.${ext.replace(/^\./, '')}` : id;
}

function guessMimeFromKey(key) {
  const ext = (key.split('.').pop() || '').toLowerCase();
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm3u8') return 'application/vnd.apple.mpegurl';
  if (ext === 'mp3') return 'audio/mpeg';
  return undefined;
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

// ==================== COURSES & ASSETS (ADMIN) ====================

// Admin: create course
router.post('/courses', auth, requireRole('admin'), async (req, res) => {
  const {
    title,
    category,
    points = 0,
    is_active = true,
    storage_provider = 's3',
    media_type = 'video',
    description = '',
    hidden = false,
  } = req.body || {};

  if (!title) return res.status(400).json({ message: 'Title required!' });

  const company_id = req.user.company_id;

  const { rows } = await pool.query(
    `INSERT INTO courses (title, category, points, is_active, storage_provider, media_type, description, hidden, company_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, title, category, points, is_active, storage_provider, media_type, description, hidden, company_id`,
    [title, category, points, is_active, storage_provider, media_type, description, hidden, company_id],
  );

  res.status(201).json(rows[0]);
});

// Delete course (admin only)
router.delete('/courses/:id', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;

  if (!id) {
    return res.status(400).json({ message: 'Course ID is required' });
  }

  const client = await pool.connect();
  try {
    // 1) Collect S3 keys — only for this company's course
    const assetResult = await client.query(
      `SELECT DISTINCT ca.s3_key 
       FROM course_assets ca
       JOIN courses c ON c.id = ca.course_id
       WHERE ca.course_id = $1 
         AND c.company_id = $2
         AND ca.s3_key IS NOT NULL`,
      [id, company_id],
    );
    const keys = (assetResult.rows || [])
      .map((r) => r.s3_key)
      .filter((k) => k && k.trim() !== '');

    // 2) Transaction: delete the course (only if it belongs to this company)
    await client.query('BEGIN');

    const deleteCourseResult = await client.query(
      'DELETE FROM courses WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, company_id],
    );

    if (deleteCourseResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Course not found' });
    }

    await client.query('COMMIT');

    // 3) Delete S3 objects
    let s3Deleted = 0;
    let s3Errors = [];
    if (keys.length > 0) {
      try {
        const deleteParams = {
          Bucket: S3_BUCKET,
          Delete: {
            Objects: keys.map((k) => ({ Key: k })),
            Quiet: false,
          },
        };
        const deleteResponse = await s3.send(new DeleteObjectsCommand(deleteParams));
        s3Deleted = (deleteResponse.Deleted || []).length;
        if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
          s3Errors = deleteResponse.Errors;
          console.error('S3 delete returned errors:', deleteResponse.Errors);
        }
      } catch (e) {
        console.error('S3 delete failed:', e);
        s3Errors = [{ Code: 'Exception', Message: e.message }];
      }
    }

    return res.status(200).json({
      message: 'Course and related data deleted (DB). S3 cleanup attempted.',
      s3Deleted,
      ...(s3Errors.length ? { s3Errors } : {}),
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('Error deleting course and assets:', err);
    return res.status(500).json({ message: 'Failed to delete course', error: err.message });
  } finally {
    client.release();
  }
});

// Update a course (partial)
router.patch('/courses/:id', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;

  const fields = [
    'title', 'category', 'points', 'is_active', 'storage_provider',
    'media_type', 'asset_url', 'thumbnail_url', 'duration_seconds',
    'description', 's3_prefix', 'hidden',
  ];
  const sets = [];
  const vals = [];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = $${sets.length + 1}`);
      vals.push(req.body[f]);
    }
  });
  if (!sets.length)
    return res.status(400).json({ message: 'No fields to update' });

  // company_id check in WHERE ensures admin can't edit another company's course
  vals.push(id);
  vals.push(company_id);
  const { rows } = await pool.query(
    `UPDATE courses SET ${sets.join(', ')} 
     WHERE id = $${vals.length - 1} AND company_id = $${vals.length}
     RETURNING *`,
    vals,
  );
  if (!rows.length)
    return res.status(404).json({ message: 'Course not found' });
  res.json(rows[0]);
});

// Admin: get presigned URL to upload a course asset to S3
router.post('/uploads/presign', auth, requireRole('admin'), async (req, res) => {
  try {
    const { course_id, contentType, fileExt = 'mp4' } = req.body || {};
    const company_id = req.user.company_id;
    const company_slug = req.user.company_slug;

    if (!course_id || !contentType) {
      return res.status(400).json({ message: 'course_id and contentType required' });
    }

    // Ensure course belongs to this company
    const { rows: courseRows } = await pool.query(
      'SELECT id FROM courses WHERE id = $1 AND company_id = $2',
      [course_id, company_id],
    );
    if (!courseRows.length)
      return res.status(404).json({ message: 'Course not found' });

    const fileName = randomName(fileExt);
    // S3 path now includes company slug for isolation
    const s3Key = `courses/${company_slug}/${course_id}/${fileName}`;

    const cmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: PRESIGN_TTL });
    return res.json({ uploadUrl, s3Key, expiresIn: PRESIGN_TTL });
  } catch (err) {
    console.error('[presign] error:', err);
    return res.status(500).json({ message: 'Failed to presign upload' });
  }
});

// Admin: record an uploaded asset in DB
router.post('/courses/:id/assets', auth, requireRole('admin'), async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const company_id = req.user.company_id;
    const {
      s3_key, kind = 'video', mime_type = null, size_bytes = null,
      duration_seconds = null, quality_label = null, is_default = false,
      file_name = null, public_url = null,
    } = req.body || {};

    if (!courseId || !s3_key) {
      return res.status(400).json({ message: 'course id and s3_key required' });
    }

    // Validate course belongs to this company
    const { rows: courseRows } = await pool.query(
      'SELECT id FROM courses WHERE id = $1 AND company_id = $2',
      [courseId, company_id],
    );
    if (!courseRows.length)
      return res.status(404).json({ message: 'Course not found' });

    if (is_default) {
      await pool.query(
        'UPDATE course_assets SET is_default = FALSE WHERE course_id = $1 AND is_default = TRUE',
        [courseId],
      );
    }

    const insertSql = `
      INSERT INTO course_assets
        (course_id, kind, s3_key, mime_type, size_bytes, duration_seconds, quality_label, is_default, file_name, public_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, course_id, kind, s3_key, mime_type, size_bytes, duration_seconds, quality_label, is_default, created_at, file_name, public_url`;
    const vals = [courseId, kind, s3_key, mime_type, size_bytes, duration_seconds, quality_label, is_default, file_name, public_url];
    const { rows } = await pool.query(insertSql, vals);

    // Recalculate user_progress for all enrolled users who had this course at 100%
    // so the dashboard card no longer shows stale 100% after new video is added
    await pool.query(
      `UPDATE user_progress up
          SET progress_percent = (
            WITH total_videos AS (
              SELECT COUNT(*)::numeric AS t
                FROM course_assets ca
               WHERE ca.course_id = $1
            ),
            completed_videos AS (
              SELECT COUNT(*)::numeric AS w
                FROM user_video_progress uvp
                JOIN course_assets ca ON ca.id = uvp.asset_id
               WHERE uvp.user_id = up.user_id
                 AND ca.course_id = $1
                 AND uvp.completed = TRUE
            )
            SELECT CASE WHEN total_videos.t > 0
                        THEN ROUND((completed_videos.w / total_videos.t) * 100)
                        ELSE 0 END
              FROM total_videos, completed_videos
          ),
          updated_at = NOW()
        WHERE up.course_id = $1`,
      [courseId],
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[add asset] error:', err);
    return res.status(500).json({ message: 'Failed to save course asset' });
  }
});

// GET /admin/courses -> list courses for this company only
router.get('/courses', auth, requireRole('admin'), async (req, res) => {
  const company_id = req.user.company_id;

  const sql = `
    SELECT
      c.id, c.title, c.category, c.points, c.is_active, c.media_type, c.storage_provider,
      c.thumbnail_url, c.duration_seconds, c.hidden,
      COALESCE(COUNT(a.id), 0)::int AS asset_count,
      MAX(CASE WHEN a.is_default THEN a.id END)::int AS default_asset_id
    FROM courses c
    LEFT JOIN course_assets a ON a.course_id = c.id
    WHERE c.company_id = $1
    GROUP BY c.id
    ORDER BY c.id DESC
  `;
  const { rows } = await pool.query(sql, [company_id]);
  res.json(rows);
});

// Return a short-lived signed URL (JSON)
router.get('/courses/:id/assets/:assetId/url', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id, assetId } = req.params;
    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT ca.file_name, ca.s3_key 
       FROM course_assets ca
       JOIN courses c ON c.id = ca.course_id
       WHERE ca.id = $1 AND ca.course_id = $2 AND c.company_id = $3`,
      [assetId, id, company_id],
    );
    if (!rows.length)
      return res.status(404).json({ message: 'Asset not found' });

    const { s3_key, file_name } = rows[0];
    const url = await signGetUrl({ key: s3_key, fileName: file_name, expiresIn: PRESIGN_TTL });
    res.json({ url, expiresIn: PRESIGN_TTL });
  } catch (e) {
    console.error('[admin preview url] error:', e);
    res.status(500).json({ message: 'Failed to generate URL' });
  }
});

// Redirect to a signed URL
router.get('/courses/:id/assets/:assetId/open', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id, assetId } = req.params;
    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT ca.file_name, ca.s3_key 
       FROM course_assets ca
       JOIN courses c ON c.id = ca.course_id
       WHERE ca.id = $1 AND ca.course_id = $2 AND c.company_id = $3`,
      [assetId, id, company_id],
    );
    if (!rows.length) return res.status(404).send('Asset not found');

    const { s3_key, file_name } = rows[0];
    const url = await signGetUrl({ key: s3_key, fileName: file_name, expiresIn: PRESIGN_TTL });
    return res.redirect(302, url);
  } catch (e) {
    console.error('[admin open redirect] error:', e);
    return res.status(500).send('Failed to open asset');
  }
});

// Get course details (optionally with signed URLs if ?signed=1)
router.get('/courses/:id', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  const includeSigned = String(req.query.signed || '') === '1';

  try {
    const { rows: courseRows } = await pool.query(
      `SELECT id, title, category, description, s3_prefix, points 
       FROM courses WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );
    if (!courseRows.length)
      return res.status(404).json({ error: 'Course not found' });

    const { rows: videoRows } = await pool.query(
      `SELECT id, course_id, file_name, s3_key, public_url, mime_type, size_bytes, duration_seconds, created_at
       FROM course_assets
       WHERE course_id = $1
       ORDER BY created_at ASC`,
      [id],
    );

    if (includeSigned) {
      const signed = await Promise.all(
        videoRows.map(async (v) => {
          const signed_url = v.s3_key
            ? await signGetUrl({ key: v.s3_key, fileName: v.file_name, expiresIn: PRESIGN_TTL })
            : null;
          return { ...v, signed_url, signed_expires_in: PRESIGN_TTL };
        }),
      );
      return res.json({ course: courseRows[0], videos: signed });
    }

    res.json({ course: courseRows[0], videos: videoRows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load course' });
  }
});

// Presign multiple uploads for a course
router.post('/courses/:id/presign', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  const company_slug = req.user.company_slug;
  const { files } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files[] required' });
  }

  // Verify course belongs to this company
  const { rows } = await pool.query(
    `SELECT id, s3_prefix FROM courses WHERE id = $1 AND company_id = $2`,
    [id, company_id],
  );
  if (!rows.length)
    return res.status(404).json({ error: 'Course not found' });

  // Use company slug in S3 prefix for isolation
  const s3Prefix = `courses/${company_slug}/${id}/`;

  try {
    const results = [];
    for (const f of files) {
      const ext = (f.fileName.match(/\.[^.]+$/) || [''])[0] || '';
      const key = `${s3Prefix}${randomName(ext)}`;

      const cmd = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ContentType: f.contentType,
      });

      const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });
      results.push({ fileName: f.fileName, contentType: f.contentType, key, uploadUrl });
    }
    res.json({ items: results, s3Prefix });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to presign' });
  }
});

// Persist uploaded video rows (batch)
router.post('/courses/:id/', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items[] required' });
  }

  // Verify course belongs to this company
  const { rows: courseCheck } = await pool.query(
    'SELECT id FROM courses WHERE id = $1 AND company_id = $2',
    [id, company_id],
  );
  if (!courseCheck.length)
    return res.status(404).json({ error: 'Course not found' });

  try {
    const inserted = [];
    for (const it of items) {
      const publicUrl = `${PUBLIC_BASE}${it.key}`;
      const { rows } = await pool.query(
        `INSERT INTO course_assets
           (course_id, file_name, s3_key, public_url, mime_type, size_bytes, duration_seconds)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, course_id, file_name, s3_key, public_url, mime_type, size_bytes, duration_seconds, created_at`,
        [id, it.fileName, it.key, publicUrl, it.contentType || null, it.byteSize || null, it.durationSeconds || null],
      );
      inserted.push(rows[0]);
    }

    // Recalculate user_progress for all enrolled users who had this course at 100%
    // so the dashboard card no longer shows stale 100% after new videos are added
    await pool.query(
      `UPDATE user_progress up
          SET progress_percent = (
            WITH total AS (
              SELECT COALESCE(SUM(ca.duration_seconds), 0)::numeric AS t
                FROM course_assets ca
               WHERE ca.course_id = $1
                 AND COALESCE(ca.duration_seconds, 0) > 0
            ),
            watched AS (
              SELECT COALESCE(SUM(LEAST(uvp.position_sec, uvp.duration_sec)), 0)::numeric AS w
                FROM user_video_progress uvp
                JOIN course_assets ca ON ca.id = uvp.asset_id
               WHERE uvp.user_id = up.user_id
                 AND ca.course_id = $1
            )
            SELECT CASE WHEN total.t > 0 THEN ROUND((watched.w / total.t) * 100) ELSE 0 END
              FROM total, watched
          ),
          updated_at = NOW()
        WHERE up.course_id = $1`,
      [id],
    );

    res.json({ videos: inserted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save videos' });
  }
});

// DELETE one asset from a course
router.delete('/courses/:id/assets/:assetId', auth, requireRole('admin'), async (req, res) => {
  const { id, assetId } = req.params;
  const company_id = req.user.company_id;

  try {
    const { rows } = await pool.query(
      `SELECT ca.id, ca.s3_key 
       FROM course_assets ca
       JOIN courses c ON c.id = ca.course_id
       WHERE ca.id = $1 AND ca.course_id = $2 AND c.company_id = $3`,
      [assetId, id, company_id],
    );
    if (!rows.length)
      return res.status(404).json({ message: 'Asset not found' });

    const { s3_key } = rows[0];

    if (s3_key) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3_key }));
      } catch (s3Err) {
        console.error('S3 delete error:', s3Err);
      }
    }

    await pool.query(
      `DELETE FROM course_assets WHERE id = $1 AND course_id = $2`,
      [assetId, id],
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting asset:', err);
    return res.status(500).json({ message: 'Failed to delete asset' });
  }
});

// Hide a course
router.patch('/courses/:id/hide', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  try {
    const { rowCount } = await pool.query(
      `UPDATE courses SET hidden = TRUE WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );
    if (!rowCount) return res.status(404).json({ message: 'Course not found' });
    res.json({ ok: true, message: 'Course hidden.' });
  } catch (err) {
    console.error('[hide course] error:', err);
    res.status(500).json({ message: 'Failed to hide course' });
  }
});

// Unhide a course
router.patch('/courses/:id/unhide', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  try {
    const { rowCount } = await pool.query(
      `UPDATE courses SET hidden = FALSE WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );
    if (!rowCount) return res.status(404).json({ message: 'Course not found' });
    res.json({ ok: true, message: 'Course unhidden.' });
  } catch (err) {
    console.error('[unhide course] error:', err);
    res.status(500).json({ message: 'Failed to unhide course' });
  }
});

module.exports = router;