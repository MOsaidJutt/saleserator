const express = require('express');
const router = express.Router();
const db = require('../../db');

// ------------------------------
// Range helper for activities-based widgets
// ------------------------------
function getRange(period) {
  const p = String(period || 'daily').toLowerCase();
  if (p === 'weekly') {
    return {
      startSql: `date_trunc('week', CURRENT_DATE)::date`,
      endSql: `CURRENT_DATE`,
      prevStartSql: `(date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::date`,
      prevEndSql: `(date_trunc('week', CURRENT_DATE) - INTERVAL '1 day')::date`,
    };
  }
  if (p === 'monthly') {
    return {
      startSql: `date_trunc('month', CURRENT_DATE)::date`,
      endSql: `CURRENT_DATE`,
      prevStartSql: `(date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date`,
      prevEndSql: `(date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date`,
    };
  }
  if (p === 'all') {
    return {
      startSql: `'1970-01-01'::date`,
      endSql: `CURRENT_DATE`,
      prevStartSql: `'1970-01-01'::date`,
      prevEndSql: `CURRENT_DATE`,
    };
  }
  // daily default
  return {
    startSql: `CURRENT_DATE`,
    endSql: `CURRENT_DATE`,
    prevStartSql: `(CURRENT_DATE - INTERVAL '1 day')::date`,
    prevEndSql: `(CURRENT_DATE - INTERVAL '1 day')::date`,
  };
}

