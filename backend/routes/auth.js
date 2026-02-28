// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const { validate, loginSchema } = require('../utils/validators');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const TOKEN_EXP = '7d';

// Helper to issue JWT + normalized payload
const issue = (user) => {
  const payload = {
    id: user.user_id,
    email: user.email,
    role: user.role,
    company_id: user.company_id ?? null,
    name: user.name ?? null,
    company_slug: user.company_slug ?? null,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXP });

  return { token, user: payload };
};

router.post('/check-email', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    const { rows } = await pool.query(
      'SELECT 1 FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1',
      [email]
    );

    return res.json({ exists: rows.length > 0 });
  } catch (err) {
    next(err);
  }
});

// /signup is disabled for V1 — invite-only architecture.
// Users are created by admins via POST /admin/users/invite
router.post('/signup', (_req, res) => {
  return res.status(403).json({
    message: 'Open registration is disabled. Please contact your administrator.',
  });
});

router.post(
  '/login',
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const { rows } = await pool.query(
        `SELECT u.user_id, u.email, u.role, u.company_id, u.name, u.password_hash,
                c.slug AS company_slug
         FROM users u
         LEFT JOIN companies c ON u.company_id = c.company_id
         WHERE LOWER(TRIM(u.email)) = LOWER(TRIM($1))`,
        [email]
      );

      if (!rows.length) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const user = rows[0];

      const ok = await bcrypt.compare(password, user.password_hash || '');

      if (!ok) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      return res.json(issue(user));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;