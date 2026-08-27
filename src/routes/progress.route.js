const express = require("express");
const router = express.Router();
const progressController = require("../controllers/progress.controller");
const { protect, authorize } = require("../middlewares/auth.middleware");

router.use(protect);

router.get("/my-progress", authorize("student"), progressController.getStudentDashboard);
router.patch("/:progressId/status", authorize("student"), progressController.updateStudentStatus);
router.get("/dashboard", authorize("admin", "mentor"), progressController.getProgressDashboard);
router.get("/student-details/:memberId", authorize("admin", "mentor"), progressController.getStudentDrawerDetails);
router.post("/", authorize("admin", "mentor"), progressController.createProgressItem);

router.get("/all", authorize("admin", "mentor"), progressController.getAllProgressItems);

router.patch(
  "/:progressId",
  authorize("admin", "mentor"),
  progressController.updateProgressItem
);

router.delete(
  "/:progressId", 
  authorize("admin", "mentor"), 
  progressController.deleteProgressItem
);

module.exports = router;