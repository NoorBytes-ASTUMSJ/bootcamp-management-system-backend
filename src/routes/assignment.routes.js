const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignment.controller");
const { protect, authorize } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");

router.use(protect);

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

router.post(
  "/",
  authorize("admin", "mentor"),
  upload.single("file"),
  assignmentController.createAssignment,
);

router.patch(
  "/:id",
  authorize("admin", "mentor"),
  upload.single("file"),
  assignmentController.updateAssignment,
);

router.delete(
  "/:id",
  authorize("admin", "mentor"),
  assignmentController.deleteAssignment,
);

module.exports = router;
