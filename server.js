const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const pool = require("./db");
const multer = require("multer");
const path = require("path");

const app = express();
const isProduction = process.env.NODE_ENV === "production";
/* =========================
   MIDDLEWARE (IMPORTANT FIX)
========================= */
app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://study-group-frontend-3tvwhkvct-gjayanthreddy69-2878s-projects.vercel.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  })
);
app.options("*", cors());
/* =========================
   ROUTES
========================= */
const studentRoutes = require("./routes/studentRoutes");
const groupRoutes = require("./routes/groupRoutes");

app.use("/api/students", studentRoutes);
app.use("/api/groups", groupRoutes);

app.use("/uploads", express.static("uploads"));

/* =========================
   MULTER
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* =========================
   HTTP SERVER
========================= */
const server = http.createServer(app);

/* =========================
   SOCKET.IO
========================= */
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://study-group-frontend-snowy.vercel.app/"
    ],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User Connected");

  socket.on("join_room", (room) => socket.join(room));

  socket.on("send_message", (data) => {
    io.to(data.room).emit("receive_message", data);
  });

  socket.on("group_joined", (data) => {
    io.emit("new_join_notification", data);
  });

  socket.on("session_reminder", (data) => {
    io.to(data.room).emit("receive_session_reminder", data);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected");
  });
});

/* =========================
   SCHEDULE ROUTES
========================= */
app.get("/api/schedules/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;

    const result = await pool.query(
      "SELECT * FROM schedules WHERE group_id=$1 ORDER BY session_date ASC",
      [groupId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.post("/api/schedules/create", async (req, res) => {
  try {
    const { group_id, title, session_date, session_time } = req.body;

    const result = await pool.query(
      `INSERT INTO schedules (group_id,title,session_date,session_time)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [group_id, title, session_date, session_time]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.delete("/api/schedules/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM schedules WHERE id=$1", [id]);

    res.json("Deleted");
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   MILESTONES
========================= */
app.get("/api/milestones/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;

    const result = await pool.query(
      "SELECT * FROM milestones WHERE group_id=$1 ORDER BY id ASC",
      [groupId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json("Server Error");
  }
});

app.post("/api/milestones/create", async (req, res) => {
  try {
    const { group_id, title } = req.body;

    const result = await pool.query(
      `INSERT INTO milestones (group_id,title)
       VALUES ($1,$2) RETURNING *`,
      [group_id, title]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json("Server Error");
  }
});

app.put("/api/milestones/complete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE milestones SET status='Completed' WHERE id=$1 RETURNING *`,
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json("Server Error");
  }
});

/* =========================
   NOTES
========================= */
app.get("/api/notes/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;

    const result = await pool.query(
      "SELECT * FROM notes WHERE group_id=$1 ORDER BY id DESC",
      [groupId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

app.post("/api/notes/upload", upload.single("file"), async (req, res) => {
  try {
    const { title, uploaded_by, group_id } = req.body;
    const file_url = req.file.filename;

    const result = await pool.query(
      `INSERT INTO notes (title,file_url,uploaded_by,group_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, file_url, uploaded_by, group_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   START SERVER (ONLY ONCE)
========================= */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server Running on", PORT);
});