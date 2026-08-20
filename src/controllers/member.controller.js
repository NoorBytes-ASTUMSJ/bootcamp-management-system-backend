const memberService = require("../services/membership.service");
const { successResponse } = require("../utils/apiResponse");


        // 1. ADMIN CONTROLLERS
 
//  POST /api/members/approve/:userId
// Approve an applicant user and turn them into an official member (Admin)

exports.approveMember = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    const result = await memberService.approveMember(userId, adminId, req.body);
    return successResponse(res, result, "User approved and member record created successfully.", 201);
  } catch (error) {
    next(error);
  }
};
 // GET /api/members/students
// Admin Page 1: Get all students with optional filters (batch, gender)
exports.getAllStudentsForAdmin = async (req, res, next) => {
  try {
    const students = await memberService.getAllStudentsForAdmin(req.query);
    return successResponse(res, { students }, "Students retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

 // GET /api/members/staff
 //Admin Page 2: Get all staff (mentors and admins) with optional filters (role, batch, gender)

exports.getStaffForAdmin = async (req, res, next) => {
  try {
    const staff = await memberService.getStaffForAdmin(req.query);
    return successResponse(res, { staff }, "Staff members retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};
 //PATCH /api/members/:memberId
 // Update member details like batch, mentor, or status (Admin CRUD)
exports.updateMember = async (req, res, next) => {
  try {
    const member = await memberService.updateMember(req.params.memberId, req.body);
    return successResponse(res, { member }, "Member details updated successfully.", 200);
  } catch (error) {
    next(error);
  }
};

//  DELETE /api/members/:memberId
// Delete member profile and revert user role back to applicant (Admin CRUD)

exports.deleteMember = async (req, res, next) => {
  try {
    const result = await memberService.deleteMember(req.params.memberId);
    return successResponse(res, result, result.message, 200);
  } catch (error) {
    next(error);
  }
};
      // 2. MENTOR CONTROLLERS

//  GET /api/members/mentor/my-batch
// View members in the mentor's assigned batch (filter: "all" | "my_students")

exports.getMembersForMentor = async (req, res, next) => {
  try {
    const mentorUserId = req.user.id;
    const members = await memberService.getMembersForMentor(mentorUserId, req.query);
    return successResponse(res, { members }, "Batch members retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

//GET /api/members/mentor/student/:studentUserId
//  View detailed profile of a student assigned to this mentor
 
exports.getStudentDetailForMentor = async (req, res, next) => {
  try {
    const mentorUserId = req.user.id;
    const { studentUserId } = req.params;
    const studentDetail = await memberService.getStudentDetailForMentor(studentUserId, mentorUserId);
    return successResponse(res, { student: studentDetail }, "Student detail retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};
 
//3. STUDENT CONTROLLERS

//GET /api/members/student/my-batch
// View overview of members in the student's batch

exports.getMembersForStudent = async (req, res, next) => {
  try {
    const studentUserId = req.user.id;
    const members = await memberService.getMembersForStudent(studentUserId);
    return successResponse(res, { members }, "Batch members overview retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};