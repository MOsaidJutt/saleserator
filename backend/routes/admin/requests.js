const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { auth, requireRole } = require('../../middleware/auth');

// Get Pending Course Requests (company scoped)
router.get('/requests', auth, requireRole('admin'), async (req, res) => {
  const company_id = req.user.company_id;

  const { rows } = await pool.query(
    `SELECT cr.id, u.name AS user_name, c.title AS course_title, cr.status
       FROM course_requests cr
       JOIN users u ON u.user_id = cr.user_id
       JOIN courses c ON c.id = cr.course_id
      WHERE cr.status = 'pending'
        AND c.company_id = $1
      ORDER BY cr.requested_at ASC`,
    [company_id],
  );
  res.json(rows);
});

// Approve a Request (company scoped)
router.post('/requests/approve', auth, requireRole('admin'), async (req, res) => {
  const { request_id } = req.body || {};
  const company_id = req.user.company_id;

  if (!request_id)
    return res.status(400).json({ message: 'request_id required' });

  const { rows } = await pool.query(
    `SELECT cr.user_id, cr.course_id
       FROM course_requests cr
       JOIN courses c ON c.id = cr.course_id
      WHERE cr.id = $1
        AND cr.status = 'pending'
        AND c.company_id = $2`,
    [request_id, company_id],
  );

  if (!rows.length)
    return res.status(400).json({ message: 'Request not found' });

  const { user_id, course_id } = rows[0];

  await pool.query('UPDATE course_requests SET status=$1 WHERE id=$2', [
    'approved',
    request_id,
  ]);
  await pool.query(
    'INSERT INTO user_courses (user_id, course_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [user_id, course_id, 'enrolled'],
  );

  res.json({ ok: true });
});

// Disapprove a Request (company scoped)
router.post('/requests/disapprove', auth, requireRole('admin'), async (req, res) => {
  const { request_id } = req.body || {};
  const company_id = req.user.company_id;

  if (!request_id)
    return res.status(400).json({ message: 'request_id required' });

  try {
    const { rows } = await pool.query(
      `SELECT cr.user_id, cr.course_id
         FROM course_requests cr
         JOIN courses c ON c.id = cr.course_id
        WHERE cr.id = $1
          AND cr.status = 'pending'
          AND c.company_id = $2`,
      [request_id, company_id],
    );

    if (!rows.length)
      return res.status(400).json({ message: 'Request not found or already processed' });

    await pool.query('UPDATE course_requests SET status=$1 WHERE id=$2', [
      'disapproved',
      request_id,
    ]);

    res.json({ ok: true });
  } catch (error) {
    console.error('Error disapproving request:', error);
    res.status(500).json({ message: 'Failed to disapprove request' });
  }
});

module.exports = router;