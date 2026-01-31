const express = require("express");
const pool = require("../../db");
const { auth, requireRole } = require("../../middleware/auth");
const { generateTvToken, hashToken } = require("../../utils/tvToken");

const router = express.Router();

/**
 * POST /admin/tv/token
 * Generates a TV Mode URL (FRONTEND URL)
 */
router.post("/tv/token", auth, requireRole("admin"), async (req, res) => {
  const rawToken = generateTvToken();
  const tokenHash = hashToken(rawToken);

  await pool.query(
    `INSERT INTO tv_tokens (token_hash) VALUES ($1)`,
    [tokenHash]
  );

  // ✅ Use env so dev/prod are correct
  const FRONTEND_ORIGIN =
    process.env.FRONTEND_ORIGIN || "http://localhost:3000";

  // ✅ IMPORTANT: match your real React route here:
  // if your TV page route is "/tv-mode", change "/tv" to "/tv-mode"
  const tvUrl = `${FRONTEND_ORIGIN}/tv?token=${encodeURIComponent(rawToken)}`;

  res.json({ tv_url: tvUrl });
});

module.exports = router;
