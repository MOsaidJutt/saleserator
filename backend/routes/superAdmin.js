// /backend/routes/superadmin.js

const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const router = express.Router();

/* ======================================================
   CREATE COMPANY
====================================================== */
router.post("/create-company", async (req, res) => {
  const { name, logo_url, tagline } = req.body;

  try {
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Company name is required" });
    }

    const newCompany = await pool.query(
      "INSERT INTO companies (name, logo_url, tagline) VALUES ($1, $2, $3) RETURNING *",
      [name, logo_url || null, tagline || null]
    );

    res.status(201).json({
      message: `Company ${name} created successfully`,
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
router.post("/create-admin", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Missing required fields" });

    // Check if email already exists
    const existing = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0)
      return res.status(400).json({ error: "Admin with this email already exists" });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Insert admin into users table
    const admin = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING *",
      [name, email, hashed]
    );

    res.json({
      message: "Admin created successfully",
      admin: admin.rows[0],
    });
  } catch (err) {
    console.error("Error creating admin:", err);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

/* ======================================================
   GET ADMIN BY EMAIL (for assignment)
====================================================== */
router.get("/admins/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const admin = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND role = 'admin'",
      [email]
    );

    if (admin.rows.length === 0)
      return res.status(404).json({ error: "Admin not found" });

    res.json(admin.rows[0]);
  } catch (err) {
    console.error("Error fetching admin:", err);
    res.status(500).json({ error: "Failed to fetch admin" });
  }
});

/* ======================================================
   ASSIGN ADMIN TO COMPANY
====================================================== */
router.post("/assign-admin-to-company", async (req, res) => {
  const { adminId, companyId } = req.body;
  try {
    const updated = await pool.query(
      "UPDATE users SET company_id = $1 WHERE user_id = $2 RETURNING *",
      [companyId, adminId]
    );

    if (updated.rows.length === 0)
      return res.status(404).json({ error: "Admin not found" });

    res.json({
      message: "Admin assigned successfully",
      admin: updated.rows[0],
    });
  } catch (err) {
    console.error("Error assigning admin:", err);
    res.status(500).json({ error: "Error assigning admin to company" });
  }
});

/* ======================================================
   GET ALL COMPANIES
====================================================== */
router.get("/companies", async (req, res) => {
  try {
    const companies = await pool.query("SELECT * FROM companies ORDER BY company_id ASC");
    res.json(companies.rows);
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ error: "Error fetching companies" });
  }
});

/* ======================================================
   GET ALL ADMINS WITH THEIR COMPANY NAMES
====================================================== */
router.get("/admins", async (req, res) => {
  try {
    const query = `
      SELECT users.user_id, users.name AS admin_name, users.email,
             COALESCE(companies.name, 'No Company') AS company_name,
             users.company_id
      FROM users
      LEFT JOIN companies ON users.company_id = companies.company_id
      WHERE users.role = 'admin'
      ORDER BY users.user_id ASC
    `;
    
    const admins = await pool.query(query);

    res.json(admins.rows);
  } catch (err) {
    console.error("Error fetching admins:", err);
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

module.exports = router;