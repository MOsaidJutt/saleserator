// routes/user/leaderboard.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { auth } = require('../../middleware/auth');

/**
 * GET /leaderboard?period=daily|weekly|monthly|all&limit=50&offset=0&refresh=0
 */
router.get('/', auth, async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const period = (req.query.period || 'daily').toLowerCase();
    const refresh = String(req.query.refresh || '0') === '1';
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    // 1) Compute period key
    const { rows: keyRows } = await pool.query(
      `SELECT mk_period_key($1::text, CURRENT_DATE) AS key`,
      [period],
    );
    const periodKey = keyRows?.[0]?.key;
    if (!periodKey) return res.status(400).json({ error: 'invalid_period' });

    // 2) Optionally refresh snapshot
    if (refresh) {
      await pool.query(`SELECT refresh_leaderboard($1::text, CURRENT_DATE)`, [period]);
    }

    // 3) Fetch snapshot — company scoped with company-scoped RANK()
    const { rows } = await pool.query(
      `SELECT lb.user_id,
              lb.total_points AS points,
              u.name,
              u.email,
              RANK() OVER (ORDER BY lb.total_points DESC) AS rank
         FROM leaderboards lb
         JOIN users u ON u.user_id = lb.user_id
        WHERE lb.period = $1
          AND u.company_id = $2
        ORDER BY lb.total_points DESC
        LIMIT $3 OFFSET $4`,
      [periodKey, company_id, limit, offset],
    );

    const label =
      period === 'all'
        ? 'All time'
        : period === 'daily'
          ? periodKey.slice(6)
          : period === 'weekly'
            ? periodKey.slice(7)
            : periodKey.slice(8);

    res.json({
      period,
      key: periodKey,
      label,
      asOf: new Date().toISOString(),
      results: rows,
    });
  } catch (err) {
    console.error('GET /leaderboard failed', err);
    res.status(500).json({ error: 'leaderboard_failed' });
  }
});

/**
 * POST /leaderboard/refresh
 */
router.post('/refresh', auth, async (req, res) => {
  try {
    const period = (req.body?.period || 'daily').toLowerCase();
    const date = req.body?.date || null;

    if (date) {
      await pool.query('SELECT refresh_leaderboard($1::text, $2::date)', [period, date]);
    } else {
      await pool.query('SELECT refresh_leaderboard($1::text, CURRENT_DATE)', [period]);
    }

    const { rows } = await pool.query(
      `SELECT mk_period_key($1::text, COALESCE($2::date, CURRENT_DATE)) AS key`,
      [period, date],
    );
    res.json({ ok: true, period, key: rows?.[0]?.key || null });
  } catch (err) {
    console.error('POST /leaderboard/refresh failed', err);
    res.status(500).json({ error: 'refresh_failed' });
  }
});

module.exports = router;