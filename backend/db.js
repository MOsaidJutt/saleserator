const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     Number(process.env.DB_PORT || 5432),

  // Prevent idle connection timeouts from crashing the server
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 2000,
  keepAlive: true,
  max: 10, // max pool size
});

// Log pool errors instead of crashing
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;