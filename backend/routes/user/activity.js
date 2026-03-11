// routes/activity.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { auth } = require('../../middleware/auth');
const { broadcast } = require('../../utils/tvEvents');
const { updateUserRank } = require('../../utils/updateUserRank');
const { validate, activityLogSchema } = require('../../utils/validators');

function toTitleWithSpaces(s) {
  if (!s) return '';
  const spaced = String(s)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  return spaced
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function toCamelCase(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

function normalizeInboundType(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return /^[A-Z]/.test(t) && t.includes(' ')
    ? t
    : toTitleWithSpaces(t);
}

router.post(
  '/log',
  auth,
  validate(activityLogSchema),
  async (req, res) => {
    const { activityType, value, categoryId, dateLogged } = req.body;
    const userId = req.user.id;
    const company_id = req.user.company_id;

    try {
      const normalizedType = normalizeInboundType(activityType);

      const { rows: ruleRows } = await pool.query(
        `
        SELECT points_per_unit
        FROM activity_point_rules
        WHERE activity_type = $1
          AND company_id = $2
          AND is_active = TRUE
        `,
        [normalizedType, company_id]
      );

      if (!ruleRows.length) {
        return res.status(400).json({
          ok: false,
          error: `No active rule found for "${normalizedType}"`,
        });
      }

      const qty = Number(value);
      const points = qty * Number(ruleRows[0].points_per_unit || 0);

      const activityDate = dateLogged
        ? dateLogged
        : new Date().toISOString().slice(0, 10);

      const { rows } = await pool.query(
        `
        INSERT INTO activities (
          user_id,
          activity_type,
          category_id,
          points,
          value,
          date_logged
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING activity_id
        `,
        [userId, normalizedType, categoryId ?? null, points, qty, activityDate]
      );

      const activityId = rows[0].activity_id;

      // Refresh leaderboard snapshots (non-blocking)
      ['daily', 'weekly', 'monthly', 'all'].forEach((period) => {
        pool
          .query(
            'SELECT refresh_leaderboard($1::text, $2::date)',
            [period, activityDate]
          )
          .catch(() => {});
      });

      // Update rank
      const rankInfo = await updateUserRank(userId, company_id).catch(() => null);

      // Broadcast events
      broadcast('activity_logged', {
        userId,
        activityType: normalizedType,
        categoryId,
        points,
        ts: new Date().toISOString(),
      });

      if (normalizedType === 'Deals') {
        broadcast('deal_closed', {
          userId,
          points,
          ts: new Date().toISOString(),
        });
      }

      return res.json({
        ok: true,
        awardedPoints: points,
        activity: {
          activityId,
          activityType: normalizedType,
          categoryId,
          points,
          date: activityDate,
        },
        rank: rankInfo,
      });
    } catch (err) {
      console.error('POST /activity/log error:', err);
      return res.status(500).json({
        ok: false,
        error: 'Failed to log activity',
      });
    }
  }
);

router.get('/today', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const date = req.query.date;

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD).' });
    }

    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(points), 0)::bigint AS total
         FROM activities
        WHERE user_id = $1
          AND date_logged = $2::date`,
      [userId, date]
    );

    return res.json({ totalToday: Number(rows?.[0]?.total || 0) });
  } catch (err) {
    console.error('GET /activity/today error', err);
    return res.status(500).json({ error: 'Failed to fetch today total.' });
  }
});

router.get('/recent', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const date = req.query.date;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD).' });
    }

    const { rows } = await pool.query(
      `SELECT activity_id, activity_type, points, date_logged
         FROM activities
        WHERE user_id = $1
          AND date_logged = $2::date
        ORDER BY activity_id DESC
        LIMIT $3`,
      [userId, date, limit]
    );

    return res.json({
      items: rows.map((r) => ({
        activityId: r.activity_id,
        activityType: r.activity_type,
        points: Number(r.points || 0),
        dateLogged: r.date_logged,
      })),
    });
  } catch (err) {
    console.error('GET /activity/recent error', err);
    return res.status(500).json({ error: 'Failed to fetch recent activity.' });
  }
});

router.get('/rules', auth, async (req, res) => {
  const company_id = req.user.company_id;

  const { rows } = await pool.query(
    `SELECT activity_type, points_per_unit, sort_order
       FROM activity_point_rules
      WHERE is_active = TRUE
        AND company_id = $1
      ORDER BY sort_order, activity_type`,
    [company_id]
  );

  res.json({ items: rows });
});

router.get('/weights', auth, async (req, res) => {
  const company_id = req.user.company_id;

  const { rows } = await pool.query(
    `SELECT activity_type, points_per_unit
       FROM activity_point_rules
      WHERE is_active = TRUE
        AND company_id = $1
      ORDER BY sort_order, activity_type`,
    [company_id]
  );

  const map = {};
  for (const r of rows) {
    map[toCamelCase(r.activity_type)] = Number(r.points_per_unit);
  }

  res.json(map);
});

module.exports = router;