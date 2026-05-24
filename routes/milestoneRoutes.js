const express = require("express");

const pool = require("../config/db");

const router = express.Router();

router.post("/create", async (req, res) => {

  try {

    const { group_id, title } = req.body;

    const newMilestone = await pool.query(
      `INSERT INTO milestones
      (group_id, title)

      VALUES ($1,$2)

      RETURNING *`,
      [group_id, title]
    );

    res.json(newMilestone.rows[0]);

  } catch (err) {
    console.log(err.message);
  }
});

router.get("/:groupId", async (req, res) => {

  try {

    const milestones = await pool.query(
      `SELECT * FROM milestones
       WHERE group_id = $1
       ORDER BY id DESC`,
      [req.params.groupId]
    );

    res.json(milestones.rows);

  } catch (err) {
    console.log(err.message);
  }
});

router.put("/complete/:id", async (req, res) => {

  try {

    await pool.query(
      `UPDATE milestones
       SET status = 'Completed'
       WHERE id = $1`,
      [req.params.id]
    );

    res.json("Milestone Completed");

  } catch (err) {
    console.log(err.message);
  }
});

module.exports = router;