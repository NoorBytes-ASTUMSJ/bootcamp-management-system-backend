const express = require("express");
const router = express.Router();
const controller = require("../controllers/announcement.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect);

router.get("/feed", controller.getUserFeed);
router.get("/dashboard", authorize("admin", "mentor"), controller.getAdminMentorAnnouncements);
router.post("/", authorize("admin", "mentor"), controller.createAnnouncement);
router.patch("/:id", authorize("admin", "mentor"), controller.updateAnnouncement);
router.delete("/:id", authorize("admin", "mentor"), controller.deleteAnnouncement);

module.exports = router;