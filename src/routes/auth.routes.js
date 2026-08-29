const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");

// Public endpoints
router.post("/register/student", authController.registerStudent);
router.post("/register/mentor", authController.registerMentor);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPasswordWithOTP);

// Protected endpoints
router.post("/logout", protect, authController.logout);
router.get("/me", protect, authController.getMe);

module.exports = router;
