const express = require('express');
const pool = require('../db');
const router = express.Router();

/**
 * GET /api/users/company/:company_id
 * List all users that belong to a company
 */
router.get('/company/:company_id', async (req, res) => {
  const { company_id } = req.params;
  try {
    // Simple validation
    if (!company_id || isNaN(company_id)) {
      return res.status(400).json({ error: 'Invalid company_id' });
    }

    const query = `
      SELECT user_id, email, role, company_id, created_at
      FROM users
      WHERE company_id = $1
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query, [company_id]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No users found for this company.' });
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users by company:', error);
    res.status(500).json({ error: 'Database error while fetching users.' });
  }
});

/**
 * POST /api/users
 * Create a new user (admin adds user manually)
 */
router.post('/', async (req, res) => {
  const {
    company_id,
    email,
    role = 'sales_rep',
    password_hash = null,
  } = req.body;

  try {
    // Validate required fields
    if (!email || !company_id) {
      return res
        .status(400)
        .json({ error: 'company_id and email are required.' });
    }

    // Check if user already exists
    const exists = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email],
    );
    if (exists.rowCount > 0) {
      return res
        .status(409)
        .json({ error: 'User with this email already exists.' });
    }

    // Insert new user
    const insertQuery = `
      INSERT INTO users (company_id, email, role, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING user_id, email, role, company_id, created_at;
    `;
    const result = await pool.query(insertQuery, [
      company_id,
      email,
      role,
      password_hash,
    ]);

    res.status(201).json({
      message: 'User created successfully.',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Database error while creating user.' });
  }
});

/**
 * GET /api/users
 * Optional: List all users (admin view)
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT user_id, email, role, company_id, created_at
      FROM users
      ORDER BY created_at DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ error: 'Database error while fetching all users.' });
  }
});

/**
 * DELETE /api/users/:user_id
 * Remove a user (admin only)
 */
router.delete('/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING *;',
      [user_id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      message: 'User deleted successfully.',
      deleted: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Database error while deleting user.' });
  }
});

module.exports = router;
