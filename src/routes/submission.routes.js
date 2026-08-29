const express = require("express");
const router = express.Router();
const submissionController = require("../controllers/submission.controller");
const { protect, authorize } = require("../middlewares/auth.middleware");

router.use(protect);

// --- 1. PLACE STATIC/NAMED ROUTES FIRST ---
router.get(
  "/my-batch-grades",
  authorize("student"),
  submissionController.getBatchGradeStats,
);

router.get(
  "/me",
  authorize("student"),
  submissionController.getStudentSubmissions,
);

router.get(
  "/mentor",
  authorize("mentor"),
  submissionController.getMentorSubmissions,
);

router.get(
  "/admin",
  authorize("admin"),
  submissionController.getAdminSubmissions,
);

router.get(
  "/assignment/:assignmentId",
  authorize("admin", "mentor"),
  submissionController.getAssignmentSubmissions,
);

// --- 2. PLACE DYNAMIC /:id ROUTES LAST ---
router.patch(
  "/:id/submit",
  authorize("student"),
  submissionController.submitWork,
);

router.patch("/:id/grade", authorize("mentor"), submissionController.gradeWork);

module.exports = router;