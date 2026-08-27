const announcementService = require("../services/announcement.service");
const { successResponse } = require("../utils/apiResponse");

exports.createAnnouncement = async (req, res, next) => {
  try {
    const announcement = await announcementService.createAnnouncement(req.user.id, req.user.role, req.body);
    return successResponse(res, { announcement }, "Announcement created successfully.", 201);
  } catch (err) { next(err); }
};

exports.getAdminMentorAnnouncements = async (req, res, next) => {
  try {
    const announcements = await announcementService.getAdminMentorAnnouncements(req.user, req.query);
    return successResponse(res, { announcements }, "Announcements loaded successfully.", 200);
  } catch (err) { next(err); }
};

exports.getUserFeed = async (req, res, next) => {
  try {
    const announcements = await announcementService.getUserAnnouncements(req.user.id, req.user.role);
    return successResponse(res, { announcements }, "Feed loaded successfully.", 200);
  } catch (err) { next(err); }
};

// No req.user here — this route sits above the protect middleware, so
// unauthenticated visitors can hit it. Reuses the existing "public" branch
// already inside getUserAnnouncements (targetAudience: "public",
// status: "published"), just called with no userId/role.
exports.getPublicAnnouncements = async (req, res, next) => {
  try {
    const announcements = await announcementService.getUserAnnouncements(null, "public");
    return successResponse(res, { announcements }, "Public announcements loaded successfully.", 200);
  } catch (err) { next(err); }
};

exports.updateAnnouncement = async (req, res, next) => {
  try {
    const updated = await announcementService.updateAnnouncement(req.params.id, req.user.id, req.user.role, req.body);
    return successResponse(res, { announcement: updated }, "Announcement updated successfully.", 200);
  } catch (err) { next(err); }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const result = await announcementService.deleteAnnouncement(req.params.id, req.user.id, req.user.role);
    return successResponse(res, result, result.message, 200);
  } catch (err) { next(err); }
};