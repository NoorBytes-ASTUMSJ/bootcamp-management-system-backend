const assignmentService = require("../services/assignment.service");
const { successResponse } = require("../utils/apiResponse");

// POST /api/assignments — Create assignment (Admin or Mentor)
exports.createAssignment = async (req, res, next) => {
  try {
    const creatorId = req.user.id;
    const creatorRole = req.user.role;

    const assignment = await assignmentService.createAssignment(
      creatorId,
      creatorRole,
      req.body
    );

    return successResponse(
      res,
      { assignment },
      "Assignment created successfully.",
      201
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/assignments/admin — Get all assignments (Admin overview)
exports.getAdminAssignments = async (req, res, next) => {
  try {
    const assignments = await assignmentService.getAdminAssignments(req.query);
    return successResponse(
      res,
      { assignments },
      "Assignments retrieved successfully.",
      200
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/assignments/mentor — Get assignments created by or relevant to logged-in mentor
exports.getMentorAssignments = async (req, res, next) => {
  try {
    const mentorUserId = req.user.id;
    const assignments = await assignmentService.getMentorAssignments(mentorUserId);
    return successResponse(
      res,
      { assignments },
      "Mentor assignments retrieved successfully.",
      200
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/assignments/student — Get assignments assigned to logged-in student
exports.getStudentAssignments = async (req, res, next) => {
  try {
    const studentUserId = req.user.id;
    const assignments = await assignmentService.getStudentAssignments(studentUserId);
    return successResponse(
      res,
      { assignments },
      "Student assignments retrieved successfully.",
      200
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/assignments/:assignmentId — Get single assignment details
exports.getAssignmentById = async (req, res, next) => {
  try {
    const assignment = await assignmentService.getAssignmentById(req.params.assignmentId);
    return successResponse(
      res,
      { assignment },
      "Assignment details retrieved successfully.",
      200
    );
  } catch (error) {
    next(error);
  }
};

// PATCH /api/assignments/:assignmentId — Update assignment
exports.updateAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const assignment = await assignmentService.updateAssignment(
      assignmentId,
      userId,
      userRole,
      req.body
    );

    return successResponse(
      res,
      { assignment },
      "Assignment updated successfully.",
      200
    );
  } catch (error) {
    next(error);
  }
};

// DELETE /api/assignments/:assignmentId — Delete assignment
exports.deleteAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const result = await assignmentService.deleteAssignment(
      assignmentId,
      userId,
      userRole
    );

    return successResponse(res, result, result.message, 200);
  } catch (error) {
    next(error);
  }
};