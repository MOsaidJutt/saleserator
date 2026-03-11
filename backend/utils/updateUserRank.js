const pool = require('../db');

/**
 * Recompute user's total SP and rank, store into user_profile.
 * Returns: { totalSp, rankName, prevRankName, rankedUp }
 */
async function updateUserRank(userId, company_id) {
  // Ensure profile row exists
  await pool.query(
    `INSERT INTO user_profile (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  // total SP from activities (scoped to company via users JOIN)
  const { rows: spRows } = await pool.query(
    `SELECT COALESCE(SUM(a.points), 0)::bigint AS total_sp
       FROM activities a
       JOIN users u ON u.user_id = a.user_id
      WHERE a.user_id = $1
        AND u.company_id = $2`,
    [userId, company_id]
  );

  const totalSp = Number(spRows?.[0]?.total_sp || 0);

  // current stored rank
  const { rows: curRows } = await pool.query(
    `SELECT rank_name FROM user_profile WHERE user_id = $1`,
    [userId]
  );
  const prevRankName = curRows?.[0]?.rank_name || 'Rookie';

  // determine rank using company-scoped rank_rules
  const { rows: rankRows } = await pool.query(
    `SELECT name
       FROM rank_rules
      WHERE min_sp <= $1
        AND company_id = $2
      ORDER BY min_sp DESC
      LIMIT 1`,
    [totalSp, company_id]
  );
  const rankName = rankRows?.[0]?.name || 'Rookie';

  // update snapshot
  await pool.query(
    `UPDATE user_profile
        SET total_sp = $2, rank_name = $3, updated_at = NOW()
      WHERE user_id = $1`,
    [userId, totalSp, rankName]
  );

  return {
    totalSp,
    rankName,
    prevRankName,
    rankedUp: rankName !== prevRankName,
  };
}

module.exports = { updateUserRank };