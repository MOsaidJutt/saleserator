const express = require('express');
const router = express.Router();

const pool = require('../../db');
const { auth } = require('../../middleware/auth');
const { computeRankProgress } = require('../../utils/rankProgress');
const { updateUserRank } = require('../../utils/updateUserRank');

/**
 * GET /users/rank/me
 * Source of truth:
 * 1) leaderboards (period='all')
 * 2) fallback → activities via updateUserRank
 */
router.get('/me', auth, async (req, res) => {
  try {
    // supports common auth shapes
    const userId =
      req.user_id ??
      req.user?.user_id ??
      req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // try leaderboard snapshot first
    const { rows } = await pool.query(
      `SELECT total_points
         FROM leaderboards
        WHERE user_id = $1
          AND period = 'all'
        ORDER BY leaderboard_id DESC
        LIMIT 1`,
      [userId]
    );

    let totalSp;

    if (rows?.length) {
      totalSp = Number(rows[0].total_points || 0);
    } else {
      // fallback to rank engine
      const updated = await updateUserRank(userId);
      totalSp = Number(updated.totalSp || 0);
    }

    const progress = await computeRankProgress(totalSp);
    return res.json(progress);
  } catch (err) {
    console.error('GET /users/rank/me error', err);
    return res.status(500).json({ error: 'Failed to fetch rank.' });
  }
});

module.exports = router;
