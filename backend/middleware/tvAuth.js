const pool = require("../db.js");
const { hashToken } = require("../utils/tvToken.js");

async function tvAuth(req, res, next) {
  const token =
    req.query.token ||
    req.headers["x-tv-token"];

  if (!token) {
    return res.status(401).json({ error: "TV token required" });
  }

  const tokenHash = hashToken(token);

  const { rows } = await pool.query(
    `SELECT id, company_id
       FROM tv_tokens
      WHERE token_hash = $1
        AND revoked = FALSE
        AND (expires_at IS NULL OR expires_at > NOW())`,
    [tokenHash]
  );

  if (!rows.length) {
    return res.status(401).json({ error: "Invalid or revoked TV token" });
  }

  // Attach company_id so TV routes can scope their queries
  req.tv = {
    scope: "tv",
    company_id: rows[0].company_id,
  };

  next();
}

module.exports = { tvAuth };