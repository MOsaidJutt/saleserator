const express = require('express');
const router = express.Router();
const db = require('../../db');
const { auth, requireRole } = require('../../middleware/auth');

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

function pad2(n) { return String(n).padStart(2, '0'); }
function isoYmdUTC(d) { return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
function isoYmUTC(d) { return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`; }
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
  if (p === 'daily') { d.setUTCDate(d.getUTCDate() - 1); return buildPeriodKey('daily', d); }
  if (p === 'weekly') { d.setUTCDate(d.getUTCDate() - 7); return buildPeriodKey('weekly', d); }
  if (p === 'monthly') { d.setUTCMonth(d.getUTCMonth() - 1); return buildPeriodKey('monthly', d); }
  if (p === 'all') return 'all';
  d.setUTCDate(d.getUTCDate() - 1);
  return buildPeriodKey('daily', d);
}

// Admin Command Center (period-aware, company scoped)
router.get('/dashboard', auth, requireRole('admin'), async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const period = String(req.query.period || 'daily').toLowerCase();
    const { startSql, endSql, prevStartSql, prevEndSql } = getRange(period);
    const periodKey = buildPeriodKey(period);
    const prevPeriodKey = buildPrevPeriodKey(period);

    // Team SP current vs previous (company scoped)
    const teamSpQuery = `
      SELECT COALESCE(SUM(lb.total_points), 0)::bigint AS sp
        FROM leaderboards lb
        JOIN users u ON u.user_id = lb.user_id
       WHERE lb.period = $1
         AND u.company_id = $2
         AND LOWER(COALESCE(u.role, '')) <> 'admin'
         AND u.name IS NOT NULL
         AND btrim(u.name) <> ''
    `;
    const teamSpCurRes = await db.query(teamSpQuery, [periodKey, company_id]);
    const teamSpPrevRes = await db.query(teamSpQuery, [prevPeriodKey, company_id]);

    // Category totals (company scoped via users JOIN)
    const categoryCurQ = `
      SELECT
        COUNT(*) FILTER (WHERE a.category_id = 1)::int AS combat_current,
        COUNT(*) FILTER (WHERE a.category_id = 2)::int AS intel_current,
        COUNT(*) FILTER (WHERE a.category_id = 3)::int AS training_current
        FROM activities a
        JOIN users u ON u.user_id = a.user_id
       WHERE u.company_id = $1
         AND a.date_logged::date >= ${startSql}
         AND a.date_logged::date <= ${endSql}
    `;
    const categoryPrevQ = `
      SELECT
        COUNT(*) FILTER (WHERE a.category_id = 1)::int AS combat_previous,
        COUNT(*) FILTER (WHERE a.category_id = 2)::int AS intel_previous,
        COUNT(*) FILTER (WHERE a.category_id = 3)::int AS training_previous
        FROM activities a
        JOIN users u ON u.user_id = a.user_id
       WHERE u.company_id = $1
         AND a.date_logged::date >= ${prevStartSql}
         AND a.date_logged::date <= ${prevEndSql}
    `;
    const [curCat, prevCat] = await Promise.all([
      db.query(categoryCurQ, [company_id]),
      db.query(categoryPrevQ, [company_id]),
    ]);

    const dealsCurQ = `
      SELECT COUNT(*)::int AS deals_current
        FROM activities a
        JOIN users u ON u.user_id = a.user_id
       WHERE a.activity_type = 'Deals'
         AND u.company_id = $1
         AND a.date_logged::date >= ${startSql}
         AND a.date_logged::date <= ${endSql}
    `;
    const dealsPrevQ = `
      SELECT COUNT(*)::int AS deals_previous
        FROM activities a
        JOIN users u ON u.user_id = a.user_id
       WHERE a.activity_type = 'Deals'
         AND u.company_id = $1
         AND a.date_logged::date >= ${prevStartSql}
         AND a.date_logged::date <= ${prevEndSql}
    `;
    const [dealsCurRes, dealsPrevRes] = await Promise.all([
      db.query(dealsCurQ, [company_id]),
      db.query(dealsPrevQ, [company_id]),
    ]);

    // Mission distribution
    const combatCur = Number(curCat.rows[0]?.combat_current || 0);
    const intelCur = Number(curCat.rows[0]?.intel_current || 0);
    const trainingCur = Number(curCat.rows[0]?.training_current || 0);
    const missionTotal = combatCur + intelCur + trainingCur;
    const safeTotal = missionTotal > 0 ? missionTotal : 1;
    const combatPct = Math.round((combatCur / safeTotal) * 100);
    const intelPct = Math.round((intelCur / safeTotal) * 100);
    const trainingPct = Math.round((trainingCur / safeTotal) * 100);
    let dominant = 'Combat';
    if (intelCur >= combatCur && intelCur >= trainingCur) dominant = 'R&D / Intel';
    else if (trainingCur >= combatCur && trainingCur >= intelCur) dominant = 'Training';

    // Top performers (company scoped, company-scoped rank via RANK() OVER)
    const topQuery = `
      SELECT
        u.user_id,
        u.name AS user_name,
        up.rank_name AS user_rank,
        COALESCE(lb.total_points, 0)::bigint AS sp,
        RANK() OVER (ORDER BY lb.total_points DESC) AS rank,
        COUNT(*) FILTER (WHERE a.category_id = 1) AS combat_count,
        COUNT(*) FILTER (WHERE a.category_id = 2) AS rd_intel_count,
        COUNT(*) FILTER (WHERE a.category_id = 3) AS training_count,
        COUNT(*) FILTER (WHERE a.activity_type = 'Deals') AS deals_count
      FROM leaderboards lb
      JOIN users u ON u.user_id = lb.user_id
      LEFT JOIN user_profile up ON up.user_id = u.user_id
      LEFT JOIN activities a ON a.user_id = u.user_id
        AND a.date_logged::date >= ${startSql}
        AND a.date_logged::date <= ${endSql}
      WHERE lb.period = $1
        AND u.company_id = $2
        AND LOWER(COALESCE(u.role, '')) <> 'admin'
        AND u.name IS NOT NULL
        AND btrim(u.name) <> ''
      GROUP BY u.user_id, u.name, up.rank_name, lb.total_points
      ORDER BY lb.total_points DESC
      LIMIT 10
    `;
    const topRes = await db.query(topQuery, [periodKey, company_id]);

    // At-risk reps (company scoped)
    const atRiskQuery = `
      WITH per_user AS (
        SELECT
          u.user_id,
          u.name,
          COALESCE(COUNT(*) FILTER (WHERE a.date_logged = CURRENT_DATE), 0)::int AS actions_today,
          COALESCE(COUNT(*) FILTER (
            WHERE a.date_logged >= (CURRENT_DATE - INTERVAL '2 days')::date
              AND a.date_logged <= CURRENT_DATE
          ), 0)::int AS actions_last_3,
          COALESCE(COUNT(*) FILTER (
            WHERE a.date_logged >= (CURRENT_DATE - INTERVAL '5 days')::date
              AND a.date_logged <= (CURRENT_DATE - INTERVAL '3 days')::date
          ), 0)::int AS actions_prev_3
        FROM users u
        LEFT JOIN activities a ON a.user_id = u.user_id
        WHERE u.company_id = $1
          AND LOWER(COALESCE(u.role, '')) <> 'admin'
          AND u.name IS NOT NULL
          AND btrim(u.name) <> ''
        GROUP BY u.user_id, u.name
      )
      SELECT
        user_id, name, actions_today, actions_last_3, actions_prev_3,
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
    const atRiskRes = await db.query(atRiskQuery, [company_id]);

    // Recent activity feed (company scoped)
    const recentActivityQuery = `
      SELECT
        u.name AS user_name,
        a.activity_type,
        a.points,
        a.updated_at
      FROM activities a
      JOIN users u ON a.user_id = u.user_id
      WHERE u.company_id = $1
        AND LOWER(TRIM(a.activity_type)) NOT IN ('course_completed', 'video_completed')
      ORDER BY a.updated_at DESC
      LIMIT 10
    `;
    const recentActivityRes = await db.query(recentActivityQuery, [company_id]);

    // Monthly SP (company scoped)
    const monthlySpQuery = `
      SELECT COALESCE(SUM(a.points), 0)::bigint AS sp_month
        FROM activities a
        JOIN users u ON u.user_id = a.user_id
       WHERE u.company_id = $1
         AND a.date_logged >= date_trunc('month', CURRENT_DATE)::date
         AND a.date_logged <= CURRENT_DATE
    `;
    const monthlySpRes = await db.query(monthlySpQuery, [company_id]);

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
      category_totals: {
        combat_ops: {
          current: combatCur,
          previous: prevCat.rows[0]?.combat_previous || 0,
        },
        rd_intel: {
          current: intelCur,
          previous: prevCat.rows[0]?.intel_previous || 0,
        },
        training: {
          current: trainingCur,
          previous: prevCat.rows[0]?.training_previous || 0,
        },
      },
      mission_distribution: {
        combat_pct: combatPct,
        intel_pct: intelPct,
        training_pct: trainingPct,
        dominant,
        totals: { combat: combatCur, intel: intelCur, training: trainingCur, total: missionTotal },
      },
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