// backend/app.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const pool = require('./db');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS restriction
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tv-token']
};

app.use(cors(corsOptions));

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

app.use(limiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' }
});

app.use('/auth', authLimiter);

app.use(express.json());

const authRoutes = require('./routes/auth');
const superAdminRoutes = require('./routes/superAdmin');
const adminRoutes = require('./routes/admin/admin');
const userRoutes = require('./routes/user/users');
const tvRoutes = require('./routes/tv');

// Health Check
app.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json(result.rows);
  } catch (error) {
    next(error); // send to global error handler
  }
});

app.use('/auth', authRoutes);
app.use('/superadmin', superAdminRoutes);
app.use('/admin', adminRoutes);
app.use('/users', userRoutes);
app.use('/tv', tvRoutes);

// Global error handler (must be before 404)
app.use(errorHandler);

// 404 handler (must be last)
app.use((req, res) =>
  res.status(404).json({ message: 'Not found' })
);

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () =>
  console.log(`Server running on ${PORT}`)
);

module.exports = app;