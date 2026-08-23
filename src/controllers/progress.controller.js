const progressService = require("../services/progress.service");
const { successResponse } = require("../utils/apiResponse");

// Release Progress Items (Admin/Mentor)
exports.createProgressItem = async (req, res, next) => {
  try {
    const items = await progressService.createProgressItem(req.user.id, req.user.role, req.body);
    return successResponse(res, { items }, "Progress item(s) released successfully.", 201);
  } catch (error) {
    next(error);
  }
};

// Update Progress Status (Student Only)
exports.updateStudentStatus = async (req, res, next) => {
  try {
    const { progressId } = req.params;
    const { status } = req.body;
    const updated = await progressService.updateStudentStatus(progressId, req.user.id, status);
    return successResponse(res, { progress: updated }, "Progress status updated.", 200);
  } catch (error) {
    next(error);
  }
};

// Get Dashboard Rows (Admin / Mentor)
exports.getProgressDashboard = async (req, res, next) => {
  try {
    const data = await progressService.getProgressDashboard(req.query);
    return successResponse(res, { students: data }, "Progress dashboard data retrieved.", 200);
  } catch (error) {
    next(error);
  }
};

// Get Single Student Drawer Details (Triggered on row click)
exports.getStudentDrawerDetails = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const data = await progressService.getStudentDrawerDetails(memberId);
    return successResponse(res, { drawerData: data }, "Student details retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

// Get Logged-in Student View
exports.getStudentDashboard = async (req, res, next) => {
  try {
    const data = await progressService.getStudentDashboard(req.user.id);
    return successResponse(res, { dashboard: data }, "Student progress dashboard loaded.", 200);
  } catch (error) {
    next(error);
  }
};