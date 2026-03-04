const express = require('express');
const pool = require('../db');
const { tvAuth } = require('../middleware/tvAuth.js');
const { addClient } = require("../utils/tvEvents");

const router = express.Router();

function utcDateStr() {
  return new Date().toISOString().slice(0, 10);
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
 * Company scoped via company_id stored in the TV token.
 */
router.get("/leaderboard", tvAuth, async (req, res) => {
  try {
    const company_id = req.tv.company_id;
    const period = (req.query.period || "daily").toLowerCase();
    const refresh = String(req.query.refresh || "0") === "1";
    const asOfDate = utcDateStr();

    // 1) Compute period key
    const { rows: keyRows } = await pool.query(
      `SELECT mk_period_key($1::text, $2::date) AS key`,
      [period, asOfDate]
    );

    const periodKey = keyRows?.[0]?.key;
    if (!periodKey) return res.status(400).json({ error: "invalid_period" });

    // 2) Optional refresh
    if (refresh) {
      await pool.query(`SELECT refresh_leaderboard($1::text, $2::date)`, [
        period,
        asOfDate,
      ]);
    }

    // 3) Fetch top 10 — company scoped with company-scoped rank
    const { rows } = await pool.query(
      `SELECT lb.user_id,
              lb.total_points,
              u.name,
              RANK() OVER (ORDER BY lb.total_points DESC) AS rank
         FROM leaderboards lb
         JOIN users u ON u.user_id = lb.user_id
        WHERE lb.period = $1
          AND u.company_id = $2
        ORDER BY lb.total_points DESC
        LIMIT 10`,
      [periodKey, company_id]
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