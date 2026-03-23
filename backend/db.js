const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     Number(process.env.DB_PORT || 5432),

  ssl: { rejectUnauthorized: false },
  family: 4,

  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
