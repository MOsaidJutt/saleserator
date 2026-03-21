const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { auth, requireRole } = require('../../middleware/auth');

function csvSafe(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
async function streamCsv(res, filename, header, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write(header.join(',') + '\n');
  for await (const r of rows) res.write(r.map(csvSafe).join(',') + '\n');
  res.end();
}

// GET /admin/activities
router.get('/activities', auth, requireRole('admin'), async (req, res) => {
  const {
    start,
    end,
    user_id,
    type,
    q = '',
    page = 1,
    page_size = 50,
  } = req.query;

  if (!start || !end)
    return res.status(400).json({ error: 'start and end are required' });

  const company_id = req.user?.company_id;
  if (!company_id)
    return res.status(403).json({ error: 'No company context' });

  const limit = Math.min(Number(page_size) || 50, 500);
  const offset = ((Number(page) || 1) - 1) * limit;

  const validUserId = user_id === '' || user_id === 'null' ? null : user_id;
  const validType = type === '' || type === 'null' ? null : type;

  const query = `
    SELECT a.activity_id, a.user_id, u.name, a.activity_type, a.value, a.points,
           a.date_logged, a.is_deleted, a.edited_by_admin_id, a.edit_reason, a.updated_at
    FROM activities a
    JOIN users u ON u.user_id = a.user_id
    WHERE u.company_id = $1
      AND a.date_logged::date BETWEEN $2::date AND $3::date
      AND ($4::integer IS NULL OR a.user_id = $4::integer)
      AND ($5::text IS NULL OR a.activity_type ILIKE $5)
      AND ($6 = '' OR u.name ILIKE '%' || $6 || '%')
    ORDER BY a.date_logged DESC, a.activity_id DESC
    LIMIT $7 OFFSET $8
  `;

  const { rows } = await pool.query(query, [
    company_id,
    start,
    end,
    validUserId,
    validType,
    q,
    limit,
    offset,
  ]);

  res.json({ items: rows, page: Number(page) || 1, page_size: limit });
});

// PATCH /admin/activities/edit/:id
router.patch(
  '/activities/edit/:id',
  auth,
  requireRole('admin'),
  async (req, res) => {
    const { id } = req.params;
    const company_id = req.user?.company_id;

    const {
      activity_type,
      value,
      points,
      date_logged,
      is_deleted,
      edit_reason,
    } = req.body || {};
    const admin_id = req.user?.id;

    if (!edit_reason || !edit_reason.trim()) {
      return res.status(400).json({ error: 'edit_reason is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify activity belongs to admin's company
      const cur = await client.query(
        `SELECT a.activity_id, a.user_id, a.activity_type, a.value, a.points, a.is_deleted
         FROM activities a
         JOIN users u ON u.user_id = a.user_id
         WHERE a.activity_id = $1 AND u.company_id = $2
         FOR UPDATE`,
        [id, company_id],
      );

      if (!cur.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Activity not found' });
      }
      const current = cur.rows[0];

      const typeToUse = activity_type ?? current.activity_type;
      const rule = await client.query(
        'SELECT points_per_unit FROM activity_point_rules WHERE activity_type=$1',
        [typeToUse],
      );
      const ppu = rule.rows[0]?.points_per_unit ?? 0;

      const newValue = value ?? current.value;
      const newPoints = (newValue || 0) * ppu;

      const finalIsDeleted =
        typeof is_deleted === 'boolean' ? is_deleted : current.is_deleted;
      const effectiveOldPoints = current.is_deleted ? 0 : current.points || 0;
      const effectiveNewPoints = finalIsDeleted ? 0 : newPoints;
      const diff = effectiveNewPoints - effectiveOldPoints;

      await client.query(
        `UPDATE activities
         SET value = COALESCE($2, value),
             activity_type = COALESCE($3, activity_type),
             date_logged = COALESCE($4::date, date_logged),
             is_deleted = COALESCE($5, is_deleted),
             points = $6,
             edit_reason = $7,
             edited_by_admin_id = $8,
             updated_at = now()
         WHERE activity_id = $1`,
        [id, value, activity_type, date_logged, is_deleted, points, edit_reason, admin_id],
      );

      if (diff !== 0) {
        await client.query(
          `UPDATE user_points
           SET points = GREATEST(0, points + $2)
           WHERE user_id = $1`,
          [current.user_id, diff],
        );
      }

      await client.query(
        `INSERT INTO activity_audit_log
           (activity_id, admin_id, action, old_points, new_points, reason, created_at)
         VALUES ($1, $2, 'edited', $3, $4, $5, now())`,
        [id, admin_id, effectiveOldPoints, effectiveNewPoints, edit_reason],
      );

      await client.query('COMMIT');
      res.json({ ok: true, diff });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[admin patch activity] error:', e);
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  },
);

// DELETE /admin/activities/:id
router.delete(
  '/activities/:id',
  auth,
  requireRole('admin'),
  async (req, res) => {
    const { id } = req.params;
    const company_id = req.user?.company_id;
    const { reason = 'admin deleted' } = req.body || {};
    const admin_id = req.user?.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify activity belongs to admin's company
      const cur = await client.query(
        `SELECT a.activity_id, a.user_id, a.points, a.is_deleted
         FROM activities a
         JOIN users u ON u.user_id = a.user_id
         WHERE a.activity_id = $1 AND u.company_id = $2
         FOR UPDATE`,
        [id, company_id],
      );

      if (!cur.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Activity not found' });
      }
      const act = cur.rows[0];

      if (act.is_deleted) {
        await client.query('ROLLBACK');
        return res.json({ ok: true, message: 'already deleted' });
      }

      await client.query(
        `UPDATE activities
         SET is_deleted = TRUE,
             points = 0,
             edit_reason = $2,
             edited_by_admin_id = $3,
             updated_at = now()
         WHERE activity_id = $1`,
        [id, reason, admin_id],
      );

      const subtract = act.points || 0;
      if (subtract > 0) {
        await client.query(
          `UPDATE user_points
           SET total_points = GREATEST(0, total_points - $2)
           WHERE user_id = $1`,
          [act.user_id, subtract],
        );
      }

      await client.query(
        `INSERT INTO activity_audit_log
           (activity_id, admin_id, action, old_points, new_points, reason, created_at)
         VALUES ($1, $2, 'deleted', $3, 0, $4, now())`,
        [id, admin_id, subtract, reason],
      );

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[admin delete activity] error:', e);
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  },
);

// GET /admin/activities/export.csv
router.get(
  '/activities/export.csv',
  auth,
  requireRole('admin'),
  async (req, res) => {
    const { start, end, user_id = null, type = null, q = '' } = req.query;
    if (!start || !end)
      return res.status(400).json({ error: 'start and end are required' });

    const company_id = req.user?.company_id;
    if (!company_id)
      return res.status(403).json({ error: 'No company context' });

    const { rows } = await pool.query(
      `SELECT a.user_id, u.name, a.activity_type, a.value, a.points,
              a.date_logged, a.is_deleted, a.edit_reason
       FROM activities a
       JOIN users u ON u.user_id = a.user_id
       WHERE u.company_id = $1
         AND a.date_logged BETWEEN $2::date AND $3::date
         AND ($4::integer IS NULL OR a.user_id = $4::integer)
         AND ($5::text IS NULL OR a.activity_type = $5)
         AND ($6 = '' OR u.name ILIKE '%' || $6 || '%')
       ORDER BY a.date_logged DESC, a.activity_id DESC`,
      [company_id, start, end, user_id, type, q],
    );

    async function* rowsIter() {
      for (const r of rows)
        yield [r.user_id, r.name, r.activity_type, r.value, r.points,
               r.date_logged, r.is_deleted, r.edit_reason];
    }
    streamCsv(
      res,
      `activities_${start}_to_${end}.csv`,
      ['user_id', 'name', 'activity_type', 'quantity', 'points',
       'date_logged', 'is_deleted', 'edit_reason'],
      rowsIter(),
    );
  },
);

// ── Activity Rules ──────────────────────────────────────────

router.get('/activity-rules', auth, requireRole('admin'), async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM activity_point_rules ORDER BY sort_order, activity_type',
  );
  res.json({ items: rows });
});

router.post('/activity-rules', auth, requireRole('admin'), async (req, res) => {
  const { activity_type, points_per_unit, is_active = true, daily_cap = null, sort_order = 0 } = req.body || {};
  if (!activity_type || points_per_unit == null)
    return res.status(400).json({ error: 'activity_type and points_per_unit required' });

  await pool.query(
    `INSERT INTO activity_point_rules (activity_type, points_per_unit, is_active, daily_cap, sort_order, updated_at)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (activity_type) DO UPDATE
       SET points_per_unit=EXCLUDED.points_per_unit, is_active=EXCLUDED.is_active,
           daily_cap=EXCLUDED.daily_cap, sort_order=EXCLUDED.sort_order, updated_at=now()`,
    [activity_type, points_per_unit, is_active, daily_cap, sort_order],
  );
  res.json({ ok: true });
});

router.patch('/activity-rules/reorder', auth, requireRole('admin'), async (req, res) => {
  const items = req.body?.items || [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      await client.query(
        `UPDATE activity_point_rules SET sort_order=$2, updated_at=now() WHERE activity_type=$1`,
        [it.activity_type, it.sort_order],
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── Recompute Points ────────────────────────────────────────

router.post('/recompute-points', auth, requireRole('admin'), async (req, res) => {
  const { start, end, user_id = null } = req.body || {};
  if (!start || !end)
    return res.status(400).json({ error: 'start and end required' });

  const company_id = req.user?.company_id;

  await pool.query(
    `UPDATE activities a
     SET points = a.value * r.points_per_unit, updated_at = now()
     FROM activity_point_rules r
     JOIN users u ON u.user_id = a.user_id
     WHERE a.activity_type = r.activity_type
       AND a.is_deleted = FALSE
       AND a.date_logged BETWEEN $1 AND $2
       AND u.company_id = $3
       AND ($4::integer IS NULL OR a.user_id = $4::integer)`,
    [start, end, company_id, user_id],
  );
  res.json({ ok: true });
});

// ── Manual Point Adjustments ────────────────────────────────

router.post('/points/adjust', auth, requireRole('admin'), async (req, res) => {
  const { user_id, amount, reason } = req.body || {};
  if (!user_id || amount == null || !reason)
    return res.status(400).json({ error: 'user_id, amount, reason required' });

  const company_id = req.user?.company_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify user belongs to admin's company
    const check = await client.query(
      'SELECT user_id FROM users WHERE user_id=$1 AND company_id=$2',
      [user_id, company_id],
    );
    if (!check.rowCount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'User not in your company' });
    }

    await client.query(
      `INSERT INTO point_adjustments (user_id, amount, reason, admin_id, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [user_id, amount, reason, req.user.id],
    );

    await client.query(
      `UPDATE user_points
       SET total_points = GREATEST(0, total_points + $2)
       WHERE user_id = $1`,
      [user_id, amount],
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[points/adjust] error:', e);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.get('/points/history/:userId', auth, requireRole('admin'), async (req, res) => {
  const { userId } = req.params;
  const company_id = req.user?.company_id;

  // Verify user belongs to admin's company
  const check = await pool.query(
    'SELECT user_id FROM users WHERE user_id=$1 AND company_id=$2',
    [userId, company_id],
  );
  if (!check.rowCount)
    return res.status(403).json({ error: 'User not in your company' });

  const { rows } = await pool.query(
    `SELECT id, user_id, amount, reason, admin_id, created_at
     FROM point_adjustments
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [userId],
  );
  res.json({ items: rows });
});

module.exports = router;