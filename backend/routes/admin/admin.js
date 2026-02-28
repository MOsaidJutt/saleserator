const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');

const requestsRoutes = require('./requests');
const coursesRoutes = require('./courses');
const activitiesRoutes = require('./activities');
const leaderboardRoutes = require('./leaderboard');
const dashboardRoutes = require('./dashboard');
const tvRoutes = require('./tv');
const usersRoutes = require('./users');

// 🔒 All admin routes require a valid JWT with role = 'admin'
router.use(auth, requireRole('admin'));

router.use(dashboardRoutes);
router.use(requestsRoutes);
router.use(coursesRoutes);
router.use(activitiesRoutes);
router.use(leaderboardRoutes);
router.use(tvRoutes);
router.use(usersRoutes);

module.exports = router;
