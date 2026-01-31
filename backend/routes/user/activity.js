// routes/activity.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { auth } = require('../../middleware/auth');
const { broadcast } = require("../../utils/tvEvents.js"); // <-- path adjust
const { updateUserRank } = require("../../utils/updateUserRank");

/* ----------------------------- Type helpers ------------------------------ */

/** "textMessages" -> "Text Messages", "doors_knocked" -> "Doors Knocked" */
function toTitleWithSpaces(s) {
  if (!s) return '';
  const spaced = String(s)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** "Text Messages" -> "textMessages" (for back-compat /weights map) */
function toCamelCase(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

/** Normalize inbound type to match DB naming in activity_point_rules.activity_type */
function normalizeInboundType(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return /^[A-Z]/.test(t) && t.includes(' ') ? t : toTitleWithSpaces(t);
}

/* ------------------------------- Endpoints ------------------------------- */

// routes/activity.js  (only the /log route updated)
router.post("/log", auth, async (req, res) => {
  const body = req.body || {};
  const actingUserId = req.user.id;

  try {
    // ✅ SINGLE LOG (Mission Log uses this)
    const { activityType, value, dateLogged = new Date() } = body;
    const normalizedType = normalizeInboundType(activityType);

    if (!normalizedType || value == null) {
      return res
        .status(400)
        .json({ ok: false, error: "activityType and value are required" });
    }

    const { rows: rule } = await pool.query(
      `
      SELECT points_per_unit
        FROM activity_point_rules
       WHERE activity_type = $1
         AND is_active = TRUE
      `,
      [normalizedType]
    );

    if (!rule.length) {
      return res.status(400).json({
        ok: false,
        error: `No active rule found for activityType "${normalizedType}"`,
      });
    }

    const ppu = Number(rule[0].points_per_unit) || 0;
    const qty = Number(value) || 0;
    const points = qty * ppu;

    // ✅ SAFE date handling (no timezone shifting if it's already YYYY-MM-DD)
    let activityDateParam;
    if (typeof dateLogged === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLogged)) {
      activityDateParam = dateLogged;
    } else {
      activityDateParam = new Date(dateLogged || Date.now()).toISOString().slice(0, 10);
    }

    const { rows: insRows } = await pool.query(
      `
      INSERT INTO activities (user_id, activity_type, points, value, date_logged)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING activity_id
      `,
      [actingUserId, normalizedType, points, qty, activityDateParam]
    );

    const activityId = insRows?.[0]?.activity_id || null;

    // refresh snapshots (non-blocking)
    ["daily", "weekly", "monthly", "all"].forEach((p) => {
      pool
        .query("SELECT refresh_leaderboard($1::text, $2::date)", [
          p,
          activityDateParam,
        ])
        .catch((err) => console.error(`refresh_leaderboard ${p} failed`, err));
    });

    // ✅ Get user name once (used by TV + rank broadcasts)
    let userName = "Someone";
    try {
      const { rows: uRows } = await pool.query(
        "SELECT name FROM users WHERE user_id=$1",
        [actingUserId]
      );
      userName = uRows?.[0]?.name || userName;
    } catch (e) {
      console.error("fetch user name failed", e);
    }

    // ✅ Update rank snapshot + broadcast rank up
    // NOTE: add these imports at the TOP of the file:
    // const { updateUserRank } = require("../../utils/rankEngine");
    // const { broadcast } = require("../../utils/tvEvents");
    let rankPayload = null;
    try {
      const rankInfo = await updateUserRank(actingUserId);

      rankPayload = {
        totalSp: rankInfo.totalSp,
        rankName: rankInfo.rankName,
        prevRankName: rankInfo.prevRankName,
        rankedUp: rankInfo.rankedUp,
      };

      if (rankInfo.rankedUp) {
        broadcast("rank_up", {
          userId: actingUserId,
          userName,
          prevRank: rankInfo.prevRankName,
          newRank: rankInfo.rankName,
          totalSp: rankInfo.totalSp,
          ts: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("rank update failed", e);
    }

    // ✅ TV BROADCAST (activity + deal)
    try {
      broadcast("activity_logged", {
        userId: actingUserId,
        userName,
        activityType: normalizedType,
        value: qty,
        points,
        date: activityDateParam,
        activityId,
        ts: new Date().toISOString(),
      });

      if (normalizedType.toLowerCase().includes("deal")) {
        broadcast("deal_closed", {
          userId: actingUserId,
          userName,
          points,
          ts: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("TV broadcast failed", e);
    }

    return res.json({
      ok: true,
      insertedCount: 1,
      awardedPoints: points,
      activity: {
        activityId,
        activityType: normalizedType,
        value: qty,
        points,
        date: activityDateParam,
      },
      rank: rankPayload, // ✅ frontend can show Rank Up popup instantly
    });
  } catch (err) {
    console.error("Error in /activity/log", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to log activity",
    });
  }
});

// GET /users/activity/today?date=YYYY-MM-DD
router.get('/today', auth, async (req, res) => {
  try {
    const userId = req.user_id ?? req.user?.user_id ?? req.user?.id;
    const date = req.query.date;

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD).' });
    }

    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(points), 0)::bigint AS total
         FROM activities
        WHERE user_id = $1
          AND date_logged = $2::date`,
      [userId, date]
    );

    return res.json({ totalToday: Number(rows?.[0]?.total || 0) });
  } catch (err) {
    console.error('GET /activity/today error', err);
    return res.status(500).json({ error: 'Failed to fetch today total.' });
  }
});

// GET /users/activity/recent?date=YYYY-MM-DD&limit=12
router.get('/recent', auth, async (req, res) => {
  try {
    const userId = req.user_id ?? req.user?.user_id ?? req.user?.id;
    const date = req.query.date;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD).' });
    }

    const { rows } = await pool.query(
      `SELECT activity_id, activity_type, points, date_logged
         FROM activities
        WHERE user_id = $1
          AND date_logged = $2::date
        ORDER BY activity_id DESC
        LIMIT $3`,
      [userId, date, limit]
    );

    return res.json({
      items: rows.map(r => ({
        activityId: r.activity_id,
        activityType: r.activity_type, // Title Case in DB
        points: Number(r.points || 0),
        dateLogged: r.date_logged,
      })),
    });
  } catch (err) {
    console.error('GET /activity/recent error', err);
    return res.status(500).json({ error: 'Failed to fetch recent activity.' });
  }
});

/**
 * GET /activity/rules
 * Returns active rules in display order for the UI.
 */
router.get('/rules', auth, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT activity_type, points_per_unit, sort_order
       FROM activity_point_rules
      WHERE is_active = TRUE
      ORDER BY sort_order, activity_type`,
  );
  res.json({ items: rows });
});

/**
 * GET /activity/weights  (back-compat)
 * Returns a { camelCaseKey: points_per_unit } map derived from DB rules,
 * so existing UI that expects /weights continues to work.
 */
router.get('/weights', auth, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT activity_type, points_per_unit
       FROM activity_point_rules
      WHERE is_active = TRUE
      ORDER BY sort_order, activity_type`,
  );
  const map = {};
  for (const r of rows) {
    map[toCamelCase(r.activity_type)] = Number(r.points_per_unit);
  }
  res.json(map);
});

module.exports = router;
