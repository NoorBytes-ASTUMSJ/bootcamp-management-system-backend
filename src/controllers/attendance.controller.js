const attendanceService = require("../services/attendance.service");
const { successResponse } = require("../utils/apiResponse");

// POST /api/attendance/bulk — Bulk save or update attendance for a session
exports.markBulkAttendance = async (req, res, next) => {
  try {
    const recordedBy = req.user.id;
    const payload = {
      ...req.body,
      recordedBy,
    };

    const result = await attendanceService.markBulkAttendance(payload);

    return successResponse(
      res,
      result,
      "Attendance records saved successfully.",
      200
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance — Retrieve attendance scoped by user role (Admin or Mentor)
exports.getAttendanceByRole = async (req, res, next) => {
  try {
    const user = req.user;
    const filters = req.query;

    const attendance = await attendanceService.getAttendanceByRole(user, filters);

    return successResponse(
      res,
      { attendance },
      "Attendance records retrieved successfully.",
      200
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/my-attendance — Retrieve attendance stats & logs for logged-in student
exports.getStudentAttendanceStats = async (req, res, next) => {
  try {
    const studentUserId = req.user.id;
    const data = await attendanceService.getStudentAttendanceStats(studentUserId);

    return successResponse(
      res,
      { attendanceData: data },
      "Student attendance statistics loaded.",
      200
    );
  } catch (error) {
    next(error);
  }
};

// PATCH /api/attendance/:attendanceId — Update single attendance record
exports.updateAttendance = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;
    const updated = await attendanceService.updateAttendance(attendanceId, req.body);

    return successResponse(
      res,
      { attendance: updated },
      "Attendance record updated successfully.",
      200
    );
  } catch (error) {
    next(error);
  }
};