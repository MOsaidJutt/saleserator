// backend/routes/admin/users.js
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../../db');
const { auth, requireRole } = require('../../middleware/auth');
const { validate, inviteUserSchema } = require('../../utils/validators');

const router = express.Router();

router.use(auth, requireRole('admin'));

/**
 * POST /admin/users/invite
 * Admin creates a new user under their company.
 * company_id is always pulled from the admin's JWT — never from request body.
 */
router.post('/users/invite', validate(inviteUserSchema), async (req, res, next) => {
  try {
    const { email, name, role = 'sales_rep', password } = req.body;
    const company_id = req.user.company_id;

    const exists = await pool.query(
      'SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) AND company_id = $2',
      [email, company_id]
    );

    if (exists.rowCount > 0) {
      return res.status(409).json({ message: 'A user with this email already exists in your company.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const cleanName = (name || '').trim().slice(0, 120) || null;

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, company_id, name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, email, role, company_id, name, created_at`,
      [email, password_hash, role, company_id, cleanName]
    );

    return res.status(201).json({
      message: 'User invited successfully.',
      user: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/users
 * List all users belonging to the admin's company.
 */
router.get('/users', async (req, res, next) => {
  try {
    const company_id = req.user.company_id;

    const result = await pool.query(
      `SELECT user_id, email, name, role, company_id, created_at
         FROM users
        WHERE company_id = $1
        ORDER BY created_at DESC`,
      [company_id]
    );

    return res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /admin/users/:user_id
 * Update a user's name or role within the admin's company.
 */
router.patch('/users/:user_id', async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { name, role } = req.body;
    const company_id = req.user.company_id;

    if (!name && !role) {
      return res.status(400).json({ message: 'Provide at least name or role to update.' });
    }

    const result = await pool.query(
      `UPDATE users
          SET name = COALESCE($1, name),
              role = COALESCE($2, role)
        WHERE user_id = $3 AND company_id = $4
        RETURNING user_id, email, name, role, company_id`,
      [name || null, role || null, user_id, company_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found in your company.' });
    }

    return res.json({
      message: 'User updated successfully.',
      user: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /admin/users/:user_id
 * Admin can only delete users within their own company.
 */
router.delete('/users/:user_id', async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const company_id = req.user.company_id;

    const result = await pool.query(
      `DELETE FROM users
        WHERE user_id = $1 AND company_id = $2
        RETURNING user_id, email, name`,
      [user_id, company_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found in your company.' });
    }

    return res.json({
      message: 'User removed successfully.',
      deleted: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;