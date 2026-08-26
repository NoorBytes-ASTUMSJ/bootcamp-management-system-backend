const memberService = require("../services/membership.service");
const { successResponse } = require("../utils/apiResponse");

// 1. ADMIN CONTROLLERS

// POST /api/members/approve/:userId
// Approve an applicant user and turn them into an official member (Admin)
exports.approveMember = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    const result = await memberService.approveMember(userId, adminId, req.body);
    return successResponse(
      res,
      result,
      "User approved and member record created successfully.",
      201,
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/members/students
exports.getAllStudentsForAdmin = async (req, res, next) => {
  try {
    const students = await memberService.getAllStudentsForAdmin(req.query);
    return successResponse(
      res,
      { students },
      "Students retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/members/staff
exports.getStaffForAdmin = async (req, res, next) => {
  try {
    const staff = await memberService.getStaffForAdmin(req.query);
    return successResponse(
      res,
      { staff },
      "Staff members retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

// PATCH /api/members/:memberId
exports.updateMember = async (req, res, next) => {
  try {
    const member = await memberService.updateMember(
      req.params.memberId,
      req.body,
    );
    return successResponse(
      res,
      { member },
      "Member details updated successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

// DELETE /api/members/:memberId
exports.deleteMember = async (req, res, next) => {
  try {
    const result = await memberService.deleteMember(req.params.memberId);
    return successResponse(res, result, result.message, 200);
  } catch (error) {
    next(error);
  }
};

// 2. MENTOR CONTROLLERS
exports.getMembersForMentor = async (req, res, next) => {
  try {
    const mentorUserId = req.user.id;
    const members = await memberService.getMembersForMentor(
      mentorUserId,
      req.query,
    );
    return successResponse(
      res,
      { members },
      "Batch members retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

exports.getStudentDetailForMentor = async (req, res, next) => {
  try {
    const mentorUserId = req.user.id;
    const { studentUserId } = req.params;

    // Pass mentorUserId first, then studentUserId
    const studentDetail = await memberService.getStudentDetailForMentor(
      mentorUserId,
      studentUserId,
    );

    return successResponse(
      res,
      { student: studentDetail },
      "Student detail retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};
// 3. STUDENT CONTROLLERS
exports.getMembersForStudent = async (req, res, next) => {
  try {
    const studentUserId = req.user.id;
    const members = await memberService.getMembersForStudent(studentUserId);
    return successResponse(
      res,
      { members },
      "Batch members overview retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};
