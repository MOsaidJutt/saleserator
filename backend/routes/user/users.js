// backend/routes/user/users.js
const express = require('express');
const router = express.Router();

const courseRoutes = require('./courses');     // -> routes defined like router.get('/my', ...)
const dashboardRoutes = require('./dashboard'); // -> routes defined like router.get('/dashboard', ...)
const leaderboardRoutes = require('./leaderboard');
const activityRoutes = require('./activity')
const kpiRoutes = require('./kpi')
const rankRoutes = require('./userRank');

// mount courses under /users/courses/*
router.use('/', dashboardRoutes);
router.use('/courses', courseRoutes);
router.use ('/leaderboard', leaderboardRoutes);
router.use('/activity', activityRoutes);
router.use('/kpi', kpiRoutes);
router.use('/rank', rankRoutes);

module.exports = router;
