const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const { protect } = require("../middlewares/auth.middleware");

// Protect all dashboard routes so req.user is available
router.use(protect);

// GET /api/v1/dashboard/overview
router.get("/overview", dashboardController.getDashboardOverview);

module.exports = router;