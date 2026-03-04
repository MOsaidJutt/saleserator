const express = require('express');
const pool = require('../../db');
const { auth } = require('../../middleware/auth');
const router = express.Router();

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0h 0m 0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

router.get('/dashboard', auth, async (req, res) => {
  const userId = req.user.user_id || req.user.id;
  const company_id = req.user.company_id;

  try {
    const now = new Date();
    const day = now.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;

    const thisWeekStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday
    ));

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setUTCDate(thisWeekStart.getUTCDate() - 7);

    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setUTCDate(thisWeekStart.getUTCDate() - 1);

    const thisWeekStartStr = isoDate(thisWeekStart);
    const lastWeekStartStr = isoDate(lastWeekStart);
    const lastWeekEndStr = isoDate(lastWeekEnd);

    // 1) Total Points
    const totalPointsQ = await pool.query(
      `SELECT COALESCE(SUM(p.points), 0) AS total_points
         FROM user_points p
        WHERE p.user_id = $1
          AND p.period_start_date >= date_trunc('week', CURRENT_DATE)`,
      [userId]
    );
    const totalPoints = Number(totalPointsQ.rows[0].total_points || 0);

    // 2) Courses Completed (company scoped)
    const completedQ = await pool.query(
      `SELECT COUNT(*)::int AS completed
         FROM user_progress up
         JOIN courses c ON c.id = up.course_id
        WHERE up.user_id = $1
          AND c.company_id = $2
          AND up.progress_percent >= 100`,
      [userId, company_id]
    );
    const coursesCompleted = Number(completedQ.rows[0].completed || 0);

    // 3) This Week Stats
    const thisWeekQ = await pool.query(
      `SELECT
          COALESCE(SUM(up.position_sec), 0) AS seconds_watched,
          COALESCE(COUNT(DISTINCT up.asset_id), 0) AS assets_viewed
         FROM user_video_progress up
        WHERE up.user_id = $1
          AND up.updated_at >= CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int - 1) * INTERVAL '1 day'
          AND up.updated_at < CURRENT_DATE + INTERVAL '1 day'`,
      [userId]
    );

    const secondsWatched = Number(thisWeekQ.rows[0].seconds_watched || 0);
    const formattedTimeWatched = formatTime(secondsWatched);

    const thisWeek = {
      secondsWatched: formattedTimeWatched,
      assetsViewed: Number(thisWeekQ.rows[0].assets_viewed || 0),
      activitiesPerformed: Number(thisWeekQ.rows[0].activities_performed || 0),
    };

    // 4) Weekly Change Percentage
    const lastWeekQ = await pool.query(
      `SELECT
          COALESCE(SUM(up.position_sec), 0) AS last_week_seconds
         FROM user_video_progress up
        WHERE up.user_id = $1
          AND up.updated_at >= $2
          AND up.updated_at <= $3`,
      [userId, lastWeekStartStr, lastWeekEndStr]
    );

    const lastWeekSeconds = Number(lastWeekQ.rows[0].last_week_seconds || 0);
    const weeklyChangePercent = lastWeekSeconds === 0
      ? 100
      : Math.round((secondsWatched - lastWeekSeconds) / lastWeekSeconds * 100);

    // 5) Enrolled Courses (company scoped)
    const enrolledQ = await pool.query(
      `SELECT
          c.id, c.title, c.category, c.points, c.thumbnail_url,
          COALESCE(up.progress_percent, 0) AS progress_percent
         FROM user_courses uc
         JOIN courses c ON c.id = uc.course_id
    LEFT JOIN user_progress up
           ON up.user_id = uc.user_id
          AND up.course_id = uc.course_id
        WHERE uc.user_id = $1
          AND c.company_id = $2
          AND c.is_active = TRUE
          AND c.hidden = FALSE
     ORDER BY c.title
     LIMIT 50`,
      [userId, company_id]
    );

    // 6) Recommended Courses (company scoped)
    const recommendedQ = await pool.query(
      `SELECT
          c.id, c.title, c.category, c.points, c.thumbnail_url, c.duration_seconds
         FROM courses c
        WHERE c.is_active = TRUE
          AND c.hidden = FALSE
          AND c.company_id = $2
          AND c.id NOT IN (
            SELECT course_id FROM user_courses WHERE user_id = $1
          )
     ORDER BY c.points DESC, c.title
     LIMIT 6`,
      [userId, company_id]
    );

    // 7) Recent Activities
    const recentActQ = await pool.query(
      `SELECT
          a.activity_type,
          a.date_logged,
          a.points
         FROM activities a
        WHERE a.user_id = $1
          AND a.date_logged >= $2
     ORDER BY a.date_logged DESC
     LIMIT 20`,
      [userId, thisWeekStartStr]
    );

    // 8) Leaderboard — WEEKLY (company scoped with company-scoped rank)
    const snapshotPeriod = 'weekly';

    await pool.query(
      `SELECT refresh_leaderboard($1::text, CURRENT_DATE)`,
      [snapshotPeriod]
    );

    const { rows: keyRows } = await pool.query(
      `SELECT mk_period_key($1::text, CURRENT_DATE) AS key`,
      [snapshotPeriod]
    );

    const periodKey = keyRows?.[0]?.key;
    let leaderboard = [];
    let currentRank = null;

    if (periodKey) {
      // Top 5 with company-scoped rank using RANK() OVER
      const lbQ = await pool.query(
        `SELECT lb.user_id,
                lb.total_points,
                u.name,
                RANK() OVER (ORDER BY lb.total_points DESC) AS rank
           FROM leaderboards lb
           JOIN users u ON u.user_id = lb.user_id
          WHERE lb.period = $1
            AND u.company_id = $2
          ORDER BY lb.total_points DESC
          LIMIT 5`,
        [periodKey, company_id]
      );

      leaderboard = lbQ.rows || [];

      // Current user's rank within their company only
      const rankQ = await pool.query(
        `SELECT COUNT(*) + 1 AS rank
           FROM leaderboards lb
           JOIN users u ON u.user_id = lb.user_id
          WHERE lb.period = $1
            AND u.company_id = $2
            AND lb.total_points > (
              SELECT COALESCE(lb2.total_points, 0)
                FROM leaderboards lb2
               WHERE lb2.period = $1
                 AND lb2.user_id = $3
            )`,
        [periodKey, company_id, userId]
      );

      if (rankQ.rows.length) {
        currentRank = Number(rankQ.rows[0].rank);
      }
    }

    return res.json({
      totalPoints,
      weeklyChangePercent,
      currentRank,
      coursesCompleted,
      thisWeek,
      enrolledCourses: enrolledQ.rows,
      recommended: recommendedQ.rows,
      recentActivities: recentActQ.rows,
      leaderboard,
    });

  } catch (err) {
    console.error('GET /dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load user dashboard' });
  }
});

module.exports = router;