const express = require('express');
const router = express.Router();
const pool = require('../../db'); // Ensure you have a db connection pool
const { auth, requireRole } = require('../../middleware/auth'); // Authentication and Authorization middleware

// CSV helpers (used by exports)
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
// Leaderboard (admin)
// GET /admin/leaderboard?start=YYYY-MM-DD&end=YYYY-MM-DD&sort=points|name&search=&page=&page_size=
router.get('/leaderboard', auth, requireRole('admin'), async (req, res) => {
  const {
    start,
    end,
    sort = 'points',
    page = 1,
    page_size = 50,
    search = '',
  } = req.query;
  if (!start || !end)
    return res
      .status(400)
      .json({ error: 'start and end are required (YYYY-MM-DD)' });
  const limit = Math.min(Number(page_size) || 50, 200);
  const offset = ((Number(page) || 1) - 1) * limit;
  const sortSql =
    sort === 'name'
      ? 'u.name ASC, b.total_points DESC'
      : 'b.total_points DESC, u.name ASC';

  // TODO: add company_id filter here
  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT a.user_id, SUM(a.points) AS total_points,
             COUNT(*) FILTER (WHERE a.is_deleted = FALSE) AS activity_count
      FROM activities a
      WHERE a.is_deleted = FALSE
        AND a.date_logged >= $1::date
        AND a.date_logged < ($2::date + INTERVAL '1 day')
      GROUP BY a.user_id
    )
    SELECT u.user_id AS user_id, u.name, b.total_points, b.activity_count,
           RANK() OVER (ORDER BY b.total_points DESC, u.name ASC) AS rank
    FROM base b
    JOIN users u ON u.user_id = b.user_id
    WHERE $3 = '' OR u.name ILIKE '%' || $3 || '%'
    ORDER BY ${sortSql}
    LIMIT $4 OFFSET $5
  `,
    [start, end, search, limit, offset],
  );

  res.json({
    range: { start, end },
    items: rows,
    page: Number(page) || 1,
    page_size: limit,
  });
});

// NEW: Leaderboard user drilldown
// GET /admin/leaderboard/user/:userId?start=...&end=...
router.get(
  '/leaderboard/user/:userId',
  auth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({ error: 'start and end required' });
      }

      // TODO: verify user belongs to admin's company later
      const { rows: userRows } = await pool.query(
        'SELECT user_id, name, email FROM users WHERE user_id=$1',
        [userId],
      );

      if (!userRows.length) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Inclusive start-of-day, Exclusive next-day end boundary
      // This fixes video/course timestamps not showing on same-day ranges.
      const { rows: breakdown } = await pool.query(
        `
        SELECT activity_type,
               COUNT(*) AS count,
               COALESCE(SUM(points), 0) AS total_points
          FROM activities
         WHERE user_id = $1
           AND is_deleted = FALSE
           AND date_logged >= $2::date
           AND date_logged < ($3::date + INTERVAL '1 day')
         GROUP BY activity_type
         ORDER BY total_points DESC
        `,
        [userId, start, end],
      );

      const { rows: recent } = await pool.query(
        `
        SELECT activity_id, activity_type, value, points, date_logged, updated_at, is_deleted
          FROM activities
         WHERE user_id = $1
           AND is_deleted = FALSE
           AND date_logged >= $2::date
           AND date_logged < ($3::date + INTERVAL '1 day')
         ORDER BY date_logged DESC, activity_id DESC
         LIMIT 100
        `,
        [userId, start, end],
      );

      return res.json({
        user: userRows[0],
        breakdown,
        recent,
      });
    } catch (err) {
      console.error('Error in /admin/leaderboard/user/:userId:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// CSV export
router.get(
  '/leaderboard/export.csv',
  auth,
  requireRole('admin'),
  async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end)
      return res.status(400).json({ error: 'start and end are required' });

    // TODO: add company_id filter later
    const { rows } = await pool.query(
      `
    WITH base AS (
      SELECT a.user_id, SUM(a.points) AS total_points,
             COUNT(*) FILTER (WHERE a.is_deleted = FALSE) AS activity_count
      FROM activities a
      WHERE a.is_deleted = FALSE
        AND a.date_logged >= $1::date AND a.date_logged < ($2::date + INTERVAL '1 day')
      GROUP BY a.user_id
    )
    SELECT u.name, b.total_points, b.activity_count,
           RANK() OVER (ORDER BY b.total_points DESC, u.name ASC) AS rank
    FROM base b
    JOIN users u ON u.user_id = b.user_id
    ORDER BY rank ASC
  `,
      [start, end],
    );

    async function* rowsIter() {
      for (const r of rows)
        yield [r.rank, r.full_name, r.total_points, r.activity_count];
    }
    streamCsv(
      res,
      `leaderboard_${start}_to_${end}.csv`,
      ['rank', 'name', 'points', 'activities'],
      rowsIter(),
    );
  },
);

module.exports = router;