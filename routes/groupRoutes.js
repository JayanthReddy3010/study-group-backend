const express = require("express");
const pool = require("../config/db");
const router = express.Router();

router.post("/create", async (req, res) => {

  try {

    const {
      group_name,
      subject,
      description,
      max_members,
      study_mode,
      created_by
    } = req.body;

    const newGroup = await pool.query(
      `INSERT INTO groups
      (group_name, subject, description,
       max_members, study_mode, created_by)

      VALUES ($1,$2,$3,$4,$5,$6)

      RETURNING *`,
      [
        group_name,
        subject,
        description,
        max_members,
        study_mode,
        created_by
      ]
    );

    // AUTO JOIN CREATOR

    await pool.query(
      `INSERT INTO group_members
      (group_id, student_id)

      VALUES ($1,$2)`,
      [
        newGroup.rows[0].id,
        created_by
      ]
    );

    res.json(newGroup.rows[0]);

  } catch (err) {
    console.log(err.message);
  }
});

router.get("/all", async (req, res) => {

  try {

    const groups = await pool.query(

      `SELECT
        g.*,

        COUNT(gm.student_id)::int
        AS member_count

       FROM groups g

       LEFT JOIN group_members gm
       ON g.id = gm.group_id

       GROUP BY g.id

       ORDER BY g.id DESC`
    );

    res.json(groups.rows);

  } catch (err) {

    console.log(err.message);
  }
});

