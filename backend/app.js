// backend/app.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const pool = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Route modules (all export a Router)
const authRoutes = require('./routes/auth');
const superAdminRoutes = require('./routes/superAdmin');
const adminRoutes = require('./routes/admin/admin');
const userRoutes = require('./routes/user/users');

// Health check
app.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json(result.rows);
  } catch (error) {
    res.status(500).send('Database error');
  }
});

// Routes
app.use('/auth', authRoutes); // /auth/check-email, /auth/signup, /auth/login, /auth/forgot, /auth/reset
app.use('/superadmin', superAdminRoutes);
app.use('/admin', adminRoutes); // /admin/requests, /admin/requests/approve, /admin/courses
app.use('/users', userRoutes);

// 404
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

module.exports = app;
