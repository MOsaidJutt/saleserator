const express = require('express');
const router = express.Router();

const requestsRoutes = require('./requests');
const coursesRoutes = require('./courses');
const activitiesRoutes = require('./activities');
const leaderboardRoutes = require('./leaderboard');
const dashboardRoutes = require('./dashboard');
const tvRoutes = require('./tv');

router.use(dashboardRoutes);
router.use(requestsRoutes);
router.use(coursesRoutes);
router.use(activitiesRoutes);
router.use(leaderboardRoutes);
router.use(tvRoutes);


module.exports = router;
