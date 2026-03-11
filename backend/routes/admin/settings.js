// routes/admin/settings.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { auth, requireRole } = require('../../middleware/auth');

// ─────────────────────────────────────────────────────────────
// ACTIVITY POINT RULES
// ─────────────────────────────────────────────────────────────

/**
 * GET /admin/settings/activity-rules
 * Returns all activity point rules for the admin's company
 */
router.get('/settings/activity-rules', async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT activity_type, points_per_unit, is_active, sort_order
         FROM activity_point_rules
        WHERE company_id = $1
        ORDER BY sort_order, activity_type`,
      [company_id]
    );

    res.json({ items: rows });
  } catch (err) {
    console.error('GET /admin/settings/activity-rules error:', err);
    res.status(500).json({ error: 'Failed to fetch activity rules' });
  }
});

/**
 * PUT /admin/settings/activity-rules
 * Update points_per_unit for a specific activity type
 * Body: { activity_type, points_per_unit }
 */
router.put('/settings/activity-rules', async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { activity_type, points_per_unit } = req.body;

    if (!activity_type || points_per_unit == null) {
      return res.status(400).json({ error: 'activity_type and points_per_unit are required' });
    }

    if (!Number.isFinite(Number(points_per_unit)) || Number(points_per_unit) < 0) {
      return res.status(400).json({ error: 'points_per_unit must be a positive number' });
    }

    const { rowCount } = await pool.query(
      `UPDATE activity_point_rules
          SET points_per_unit = $1, updated_at = NOW()
        WHERE activity_type = $2
          AND company_id = $3`,
      [Number(points_per_unit), activity_type, company_id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Activity rule not found for your company' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /admin/settings/activity-rules error:', err);
    res.status(500).json({ error: 'Failed to update activity rule' });
  }
});

// ─────────────────────────────────────────────────────────────
// RANK RULES
// ─────────────────────────────────────────────────────────────

/**
 * GET /admin/settings/rank-rules
 * Returns all rank rules for the admin's company
 */
router.get('/settings/rank-rules', async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT rank_id, name, min_sp, badge_color, sort_order
         FROM rank_rules
        WHERE company_id = $1
        ORDER BY sort_order`,
      [company_id]
    );

    res.json({ items: rows });
  } catch (err) {
    console.error('GET /admin/settings/rank-rules error:', err);
    res.status(500).json({ error: 'Failed to fetch rank rules' });
  }
});

/**
 * PUT /admin/settings/rank-rules/:rank_id
 * Update a specific rank threshold
 * Body: { name, min_sp, badge_color }
 */
router.put('/settings/rank-rules/:rank_id', async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { rank_id } = req.params;
    const { name, min_sp, badge_color } = req.body;

    if (!name || min_sp == null) {
      return res.status(400).json({ error: 'name and min_sp are required' });
    }

    if (!Number.isFinite(Number(min_sp)) || Number(min_sp) < 0) {
      return res.status(400).json({ error: 'min_sp must be a positive number' });
    }

    const { rowCount } = await pool.query(
      `UPDATE rank_rules
          SET name = $1, min_sp = $2, badge_color = $3
        WHERE rank_id = $4
          AND company_id = $5`,
      [name.trim(), Number(min_sp), badge_color || 'gray', rank_id, company_id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Rank rule not found for your company' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /admin/settings/rank-rules error:', err);
    res.status(500).json({ error: 'Failed to update rank rule' });
  }
});

module.exports = router;