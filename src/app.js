const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const batchRoutes = require("./routes/batch.route");
const userRoutes = require("./routes/user.routes");
const memberRoutes = require("./routes/member.routes");
const attendanceRoutes = require("./routes/attendance.route");

const announcementRoutes = require("./routes/announcement.route")
const errorHandler = require("./middlewares/errorHandler.middleware");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));

app.use(express.json());

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/announcements", announcementRoutes);

app.use(errorHandler);

module.exports = app;
