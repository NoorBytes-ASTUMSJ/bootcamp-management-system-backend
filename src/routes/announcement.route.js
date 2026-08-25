const express = require("express");
const router = express.Router();
const controller = require("../controllers/announcement.controller");
const { protect, authorize } = require("../middlewares/auth.middleware");

// Public, unauthenticated route — must stay ABOVE router.use(protect)
router.get("/public", controller.getPublicAnnouncements);

router.use(protect);

router.get("/feed", controller.getUserFeed);
router.get("/dashboard", authorize("admin", "mentor"), controller.getAdminMentorAnnouncements);

// ADD THIS: Handles GET /api/announcements
router.get("/", authorize("admin", "mentor"), controller.getAdminMentorAnnouncements);

router.post("/", authorize("admin", "mentor"), controller.createAnnouncement);
router.patch("/:id", authorize("admin", "mentor"), controller.updateAnnouncement);
router.delete("/:id", authorize("admin", "mentor"), controller.deleteAnnouncement);

module.exports = router;