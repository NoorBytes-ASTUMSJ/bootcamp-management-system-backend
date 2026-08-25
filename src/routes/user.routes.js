const express = require("express");

const router = express.Router();

const userController = require("../controllers/user.controller");
const { protect, authorize } = require("../middlewares/auth.middleware");

router.use(protect);

router.get("/me", userController.getOwnProfile);
router.patch("/me", userController.updateProfile);
router.patch("/me/password", userController.changePassword);

router.get("/", authorize("admin"), userController.getAllUsers);
router.get("/:userId", authorize("admin"), userController.getUserById);
router.patch("/:userId", authorize("admin"), userController.updateUser);
router.delete("/:userId", authorize("admin"), userController.deleteUser);

module.exports = router;