router.post("/join", async (req, res) => {

  try {

    const { group_id, student_id } = req.body;

    // CHECK EXISTING MEMBER

    const existing = await pool.query(
      `SELECT * FROM group_members
       WHERE group_id = $1
       AND student_id = $2`,
      [group_id, student_id]
    );

    if (existing.rows.length > 0) {

      return res.json(
        "Already Joined"
      );
    }

    // GET GROUP DETAILS

    const groupResult = await pool.query(
      `SELECT * FROM groups
       WHERE id = $1`,
      [group_id]
    );

    const group = groupResult.rows[0];

    // COUNT CURRENT MEMBERS

    const membersCount = await pool.query(
      `SELECT COUNT(*) FROM group_members
       WHERE group_id = $1`,
      [group_id]
    );

    const totalMembers = parseInt(
      membersCount.rows[0].count
    );

    // CHECK LIMIT

    if (
      totalMembers >= group.max_members
    ) {

      return res.status(400).json(
        "Group is Full"
      );
    }

    // ADD MEMBER

    await pool.query(
      `INSERT INTO group_members
      (group_id, student_id)

      VALUES ($1,$2)`,
      [group_id, student_id]
    );

    res.json(
      "Joined Successfully"
    );

  } catch (err) {

    console.log(err.message);
  }
});
router.get("/my/:studentId", async (req, res) => {

  try {

    const studentId = req.params.studentId;

    const result = await pool.query(
      `
      SELECT groups.*
      FROM groups

      JOIN group_members
      ON groups.id = group_members.group_id

      WHERE group_members.student_id = $1
      `,
      [studentId]
    );

    res.json(result.rows);

  } catch (err) {

    console.log(err.message);

    res.status(500).json({
      error: err.message
    });
  }
});
router.get("/members/:groupId", async (req, res) => {

  try {

    const members = await pool.query(
      `SELECT s.id,
              s.fullname,
              s.department,
              s.skills

       FROM students s

       JOIN group_members gm
       ON s.id = gm.student_id

       WHERE gm.group_id = $1`,
      [req.params.groupId]
    );

    res.json(members.rows);

  } catch (err) {
    console.log(err.message);
  }
});
router.delete(
  "/:groupId/:studentId",

  async (req, res) => {

    try {

      const {
        groupId,
        studentId
      } = req.params;

      const group = await pool.query(
        `SELECT * FROM groups
         WHERE id = $1`,
        [groupId]
      );

      if (
        group.rows[0].created_by != studentId
      ) {
        return res.status(403).json(
          "Only creator can delete group"
        );
      }

      await pool.query(
        `DELETE FROM groups
         WHERE id = $1`,
        [groupId]
      );

      res.json("Group Deleted");

    } catch (err) {
      console.log(err.message);
    }
  }
);
router.get("/recommend/:studentId", async (req, res) => {

  try {

    const { studentId } = req.params;

    const studentResult = await pool.query(
      "SELECT * FROM students WHERE id = $1",
      [studentId]
    );

    const student = studentResult.rows[0];

    const groupsResult = await pool.query(
      "SELECT * FROM groups"
    );

    const recommendedGroups = groupsResult.rows.map(
      (group) => {

        let score = 0;

        const studentStrong =
          student.strong_subjects?.toLowerCase() || "";

        const studentWeak =
          student.weak_subjects?.toLowerCase() || "";

        const studentSkills =
          student.skills?.toLowerCase() || "";

        const studentMode =
          student.preferred_mode?.toLowerCase() || "";

        const groupSubject =
          group.subject?.toLowerCase() || "";

        const groupDescription =
          group.description?.toLowerCase() || "";

        const groupMode =
          group.study_mode?.toLowerCase() || "";

        // SUBJECT MATCH

        if (
          groupSubject.includes(studentStrong)
        ) {
          score += 40;
        }

        // WEAK SUBJECT SUPPORT

        if (
          groupDescription.includes(studentWeak)
        ) {
          score += 20;
        }

        // SKILL MATCH

        if (
          groupDescription.includes(studentSkills)
        ) {
          score += 10;
        }

        // STUDY MODE MATCH

        if (
          groupMode.includes(studentMode)
        ) {
          score += 15;
        }

        // PARTIAL SUBJECT MATCH

        if (
          studentStrong.includes(groupSubject)
        ) {
          score += 25;
        }

        return {
          ...group,
          compatibilityScore: score,
        };
      }
    );

    // SORT BY SCORE

    recommendedGroups.sort(
      (a, b) =>
        b.compatibilityScore -
        a.compatibilityScore
    );

    // REMOVE LOW MATCHES

    const filteredGroups =
      recommendedGroups.filter(
        (group) =>
          group.compatibilityScore > 0
      );

    res.json(filteredGroups);

  } catch (err) {
    console.log(err.message);
  }
});
router.get("/stats/:studentId", async (req, res) => {

  try {

    const studentId = req.params.studentId;

    // TOTAL USERS

    const users = await pool.query(
      "SELECT COUNT(*) FROM students"
    );

    // TOTAL GROUPS

    const groups = await pool.query(
      "SELECT COUNT(*) FROM groups"
    );

    // TOTAL NOTES

    const notes = await pool.query(
      "SELECT COUNT(*) FROM notes"
    );

    // MY GROUPS

    const myGroups = await pool.query(
      `
      SELECT COUNT(*)
      FROM group_members
      WHERE student_id = $1
      `,
      [studentId]
    );

    res.json({

      totalUsers:
        users.rows[0].count,

      totalGroups:
        groups.rows[0].count,

      totalNotes:
        notes.rows[0].count,

      myGroups:
        myGroups.rows[0].count
    });

  } catch (err) {

    console.log(err.message);

    res.status(500).json({
      error: err.message
    });
  }
});
router.post("/task/create", async (req, res) => {

  try {

    const {
      group_id,
      task_title
    } = req.body;

    const task = await pool.query(
      `
      INSERT INTO progress_tasks
      (group_id, task_title)

      VALUES ($1,$2)

      RETURNING *
      `,
      [group_id, task_title]
    );

    res.json(task.rows[0]);

  } catch (err) {

    console.log(err.message);
  }
});
router.get("/tasks/:groupId", async (req, res) => {

  try {

    const tasks = await pool.query(
      `
      SELECT *
      FROM progress_tasks

      WHERE group_id = $1

      ORDER BY id DESC
      `,
      [req.params.groupId]
    );

    res.json(tasks.rows);

  } catch (err) {

    console.log(err.message);
  }
});
router.put("/task/:taskId", async (req, res) => {

  try {

    await pool.query(
      `
      UPDATE progress_tasks

      SET completed = NOT completed

      WHERE id = $1
      `,
      [req.params.taskId]
    );

    res.json("Task Updated");

  } catch (err) {

    console.log(err.message);
  }
});
router.get("/progress/:groupId", async (req, res) => {

  try {

    const totalTasks = await pool.query(
      `
      SELECT COUNT(*)
      FROM progress_tasks

      WHERE group_id = $1
      `,
      [req.params.groupId]
    );

    const completedTasks = await pool.query(
      `
      SELECT COUNT(*)
      FROM progress_tasks

      WHERE group_id = $1
      AND completed = true
      `,
      [req.params.groupId]
    );

    const total =
      parseInt(totalTasks.rows[0].count);

    const completed =
      parseInt(completedTasks.rows[0].count);

    let percentage = 0;

    if (total > 0) {

      percentage =
        Math.round(
          (completed / total) * 100
        );
    }

    res.json({

      total,
      completed,
      percentage
    });

  } catch (err) {

    console.log(err.message);
  }
});
router.get("/dashboard/:studentId", async (req, res) => {

  try {

    const { studentId } = req.params;

    // TOTAL USERS

    const users = await pool.query(
      "SELECT COUNT(*) FROM students"
    );

    // TOTAL GROUPS

    const groups = await pool.query(
      "SELECT COUNT(*) FROM groups"
    );

    // MY GROUPS

    const myGroups = await pool.query(
      `SELECT COUNT(*) FROM group_members
       WHERE student_id = $1`,
      [studentId]
    );

    // TOTAL NOTES

    const notes = await pool.query(
      "SELECT COUNT(*) FROM notes"
    );

    // USER PROGRESS

    const progress = await pool.query(
      `SELECT AVG(progress_percent)
       FROM progress
       WHERE student_id = $1`,
      [studentId]
    );

    // UPCOMING SCHEDULES

    const schedules = await pool.query(
      `SELECT s.*, g.group_name
       FROM schedules s

       JOIN groups g
       ON s.group_id = g.id

       JOIN group_members gm
       ON gm.group_id = g.id

       WHERE gm.student_id = $1

       ORDER BY s.session_date ASC`,
      [studentId]
    );

    res.json({

      totalUsers:
        parseInt(users.rows[0].count),

      totalGroups:
        parseInt(groups.rows[0].count),

      totalNotes:
        parseInt(notes.rows[0].count),

      myGroups:
        parseInt(myGroups.rows[0].count),

      progress:
        Math.floor(
          progress.rows[0].avg || 0
        ),

      schedules:
        schedules.rows
    });

  } catch (err) {

    console.log(err.message);
  }
});
router.get("/home-stats", async (req, res) => {

  try {

    // TOTAL USERS

    const users = await pool.query(
      "SELECT COUNT(*) FROM students"
    );

    // TOTAL GROUPS

    const groups = await pool.query(
      "SELECT COUNT(*) FROM groups"
    );

    // TOTAL NOTES

    const notes = await pool.query(
      "SELECT COUNT(*) FROM notes"
    );

    res.json({

      totalUsers:
        parseInt(users.rows[0].count),

      totalGroups:
        parseInt(groups.rows[0].count),

      totalNotes:
        parseInt(notes.rows[0].count)

    });

  } catch (err) {

    console.log(err.message);
  }
});
// CREATE SCHEDULE

router.post("/schedule/create", async (req, res) => {

  try {

    const {
      group_id,
      title,
      session_date,
      session_time
    } = req.body;

    const newSchedule = await pool.query(
      `
      INSERT INTO schedules
      (group_id, title, session_date, session_time)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        group_id,
        title,
        session_date,
        session_time
      ]
    );

    res.json(newSchedule.rows[0]);

  } catch (err) {

    console.log(err);
    res.status(500).json("Server Error");
  }
});


// GET GROUP SCHEDULES

router.get("/schedules/:groupId", async (req, res) => {

  try {

    const schedules = await pool.query(
      `
      SELECT *
      FROM schedules
      WHERE group_id = $1
      ORDER BY session_date ASC
      `,
      [req.params.groupId]
    );

    res.json(schedules.rows);

  } catch (err) {

    console.log(err);
    res.status(500).json("Server Error");
  }
});
module.exports = router;