const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const errorHandler = require("./middleware/errorHandler.middleware");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Must be last — catches errors passed via next(error) from every controller
app.use(errorHandler);

module.exports = app;
