const express = require("express");
const router = express.Router();
const memberController = require("../controllers/member.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect);

// Admin routes
router.post("/approve/:userId", authorize("admin"), memberController.approveMember);
router.get("/students", authorize("admin"), memberController.getAllStudentsForAdmin);
router.get("/staff", authorize("admin"), memberController.getStaffForAdmin);
router.patch("/:memberId", authorize("admin"), memberController.updateMember);
router.delete("/:memberId", authorize("admin"), memberController.deleteMember);

// Mentor routes
router.get("/mentor/my-batch", authorize("mentor"), memberController.getMembersForMentor);
router.get("/mentor/student/:studentUserId", authorize("mentor"), memberController.getStudentDetailForMentor);

// Student routes
router.get("/student/my-batch", authorize("student"), memberController.getMembersForStudent);

module.exports = router;