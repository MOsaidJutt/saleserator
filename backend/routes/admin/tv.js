const express = require("express");
const pool = require("../../db");
const { auth, requireRole } = require("../../middleware/auth");
const { generateTvToken, hashToken } = require("../../utils/tvToken");

const router = express.Router();

/**
 * POST /admin/tv/token
 * Generates a TV Mode URL scoped to the admin's company.
 * company_id is stored with the token so the TV screen only
 * shows that company's leaderboard without needing a user JWT.
 */
router.post("/tv/token", auth, requireRole("admin"), async (req, res) => {
  const rawToken = generateTvToken();
  const tokenHash = hashToken(rawToken);
  const company_id = req.user.company_id;

  await pool.query(
    `INSERT INTO tv_tokens (token_hash, company_id) VALUES ($1, $2)`,
    [tokenHash, company_id]
  );

  const FRONTEND_ORIGIN =
    process.env.FRONTEND_ORIGIN || "http://localhost:3000";

  const tvUrl = `${FRONTEND_ORIGIN}/tv?token=${encodeURIComponent(rawToken)}`;

  res.json({ tv_url: tvUrl });
});

module.exports = router;