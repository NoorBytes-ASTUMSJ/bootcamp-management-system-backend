const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const batchRoutes = require("./routes/batch.route");
const userRoutes = require("./routes/user.routes");
const memberRoutes = require("./routes/member.routes");
const attendanceRoutes = require("./routes/attendance.route");
const submissionRoutes = require("./routes/submission.routes");
const assignmentRoutes = require("./routes/assignment.routes");

const progressRoutes = require("./routes/progress.route");
const announcementRoutes = require("./routes/announcement.route")
const dashboardRoutes = require("./routes/dashboard.routes");
const errorHandler = require("./middlewares/errorHandler.middleware");

const app = express();

// 1. Configure CORS options
const allowedOrigins = [
  "https://bootcamp-management-system-frontend.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., Postman, cron-jobs) or matching allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

// 2. Health check endpoints (for automated pingers and service monitoring)
app.get("/", (req, res) => {
  res
    .status(200)
    .json({ status: "success", message: "Server is running smoothly!" });
});

app.get("/api", (req, res) => {
  res.status(200).json({ status: "success", message: "API is live!" });
});

// 3. API Routes
app.use("/api/auth", authRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/dashboard", dashboardRoutes);

// 4. Global Error Handling Middleware
app.use(errorHandler);

module.exports = app;
