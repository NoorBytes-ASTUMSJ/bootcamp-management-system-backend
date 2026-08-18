const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect);

// --- SELF PROFILE ROUTES ---
router.get("/me", userController.getOwnProfile);
router.patch("/me", userController.updateProfile);
router.patch("/me/password", userController.changePassword);

// --- ADMIN MANAGEMENT ROUTES ---
router.get("/", authorize("admin"), userController.getAllUsers);
router.get("/:userId", authorize("admin"), userController.getUserById);
router.delete("/:userId", authorize("admin"), userController.deleteUser);

module.exports = router;