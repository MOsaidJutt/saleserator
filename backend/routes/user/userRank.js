const express = require('express');
const router = express.Router();

const pool = require('../../db');
const { auth } = require('../../middleware/auth');
const { computeRankProgress } = require('../../utils/rankProgress');
const { updateUserRank } = require('../../utils/updateUserRank');

/**
 * GET /users/rank/me
 * Returns the current user's rank progress, company scoped.
 */
router.get('/me', auth, async (req, res) => {
  try {
    const userId =
      req.user_id ??
      req.user?.user_id ??
      req.user?.id;

    const company_id = req.user?.company_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!company_id) {
      return res.status(400).json({ error: 'Company not found on token.' });
    }

    // try leaderboard snapshot first
    const { rows } = await pool.query(
      `SELECT lb.total_points
         FROM leaderboards lb
         JOIN users u ON u.user_id = lb.user_id
        WHERE lb.user_id = $1
          AND lb.period = 'all'
          AND u.company_id = $2
        ORDER BY lb.leaderboard_id DESC
        LIMIT 1`,
      [userId, company_id]
    );

    let totalSp;

    if (rows?.length) {
      totalSp = Number(rows[0].total_points || 0);
    } else {
      // fallback to rank engine
      const updated = await updateUserRank(userId, company_id);
      totalSp = Number(updated.totalSp || 0);
    }

    const progress = await computeRankProgress(totalSp, company_id);
    return res.json(progress);
  } catch (err) {
    console.error('GET /users/rank/me error', err);
    return res.status(500).json({ error: 'Failed to fetch rank.' });
  }
});

module.exports = router;