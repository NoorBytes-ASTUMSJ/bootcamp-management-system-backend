const submissionService = require("../services/submission.service");
const Member = require("../models/Member.model");
const { successResponse } = require("../utils/apiResponse");

exports.submitWork = async (req, res, next) => {
  try {
    // Safely get the Member ID using the logged-in User ID
    const student = await Member.findOne({ user: req.user.id });
    if (!student) throw new Error("Student record not found.");

    const submission = await submissionService.submitAssignment(
      req.params.id,
      student._id,
      req.body,
    );

    return successResponse(
      res,
      { submission },
      "Assignment submitted successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.gradeWork = async (req, res, next) => {
  try {
    const mentorUserId = req.user.id;
    const submission = await submissionService.gradeSubmission(
      req.params.id,
      mentorUserId,
      req.body,
    );

    return successResponse(
      res,
      { submission },
      "Submission graded successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.getAdminSubmissions = async (req, res, next) => {
  try {
    const data = await submissionService.getAdminSubmissions(req.query);
    return successResponse(
      res,
      data,
      "Submissions retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.getMentorSubmissions = async (req, res, next) => {
  try {
    const mentorUserId = req.user.id;
    const submissions =
      await submissionService.getMentorSubmissions(mentorUserId);
    return successResponse(
      res,
      { submissions },
      "Mentor submissions retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentSubmissions = async (req, res, next) => {
  try {
    const submissions = await submissionService.getSubmissionsByAssignment(
      req.params.assignmentId,
    );
    return successResponse(
      res,
      { submissions },
      "Assignment submissions retrieved.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.getStudentSubmissions = async (req, res, next) => {
  try {
    // Pass the standard User ID to the service
    const userId = req.user.id;
    const submissions = await submissionService.getStudentSubmissions(userId);

    return successResponse(
      res,
      { submissions },
      "Student submissions retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};
exports.getBatchGradeStats = async (req, res, next) => {
  try {
    const { id: userId, role } = req.user;
    const { batchId } = req.query;

    const data = await submissionService.getBatchGradeStats({
      userId,
      role,
      batchId,
    });

    return successResponse(
      res,
      { grades: data },
      "Batch grade statistics loaded.",
      200,
    );
  } catch (error) {
    next(error);
  }
};