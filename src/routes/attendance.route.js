const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendance.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect);

router.get("/my-attendance", authorize("student"), attendanceController.getStudentAttendanceStats);
router.get("/", authorize("admin", "mentor"), attendanceController.getAttendanceByRole);
router.post("/bulk", authorize("admin", "mentor"), attendanceController.markBulkAttendance);
router.patch("/:attendanceId", authorize("admin", "mentor"), attendanceController.updateAttendance);

module.exports = router;