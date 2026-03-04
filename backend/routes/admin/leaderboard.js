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

// GET /admin/leaderboard (company scoped with company-scoped rank)
router.get('/leaderboard', auth, requireRole('admin'), async (req, res) => {
  const company_id = req.user.company_id;
  const {
    start,
    end,
    sort = 'points',
    page = 1,
    page_size = 50,
    search = '',
  } = req.query;

  if (!start || !end)
    return res.status(400).json({ error: 'start and end are required (YYYY-MM-DD)' });

  const limit = Math.min(Number(page_size) || 50, 200);
  const offset = ((Number(page) || 1) - 1) * limit;
  const sortSql = sort === 'name'
    ? 'u.name ASC, b.total_points DESC'
    : 'b.total_points DESC, u.name ASC';

  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT a.user_id,
             SUM(a.points) AS total_points,
             COUNT(*) FILTER (WHERE a.is_deleted = FALSE) AS activity_count
        FROM activities a
        JOIN users u ON u.user_id = a.user_id
       WHERE a.is_deleted = FALSE
         AND u.company_id = $3
         AND a.date_logged >= $1::date
         AND a.date_logged < ($2::date + INTERVAL '1 day')
       GROUP BY a.user_id
    )
    SELECT u.user_id,
           u.name,
           b.total_points,
           b.activity_count,
           RANK() OVER (ORDER BY b.total_points DESC, u.name ASC) AS rank
      FROM base b
      JOIN users u ON u.user_id = b.user_id
     WHERE $4 = '' OR u.name ILIKE '%' || $4 || '%'
     ORDER BY ${sortSql}
     LIMIT $5 OFFSET $6
    `,
    [start, end, company_id, search, limit, offset],
  );

  res.json({
    range: { start, end },
    items: rows,
    page: Number(page) || 1,
    page_size: limit,
  });
});

// GET /admin/leaderboard/user/:userId (company scoped)
router.get('/leaderboard/user/:userId', auth, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { start, end } = req.query;
    const company_id = req.user.company_id;

    if (!start || !end)
      return res.status(400).json({ error: 'start and end required' });

    // Verify user belongs to admin's company
    const { rows: userRows } = await pool.query(
      'SELECT user_id, name, email FROM users WHERE user_id = $1 AND company_id = $2',
      [userId, company_id],
    );

    if (!userRows.length)
      return res.status(404).json({ error: 'User not found in your company' });

    const { rows: breakdown } = await pool.query(
      `SELECT activity_type,
              COUNT(*) AS count,
              COALESCE(SUM(points), 0) AS total_points
         FROM activities
        WHERE user_id = $1
          AND is_deleted = FALSE
          AND date_logged >= $2::date
          AND date_logged < ($3::date + INTERVAL '1 day')
        GROUP BY activity_type
        ORDER BY total_points DESC`,
      [userId, start, end],
    );

    const { rows: recent } = await pool.query(
      `SELECT activity_id, activity_type, value, points, date_logged, updated_at, is_deleted
         FROM activities
        WHERE user_id = $1
          AND is_deleted = FALSE
          AND date_logged >= $2::date
          AND date_logged < ($3::date + INTERVAL '1 day')
        ORDER BY date_logged DESC, activity_id DESC
        LIMIT 100`,
      [userId, start, end],
    );

    return res.json({ user: userRows[0], breakdown, recent });
  } catch (err) {
    console.error('Error in /admin/leaderboard/user/:userId:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// CSV export (company scoped)
router.get('/leaderboard/export.csv', auth, requireRole('admin'), async (req, res) => {
  const { start, end } = req.query;
  const company_id = req.user.company_id;

  if (!start || !end)
    return res.status(400).json({ error: 'start and end are required' });

  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT a.user_id,
             SUM(a.points) AS total_points,
             COUNT(*) FILTER (WHERE a.is_deleted = FALSE) AS activity_count
        FROM activities a
        JOIN users u ON u.user_id = a.user_id
       WHERE a.is_deleted = FALSE
         AND u.company_id = $3
         AND a.date_logged >= $1::date
         AND a.date_logged < ($2::date + INTERVAL '1 day')
       GROUP BY a.user_id
    )
    SELECT u.name,
           b.total_points,
           b.activity_count,
           RANK() OVER (ORDER BY b.total_points DESC, u.name ASC) AS rank
      FROM base b
      JOIN users u ON u.user_id = b.user_id
     ORDER BY rank ASC
    `,
    [start, end, company_id],
  );

  async function* rowsIter() {
    for (const r of rows)
      yield [r.rank, r.name, r.total_points, r.activity_count];
  }

  streamCsv(
    res,
    `leaderboard_${start}_to_${end}.csv`,
    ['rank', 'name', 'points', 'activities'],
    rowsIter(),
  );
});

module.exports = router;