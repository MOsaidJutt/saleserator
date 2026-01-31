const express = require('express');
const router = express.Router();
const pool = require('../../db'); // Ensure you have a db connection pool
const { auth, requireRole } = require('../../middleware/auth'); // Authentication and Authorization middleware

// Get Pending Course Requests
router.get('/requests', auth, requireRole('admin'), async (req, res) => {
  // TODO: scope by company_id later
  const { rows } = await pool.query(
    `SELECT cr.id, u.name AS user_name, c.title AS course_title, cr.status
     FROM course_requests cr
     JOIN users u ON u.user_id = cr.user_id
     JOIN courses c ON c.id = cr.course_id
     WHERE cr.status = 'pending'
     ORDER BY cr.requested_at ASC`,
  );
  res.json(rows);
});

// Approve a Request
router.post(
  '/requests/approve',
  auth,
  requireRole('admin'),
  async (req, res) => {
    const { request_id } = req.body || {};
    if (!request_id)
      return res.status(400).json({ message: 'request_id required' });

    const { rows } = await pool.query(
      'SELECT user_id, course_id FROM course_requests WHERE id=$1 AND status=$2',
      [request_id, 'pending'],
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
  },
);
// Disapprove a Request
router.post(
  '/requests/disapprove',
  auth,
  requireRole('admin'),
  async (req, res) => {
    const { request_id } = req.body || {};
    if (!request_id)
      return res.status(400).json({ message: 'request_id required' });

    try {
      const { rows } = await pool.query(
        'SELECT user_id, course_id FROM course_requests WHERE id=$1 AND status=$2',
        [request_id, 'pending'],
      );

      if (!rows.length)
        return res
          .status(400)
          .json({ message: 'Request not found or already processed' });

      await pool.query('UPDATE course_requests SET status=$1 WHERE id=$2', [
        'disapproved',
        request_id,
      ]);

      res.json({ ok: true });
    } catch (error) {
      console.error('Error disapproving request:', error);
      res.status(500).json({ message: 'Failed to disapprove request' });
    }
  },
);

module.exports = router;