const express = require("express");

const pool = require("../config/db");

const router = express.Router();


// GET ALL SCHEDULES OF USER

router.get("/:studentId", async (req, res) => {

  try {

    const schedules = await pool.query(
      `SELECT *
       FROM schedules
       WHERE student_id = $1
       ORDER BY session_date ASC`,
      [req.params.studentId]
    );

    res.json(schedules.rows);

  } catch (err) {

    console.log(err.message);
  }
});


// CREATE NEW SCHEDULE

router.post("/create", async (req, res) => {

  try {

    const {
      student_id,
      title,
      session_date
    } = req.body;

    await pool.query(
      `INSERT INTO schedules
      (student_id, title, session_date)

      VALUES ($1,$2,$3)`,
      [
        student_id,
        title,
        session_date
      ]
    );

    res.json("Schedule Added");

  } catch (err) {

    console.log(err.message);
  }
});

module.exports = router;