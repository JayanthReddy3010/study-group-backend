const express = require("express");
const multer = require("multer");
const path = require("path");

const pool = require("./db");

const router = express.Router();

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() + path.extname(file.originalname)
    );
  },

});

const upload = multer({ storage });

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {

    try {

      const { title, uploaded_by, group_id } =
        req.body;

      const file_url = req.file.filename;

      const newNote = await pool.query(
        `INSERT INTO notes
        (title, file_url, uploaded_by, group_id)

        VALUES ($1,$2,$3,$4)

        RETURNING *`,
        [
          title,
          file_url,
          uploaded_by,
          group_id,
        ]
      );

      res.json(newNote.rows[0]);

    } catch (err) {
      console.log(err.message);
    }
  }
);

router.get("/:groupId", async (req, res) => {

  try {

    const notes = await pool.query(
      "SELECT * FROM notes WHERE group_id = $1",
      [req.params.groupId]
    );

    res.json(notes.rows);

  } catch (err) {
    console.log(err.message);
  }
});

module.exports = router;