// ------------------------------
// Period key helpers for leaderboards.period
// VERIFIED formats:
// - daily:YYYY-MM-DD
// - weekly:YYYY-WNN
// - monthly:YYYY-MM
// - all
// ------------------------------
function pad2(n) {
  return String(n).padStart(2, '0');
}
function isoYmdUTC(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function isoYmUTC(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}
function isoWeekKeyUTC(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
function buildPeriodKey(period, refDate = new Date()) {
  const p = String(period || 'daily').toLowerCase();
  if (p === 'daily') return `daily:${isoYmdUTC(refDate)}`;
  if (p === 'weekly') return `weekly:${isoWeekKeyUTC(refDate)}`;
  if (p === 'monthly') return `monthly:${isoYmUTC(refDate)}`;
  if (p === 'all') return 'all';
  return `daily:${isoYmdUTC(refDate)}`;
}
function buildPrevPeriodKey(period) {
  const p = String(period || 'daily').toLowerCase();
  const d = new Date();

  if (p === 'daily') {
    d.setUTCDate(d.getUTCDate() - 1);
    return buildPeriodKey('daily', d);
  }
  if (p === 'weekly') {
    d.setUTCDate(d.getUTCDate() - 7);
    return buildPeriodKey('weekly', d);
  }
  if (p === 'monthly') {
    d.setUTCMonth(d.getUTCMonth() - 1);
    return buildPeriodKey('monthly', d);
  }
  if (p === 'all') return 'all';

  d.setUTCDate(d.getUTCDate() - 1);
  return buildPeriodKey('daily', d);
}

// ------------------------------
// Admin Command Center (period-aware)
// ------------------------------
router.get('/dashboard', async (req, res) => {
  try {
    // ✅ default daily
    const period = String(req.query.period || 'daily').toLowerCase();

    // Activities time windows (for summary & feed)
    const { startSql, endSql, prevStartSql, prevEndSql } = getRange(period);

    // Leaderboards period keys (for leaderboard + total SP KPI)
    const periodKey = buildPeriodKey(period);
    const prevPeriodKey = buildPrevPeriodKey(period);

    // -------------------------
    // Team SP current vs previous period (FROM leaderboards)
    // Excludes admins + blank names (so KPI matches rankings population)
    // -------------------------
    const teamSpQuery = `
      SELECT COALESCE(SUM(lb.total_points),0)::bigint AS sp
      FROM leaderboards lb
      JOIN users u ON u.user_id = lb.user_id
      WHERE lb.period = $1
        AND LOWER(COALESCE(u.role, '')) <> 'admin'
        AND u.name IS NOT NULL
        AND btrim(u.name) <> ''
    `;
    const teamSpCurRes = await db.query(teamSpQuery, [periodKey]);
    const teamSpPrevRes = await db.query(teamSpQuery, [prevPeriodKey]);

    /* ===== CATEGORY TOTALS ===== */
    const curQ = `
      SELECT
        COUNT(*) FILTER (WHERE LOWER(TRIM(activity_type)) IN
          ('calls','emails','textmessages','doors knocked','presentations','appointments')
        )::int AS combat_ops_current,

        COUNT(*) FILTER (WHERE LOWER(TRIM(activity_type)) IN
          ('networking events','referrals received','social media post')
        )::int AS rd_intel_current,

        COUNT(*) FILTER (WHERE LOWER(TRIM(activity_type)) IN
          ('course_completed','video_completed')
        )::int AS training_current
      FROM activities
      WHERE date_logged::date >= ${startSql}
        AND date_logged::date <= ${endSql}
    `;
    const prevQ = `
      SELECT
        COUNT(*) FILTER (WHERE LOWER(TRIM(activity_type)) IN
          ('calls','emails','textmessages','doors knocked','presentations','appointments')
        )::int AS combat_ops_previous,

        COUNT(*) FILTER (WHERE LOWER(TRIM(activity_type)) IN
          ('networking events','referrals received','social media post')
        )::int AS rd_intel_previous,

        COUNT(*) FILTER (WHERE LOWER(TRIM(activity_type)) IN
          ('course_completed','video_completed')
        )::int AS training_previous
      FROM activities
      WHERE date_logged::date >= ${prevStartSql}
        AND date_logged::date <= ${prevEndSql}
    `;

    const cur = (await db.query(curQ)).rows[0];
    const prev = (await db.query(prevQ)).rows[0];

    const category_totals = {
      combat_ops: { current: cur.combat_ops_current, previous: prev.combat_ops_previous },
      rd_intel: { current: cur.rd_intel_current, previous: prev.rd_intel_previous },
      training: { current: cur.training_current, previous: prev.training_previous },
    };

    const dealsCurQ = `
      SELECT COUNT(*)::int AS deals_current
      FROM activities
      WHERE LOWER(TRIM(activity_type)) = 'deals'
        AND date_logged::date >= ${startSql}
        AND date_logged::date <= ${endSql}
    `;

    const dealsPrevQ = `
      SELECT COUNT(*)::int AS deals_previous
      FROM activities
      WHERE LOWER(TRIM(activity_type)) = 'deals'
        AND date_logged::date >= ${prevStartSql}
        AND date_logged::date <= ${prevEndSql}
    `;

    const dealsCurRes = await db.query(dealsCurQ);
    const dealsPrevRes = await db.query(dealsPrevQ);

    // -------------------------
    // Top Performers (FROM leaderboards) - exclude admins + blank names
    // -------------------------
    const topQuery = `
      SELECT
        u.user_id,
        u.name AS user_name,
        COALESCE(lb.total_points, 0)::bigint AS sp,
        lb.rank,

        -- Combat Ops per user
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(a.activity_type)) IN
            ('calls','emails','textmessages','doors knocked','presentations','appointments')
            AND a.date_logged::date >= ${startSql}
            AND a.date_logged::date <= ${endSql}
        )::int AS combat_count,

        -- Deals per user (Victories)
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(a.activity_type)) = 'deals'
            AND a.date_logged::date >= ${startSql}
            AND a.date_logged::date <= ${endSql}
        )::int AS deals_count,

        -- R&D / Intel per user
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(a.activity_type)) IN
            ('networking events','referrals received','social media post')
            AND a.date_logged::date >= ${startSql}
            AND a.date_logged::date <= ${endSql}
        )::int AS rd_intel_count,

        -- Training per user
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(a.activity_type)) IN
            ('course_completed','video_completed')
            AND a.date_logged::date >= ${startSql}
            AND a.date_logged::date <= ${endSql}
        )::int AS training_count

      FROM leaderboards lb
      JOIN users u ON u.user_id = lb.user_id
      LEFT JOIN activities a ON a.user_id = u.user_id

      WHERE lb.period = $1
        AND LOWER(COALESCE(u.role,'')) <> 'admin'
        AND u.name IS NOT NULL
        AND btrim(u.name) <> ''

      GROUP BY u.user_id, u.name, lb.total_points, lb.rank
      ORDER BY lb.rank ASC
      LIMIT 10
    `;

    const topRes = await db.query(topQuery, [periodKey]);

    // -------------------------
    // At-Risk (today/3-day signals) — exclude admins + blank names
    // -------------------------
    const atRiskQuery = `
      WITH per_user AS (
        SELECT
          u.user_id,
          u.name,
          COALESCE(COUNT(*) FILTER (WHERE a.date_logged = CURRENT_DATE),0)::int AS actions_today,
          COALESCE(COUNT(*) FILTER (
            WHERE a.date_logged >= (CURRENT_DATE - INTERVAL '2 days')::date
              AND a.date_logged <= CURRENT_DATE
          ),0)::int AS actions_last_3,
          COALESCE(COUNT(*) FILTER (
            WHERE a.date_logged >= (CURRENT_DATE - INTERVAL '5 days')::date
              AND a.date_logged <= (CURRENT_DATE - INTERVAL '3 days')::date
          ),0)::int AS actions_prev_3
        FROM users u
        LEFT JOIN activities a ON a.user_id = u.user_id
        WHERE LOWER(COALESCE(u.role, '')) <> 'admin'
          AND u.name IS NOT NULL
          AND btrim(u.name) <> ''
        GROUP BY u.user_id, u.name
      )
      SELECT
        user_id,
        name,
        actions_today,
        actions_last_3,
        actions_prev_3,
        CASE
          WHEN actions_today = 0 THEN 'red'
          WHEN actions_last_3 < actions_prev_3 THEN 'yellow'
          ELSE 'green'
        END AS status,
        CASE
          WHEN actions_today = 0 THEN 'No activity today'
          WHEN actions_last_3 < actions_prev_3 THEN 'Declining activity (3-day)'
          ELSE 'On track'
        END AS reason
      FROM per_user
      WHERE (actions_today = 0) OR (actions_last_3 < actions_prev_3)
      ORDER BY
        CASE WHEN actions_today = 0 THEN 0 ELSE 1 END,
        actions_today ASC,
        actions_last_3 ASC
      LIMIT 10
    `;
    const atRiskRes = await db.query(atRiskQuery);

    // -------------------------
    // Recent activity feed (last 10) — ignore course/video completions
    // -------------------------
    const recentActivityQuery = `
      SELECT
        u.name AS user_name,
        a.activity_type,
        a.points,
        a.updated_at
      FROM activities a
      JOIN users u ON a.user_id = u.user_id
      WHERE LOWER(TRIM(a.activity_type)) NOT IN ('course_completed','video_completed')
      ORDER BY a.updated_at DESC
      LIMIT 10
    `;
    const recentActivityRes = await db.query(recentActivityQuery);

    // -------------------------
    // Quota progress = this month (kept from activities)
    // -------------------------
    const monthlySpQuery = `
      SELECT COALESCE(SUM(points),0)::bigint AS sp_month
      FROM activities
      WHERE date_logged >= date_trunc('month', CURRENT_DATE)::date
        AND date_logged <= CURRENT_DATE
    `;
    const monthlySpRes = await db.query(monthlySpQuery);

    res.json({
      period,
      period_key: periodKey,
      previous_period_key: prevPeriodKey,
      team_sp: {
        current: Number(teamSpCurRes.rows?.[0]?.sp || 0),
        previous: Number(teamSpPrevRes.rows?.[0]?.sp || 0),
      },
      activity_summary: {
        deals_current: Number(dealsCurRes.rows[0]?.deals_current || 0),
        deals_previous: Number(dealsPrevRes.rows[0]?.deals_previous || 0),
      },
      category_totals,
      top_performers: topRes.rows || [],
      at_risk_reps: atRiskRes.rows || [],
      recent_activity: recentActivityRes.rows || [],

      quota_progress: {
        sp_month: Number(monthlySpRes.rows?.[0]?.sp_month || 0),
        goal_sp_month: null,
      },
    });
  } catch (error) {
    console.error('Admin dashboard backend error:', error);
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

module.exports = router;
