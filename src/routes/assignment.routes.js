const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignment.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

// Require authentication for all assignment routes
router.use(protect);

// Role-specific assignment queries
router.get(
  "/admin",
  authorize("admin"),
  assignmentController.getAdminAssignments,
);

router.get(
  "/mentor",
  authorize("mentor"),
  assignmentController.getMentorAssignments,
);

router.get(
  "/student",
  authorize("student"),
  assignmentController.getStudentAssignments,
);

// Create assignment (Admins & Mentors)
router.post(
  "/",
  authorize("admin", "mentor"),
  assignmentController.createAssignment,
);

// Single assignment management
router.get("/:assignmentId", assignmentController.getAssignmentById);

router.patch(
  "/:assignmentId",
  authorize("admin", "mentor"),
  assignmentController.updateAssignment,
);

router.delete(
  "/:assignmentId",
  authorize("admin", "mentor"),
  assignmentController.deleteAssignment,
);

module.exports = router;
