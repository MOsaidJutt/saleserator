const express = require('express');
const pool = require('../db');
const { tvAuth } = require('../middleware/tvAuth.js');
const { addClient } = require("../utils/tvEvents.js");

const router = express.Router();

function utcDateStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// SSE stream
router.get("/events", tvAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  if (typeof res.flushHeaders === "function") res.flushHeaders();

  res.write(`event: hello\ndata: {"ok":true}\n\n`);

  addClient(res);
});

/**
 * GET /tv/leaderboard?period=daily|weekly|monthly|all&refresh=0
 * Uses mk_period_key + reads from leaderboards snapshot table.
 */
router.get("/leaderboard", tvAuth, async (req, res) => {
  try {
    const period = (req.query.period || "daily").toLowerCase();
    const refresh = String(req.query.refresh || "0") === "1";

    // ✅ Use same date logic as your activity logger
    const asOfDate = utcDateStr();

    // 1) Compute correct period key for the same date basis
    const { rows: keyRows } = await pool.query(
      `SELECT mk_period_key($1::text, $2::date) AS key;`,
      [period, asOfDate]
    );

    const periodKey = keyRows?.[0]?.key;
    if (!periodKey) return res.status(400).json({ error: "invalid_period" });

    // 2) Optional refresh (for live feel)
    if (refresh) {
      await pool.query(`SELECT refresh_leaderboard($1::text, $2::date)`, [
        period,
        asOfDate,
      ]);
    }

    // 3) Fetch top 10
    const { rows } = await pool.query(
      `
      SELECT lb.user_id,
             lb.total_points AS total_points,
             lb.rank,
             u.name
        FROM leaderboards lb
        LEFT JOIN users u ON u.user_id = lb.user_id
       WHERE lb.period = $1
       ORDER BY lb.rank ASC, lb.user_id ASC
       LIMIT 10
      `,
      [periodKey]
    );

    res.json({
      period,
      key: periodKey,
      asOf: new Date().toISOString(),
      results: rows,
    });
  } catch (err) {
    console.error("GET /tv/leaderboard failed", err);
    res.status(500).json({ error: "tv_leaderboard_failed" });
  }
});


module.exports = router;
