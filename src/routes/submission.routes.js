const express = require("express");
const router = express.Router();
const submissionController = require("../controllers/submission.controller");
const { protect, authorize } = require("../middlewares/auth.middleware");

router.use(protect);

router.patch(
  "/:id/submit",
  authorize("student"),
  submissionController.submitWork,
);

router.patch("/:id/grade", authorize("mentor"), submissionController.gradeWork);

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

module.exports = router;
