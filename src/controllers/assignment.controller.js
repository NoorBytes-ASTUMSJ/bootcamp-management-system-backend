const assignmentService = require("../services/assignment.service");
const { successResponse } = require("../utils/apiResponse");

exports.createAssignment = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.fileUrl = req.file.path;
      data.fileName = req.file.originalname;
      data.fileType = req.file.mimetype;
    }

    const assignment = await assignmentService.createAssignment(
      req.user.id,
      req.user.role,
      data,
    );

    return successResponse(
      res,
      { assignment },
      "Assignment created successfully.",
      201,
    );
  } catch (error) {
    next(error);
  }
};

exports.getAdminAssignments = async (req, res, next) => {
  try {
    const assignments = await assignmentService.getAdminAssignments(req.query);
    return successResponse(
      res,
      { assignments },
      "Admin assignments retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.getMentorAssignments = async (req, res, next) => {
  try {
    const mentorUserId = req.user.id;
    const assignments =
      await assignmentService.getMentorAssignments(mentorUserId);
    return successResponse(
      res,
      { assignments },
      "Mentor assignments retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.getStudentAssignments = async (req, res, next) => {
  try {
    const studentUserId = req.user.id;
    const assignments =
      await assignmentService.getStudentAssignments(studentUserId);
    return successResponse(
      res,
      { assignments },
      "Student assignments retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentById = async (req, res, next) => {
  try {
    const assignment = await assignmentService.getAssignmentById(req.params.id);
    return successResponse(
      res,
      { assignment },
      "Assignment retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.updateAssignment = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.fileUrl = req.file.path;
      data.fileName = req.file.originalname;
      data.fileType = req.file.mimetype;
    }

    const assignment = await assignmentService.updateAssignment(
      req.params.id,
      req.user.id,
      req.user.role,
      data,
    );

    return successResponse(
      res,
      { assignment },
      "Assignment updated successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.deleteAssignment = async (req, res, next) => {
  try {
    await assignmentService.deleteAssignment(
      req.params.id,
      req.user.id,
      req.user.role,
    );
    return successResponse(res, null, "Assignment deleted successfully.", 200);
  } catch (error) {
    next(error);
  }
};
