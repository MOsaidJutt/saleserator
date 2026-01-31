// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const TOKEN_EXP = '7d';

// Helper to issue JWT + normalized payload (now includes name)
const issue = (user) => {
  const payload = {
    id: user.user_id, // you use user_id in DB
    email: user.email,
    role: user.role,
    company_id: user.company_id ?? null,
    name: user.name ?? null, // 👈 include name in token payload
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXP });
  return { token, user: payload };
};

// ---------- CHECK EMAIL ----------
router.post('/check-email', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: 'Email required' });

  const { rows } = await pool.query(
    'SELECT 1 FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1',
    [email],
  );
  return res.json({ exists: rows.length > 0 });
});

// ---------- SIGNUP ----------
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email & password required' });
  }

  // block duplicates
  const exists = await pool.query(
    'SELECT 1 FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1',
    [email],
  );
  if (exists.rows.length) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const cleanName = (name || '').trim().slice(0, 120) || null;

  const insert = await pool.query(
    `INSERT INTO users (email, password_hash, role, company_id, name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id, email, role, company_id, name`,
    [email, password_hash, 'sales_rep', null, cleanName],
  );

  return res.status(201).json(issue(insert.rows[0]));
});

// ---------- LOGIN ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email & password required' });
  }

  const { rows } = await pool.query(
    `SELECT user_id, email, role, company_id, name, password_hash
       FROM users
      WHERE LOWER(email)=LOWER($1)`,
    [email],
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
});

module.exports = router;
