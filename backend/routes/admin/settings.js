// routes/admin/settings.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');

// ─────────────────────────────────────────────────────────────
// ACTIVITY POINT RULES
// ─────────────────────────────────────────────────────────────

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

router.put('/settings/activity-rules', async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { activity_type, points_per_unit } = req.body;

    if (!activity_type || points_per_unit == null)
      return res.status(400).json({ error: 'activity_type and points_per_unit are required' });

    if (!Number.isFinite(Number(points_per_unit)) || Number(points_per_unit) < 0)
      return res.status(400).json({ error: 'points_per_unit must be a positive number' });

    const { rowCount } = await pool.query(
      `UPDATE activity_point_rules
          SET points_per_unit = $1, updated_at = NOW()
        WHERE activity_type = $2 AND company_id = $3`,
      [Number(points_per_unit), activity_type, company_id]
    );

    if (rowCount === 0)
      return res.status(404).json({ error: 'Activity rule not found for your company' });

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /admin/settings/activity-rules error:', err);
    res.status(500).json({ error: 'Failed to update activity rule' });
  }
});

// ─────────────────────────────────────────────────────────────
// RANK RULES
// ─────────────────────────────────────────────────────────────

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

router.put('/settings/rank-rules/:rank_id', async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { rank_id } = req.params;
    const { name, min_sp, badge_color } = req.body;

    if (!name || min_sp == null)
      return res.status(400).json({ error: 'name and min_sp are required' });

    if (!Number.isFinite(Number(min_sp)) || Number(min_sp) < 0)
      return res.status(400).json({ error: 'min_sp must be a positive number' });

    const { rowCount } = await pool.query(
      `UPDATE rank_rules
          SET name = $1, min_sp = $2, badge_color = $3
        WHERE rank_id = $4 AND company_id = $5`,
      [name.trim(), Number(min_sp), badge_color || 'gray', rank_id, company_id]
    );

    if (rowCount === 0)
      return res.status(404).json({ error: 'Rank rule not found for your company' });

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /admin/settings/rank-rules error:', err);
    res.status(500).json({ error: 'Failed to update rank rule' });
  }
});

// ─────────────────────────────────────────────────────────────
// BRAND SETTINGS
// GET  /admin/settings/brand  — returns name, logo_url, theme for this company
// PUT  /admin/settings/brand  — updates name, logo_url, theme
// ─────────────────────────────────────────────────────────────

router.get('/settings/brand', async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { rows } = await pool.query(
      `SELECT name, logo_url, theme FROM companies WHERE company_id = $1`,
      [company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Company not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /admin/settings/brand error:', err);
    res.status(500).json({ error: 'Failed to fetch brand settings' });
  }
});

router.put('/settings/brand', async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { name, logo_url, theme } = req.body;

    // Only update fields that are actually provided
    const updates = [];
    const vals = [];
    let i = 1;

    if (name && name.trim()) { updates.push(`name = $${i++}`);     vals.push(name.trim()); }
    if (logo_url !== undefined) { updates.push(`logo_url = $${i++}`); vals.push(logo_url || null); }
    if (theme)   { updates.push(`theme = $${i++}`);    vals.push(JSON.stringify(theme)); }

    if (updates.length === 0)
      return res.status(400).json({ error: 'Nothing to update' });

    vals.push(company_id);
    await pool.query(
      `UPDATE companies SET ${updates.join(', ')} WHERE company_id = $${i}`,
      vals
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /admin/settings/brand error:', err);
    res.status(500).json({ error: 'Failed to update brand settings' });
  }
});

module.exports = router;