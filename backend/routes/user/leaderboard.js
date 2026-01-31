// routes/leaderboard.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { auth } = require('../../middleware/auth');

/**
 * GET /leaderboard?period=daily|weekly|monthly|all&limit=50&offset=0&refresh=0
 * Defaults to daily. Set refresh=1 to rebuild the snapshot from user_points before returning.
 */
router.get('/', auth, async (req, res) => {
  try {
    const period = (req.query.period || 'daily').toLowerCase();
    const refresh = String(req.query.refresh || '0') === '1';
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    // 1) Compute exact period key in Postgres (ISO-week aware)
    const { rows: keyRows } = await pool.query(
      `SELECT mk_period_key($1::text, CURRENT_DATE) AS key;`,
      [period],
    );
    const periodKey = keyRows?.[0]?.key;
    if (!periodKey) return res.status(400).json({ error: 'invalid_period' });

    // 2) Optionally refresh snapshot for this period
    if (refresh) {
      await pool.query(`SELECT refresh_leaderboard($1::text, CURRENT_DATE)`, [
        period,
      ]);
    }

    // 3) Fetch snapshot
    const { rows } = await pool.query(
      `
      SELECT lb.user_id,
             lb.total_points AS points,
             lb.rank,
             u.name,
             u.email
        FROM leaderboards lb
        LEFT JOIN users u ON u.user_id = lb.user_id
       WHERE lb.period = $1
       ORDER BY lb.rank ASC, lb.user_id ASC
       LIMIT $2 OFFSET $3
      `,
      [periodKey, limit, offset],
    );

    // Friendly label for UI
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
 * Body: { period?: 'daily'|'weekly'|'monthly'|'all', date?: 'YYYY-MM-DD' }
 * Forces rebuild; useful for cron/admin or backfills.
 */
router.post('/refresh', auth, async (req, res) => {
  try {
    const period = (req.body?.period || 'daily').toLowerCase();
    const date = req.body?.date || null;
    if (date)
      await pool.query('SELECT refresh_leaderboard($1::text, $2::date)', [
        period,
        date,
      ]);
    else
      await pool.query('SELECT refresh_leaderboard($1::text, CURRENT_DATE)', [
        period,
      ]);
    const { rows } = await pool.query(
      `SELECT mk_period_key($1::text, COALESCE($2::date, CURRENT_DATE)) AS key;`,
      [period, date],
    );
    res.json({ ok: true, period, key: rows?.[0]?.key || null });
  } catch (err) {
    console.error('POST /leaderboard/refresh failed', err);
    res.status(500).json({ error: 'refresh_failed' });
  }
});

module.exports = router;
