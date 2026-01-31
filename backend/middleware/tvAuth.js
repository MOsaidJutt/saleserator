import pool from "../db.js";
import { hashToken } from "../utils/tvToken.js";

export async function tvAuth(req, res, next) {
  const token =
    req.query.token ||
    req.headers["x-tv-token"];

  if (!token) {
    return res.status(401).json({ error: "TV token required" });
  }

  const tokenHash = hashToken(token);

  const { rows } = await pool.query(
    `
    SELECT id
    FROM tv_tokens
    WHERE token_hash = $1
      AND revoked = FALSE
      AND (expires_at IS NULL OR expires_at > NOW())
    `,
    [tokenHash]
  );

  if (!rows.length) {
    return res.status(401).json({ error: "Invalid or revoked TV token" });
  }

  // Future-proof hook
  req.tv = {
    scope: "tv"
    // later: company_id
  };

  next();
}
