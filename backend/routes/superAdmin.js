// /backend/routes/superAdmin.js

const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const router = express.Router();

// ============================================================
// SUPER ADMIN AUTH
// Verifies the secret password from .env before allowing access
// Add SUPER_ADMIN_PASSWORD=yourpassword to your .env file
// ============================================================
function requireSuperAdmin(req, res, next) {
  const { secret } = req.headers;
  if (!secret || secret !== process.env.SUPER_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ============================================================
// VERIFY SECRET — frontend calls this on login
// ============================================================
router.post("/auth", (req, res) => {
  const { secret } = req.body;
  if (!secret || secret !== process.env.SUPER_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }
  res.json({ ok: true });
});

// ============================================================
// SLUG HELPER
// ============================================================
function generateSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

/* ======================================================
   CREATE COMPANY
====================================================== */
router.post("/create-company", requireSuperAdmin, async (req, res) => {
  const { name, logo_url, tagline } = req.body;

  try {
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Company name is required" });
    }

    const slug = generateSlug(name);

    const slugExists = await pool.query(
      "SELECT 1 FROM companies WHERE slug = $1",
      [slug]
    );

    if (slugExists.rowCount > 0) {
      return res.status(409).json({
        error: `A company with a similar name already exists (slug conflict: "${slug}"). Please use a more distinct name.`,
      });
    }

    const newCompany = await pool.query(
      `INSERT INTO companies (name, slug, logo_url, tagline)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), slug, logo_url || null, tagline || null]
    );

    const newCompanyId = newCompany.rows[0].company_id;

    await pool.query('SELECT seed_company_defaults($1)', [newCompanyId]);

    res.status(201).json({
      message: `Company "${name}" created successfully`,
      company: newCompany.rows[0],
    });
  } catch (err) {
    console.error("Error creating company:", err);
    res.status(500).json({ error: "Error creating company" });
  }
});

/* ======================================================
   CREATE ADMIN
====================================================== */
router.post("/create-admin", requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, company_id } = req.body;

    if (!name || !email || !password || !company_id) {
      return res.status(400).json({
        error: "name, email, password, and company_id are all required",
      });
    }

    const company = await pool.query(
      "SELECT company_id FROM companies WHERE company_id = $1",
      [company_id]
    );

    if (company.rowCount === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const existing = await pool.query(
      "SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const admin = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, company_id)
       VALUES ($1, $2, $3, 'admin', $4)
       RETURNING user_id, name, email, role, company_id, created_at`,
      [name.trim(), email.trim(), password_hash, company_id]
    );

    res.status(201).json({
      message: "Admin created successfully",
      admin: admin.rows[0],
    });
  } catch (err) {
    console.error("Error creating admin:", err);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

/* ======================================================
   GET ALL COMPANIES
====================================================== */
router.get("/companies", requireSuperAdmin, async (req, res) => {
  try {
    const companies = await pool.query(
      "SELECT * FROM companies ORDER BY company_id ASC"
    );
    res.json(companies.rows);
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ error: "Error fetching companies" });
  }
});

/* ======================================================
   GET SINGLE COMPANY BY SLUG
====================================================== */
router.get("/companies/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      "SELECT * FROM companies WHERE slug = $1",
      [slug]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching company:", err);
    res.status(500).json({ error: "Failed to fetch company" });
  }
});

/* ======================================================
   GET ALL ADMINS
====================================================== */
router.get("/admins", requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.name AS admin_name,
        u.email,
        u.company_id,
        COALESCE(c.name, 'No Company') AS company_name,
        c.slug AS company_slug
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.company_id
      WHERE u.role = 'admin'
      ORDER BY u.user_id ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching admins:", err);
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

module.exports = router;