const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {

    console.log("LOGIN BODY:", req.body);

    const email = req.body.email?.trim();
    const password = req.body.password?.trim();

    if (!email || !password) {
      return res.status(400).json("Email and password required");
    }

    const result = await pool.query(
      "SELECT * FROM students WHERE LOWER(email)=LOWER($1)",
      [email]
    );

    console.log("DB RESULT:", result.rows);

    if (result.rows.length === 0) {
      return res.status(401).json("Invalid Email");
    }

    const student = result.rows[0];

    // SUPPORT OLD NON-HASHED PASSWORDS + NEW HASHED PASSWORDS
    let isMatch = false;

    if (student.password.startsWith("$2b$")) {

      isMatch = await bcrypt.compare(
        password,
        student.password
      );

    } else {

      isMatch = password === student.password;

      // AUTO HASH OLD PASSWORD
      if (isMatch) {

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
          "UPDATE students SET password=$1 WHERE id=$2",
          [hashedPassword, student.id]
        );

        student.password = hashedPassword;
      }
    }

    if (!isMatch) {
      return res.status(401).json("Wrong Password");
    }

    res.json({
      student,
      token: "dummy-token"
    });

  } catch (err) {

    console.log(err.message);

    res.status(500).json("Server Error");
  }
});

/* =========================
   REGISTER
========================= */
router.post("/register", async (req, res) => {
  try {

    console.log("REGISTER BODY:", req.body);

    const {
      fullname,
      email,
      password,
      college,
      department,
      semester,
      strong_subjects,
      weak_subjects,
      skills,
      study_mode,
      availability
    } = req.body;

    if (!fullname || !email || !password) {
      return res.status(400).json("Missing required fields");
    }

    const existingUser = await pool.query(
      "SELECT * FROM students WHERE LOWER(email)=LOWER($1)",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json("User already exists");
    }

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO students
      (
        fullname,
        email,
        password,
        college,
        department,
        semester,
        strong_subjects,
        weak_subjects,
        skills,
        study_mode,
        availability
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
        fullname,
        email,
        hashedPassword,
        college || "",
        department || "",
        semester || "",
        strong_subjects || "",
        weak_subjects || "",
        skills || "",
        study_mode || "",
        availability || ""
      ]
    );

    res.json({
      token: "dummy-token",
      student: result.rows[0]
    });

  } catch (err) {

    console.log(err.message);

    res.status(500).json("Server Error");
  }
});

/* =========================
   PROFILE
========================= */
router.get("/profile/:id", async (req, res) => {
  try {

    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM students WHERE id=$1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json("User not found");
    }

    res.json(result.rows[0]);

  } catch (err) {

    console.log(err.message);

    res.status(500).json("Server Error");
  }
});

/* =========================
   UPDATE PROFILE
========================= */
router.put("/update/:id", async (req, res) => {
  try {

    const { id } = req.params;

    const {
      fullname,
      email,
      department,
      skills,
      strong_subjects,
      weak_subjects,
      preferred_mode
    } = req.body;

    const result = await pool.query(
      `
      UPDATE students
      SET
      fullname=$1,
      email=$2,
      department=$3,
      skills=$4,
      strong_subjects=$5,
      weak_subjects=$6,
      preferred_mode=$7
      WHERE id=$8
      RETURNING *
      `,
      [
        fullname || "",
        email || "",
        department || "",
        skills || "",
        strong_subjects || "",
        weak_subjects || "",
        preferred_mode || "",
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json("Student not found");
    }

    res.json(result.rows[0]);

  } catch (err) {

    console.log(err.message);

    res.status(500).json("Server Error");
  }
});

/* =========================
   DELETE ACCOUNT
========================= */
router.post("/delete/:id", async (req, res) => {
  try {

    const { id } = req.params;
    const { password } = req.body;

    const result = await pool.query(
      "SELECT * FROM students WHERE id=$1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json("Student not found");
    }

    const student = result.rows[0];

    let isMatch = false;

    // HASHED PASSWORD
    if (student.password.startsWith("$2b$")) {

      isMatch = await bcrypt.compare(
        password,
        student.password
      );

    } else {

      // OLD NORMAL PASSWORD
      isMatch = password === student.password;
    }

    if (!isMatch) {
      return res.status(400).json("Wrong password");
    }

    await pool.query(
      "DELETE FROM students WHERE id=$1",
      [id]
    );

    res.json("Account deleted successfully");

  } catch (err) {

    console.log(err.message);

    res.status(500).json("Server Error");
  }
});

module.exports = router;