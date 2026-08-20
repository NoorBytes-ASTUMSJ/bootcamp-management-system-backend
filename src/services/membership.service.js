const Member = require("../models/Member.model");
const User = require("../models/User.model");
const generateMemberId = require("../utils/generateMemberId");

         //1. ADMIN OPERATIONS (CRUD & APPROVALS)
//  Approve an applicant user and create a Member record (Admin)
exports.approveMember = async (applicantId, adminId, memberData) => {
  const { batchId, assignedMentorId } = memberData;

  // Enforce mandatory batch selection
  if (!batchId) {
    const error = new Error("Batch selection is required to approve a member.");
    error.statusCode = 400;
    throw error;
  }

  // Find applicant user
  const user = await User.findById(applicantId);
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  // Prevent duplicate membership
  const existingMember = await Member.findOne({ user: applicantId });
  if (existingMember) {
    const error = new Error("This user is already an active member.");
    error.statusCode = 400;
    throw error;
  }

  // Promote user role from "user" to their applied role ("student" or "mentor")
  user.role = user.applicationType;
  await user.save();

  // Auto-generate unique Member ID (e.g., MEM/0001/2026)
  const memberId = await generateMemberId();

  // Create member record matching schema definitions
  const newMember = await Member.create({
    user: user._id,
    memberId: memberId,
    approvedBy: adminId,
    batch: batchId,
    assignedMentor: assignedMentorId || null,
    status: "active",
  });

  return { user, member: newMember };
};
 // Update Member details like batch, mentor, or status (Admin CRUD)

exports.updateMember = async (memberId, updateData) => {
  const updatedMember = await Member.findByIdAndUpdate(memberId, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("user", "-password")
    .populate("batch", "name")
    .populate("assignedMentor", "fullName email");

  if (!updatedMember) {
    const error = new Error("Member profile not found.");
    error.statusCode = 404;
    throw error;
  }

  return updatedMember;
};
 // Delete a Member profile and revert user role back to "user" (Admin CRUD)
 
exports.deleteMember = async (memberId) => {
  const member = await Member.findById(memberId);
  if (!member) {
    const error = new Error("Member not found.");
    error.statusCode = 404;
    throw error;
  }

  // Revert user role back to unapproved applicant ("user")
  await User.findByIdAndUpdate(member.user, { role: "user" });
  await Member.findByIdAndDelete(memberId);

  return { message: "Membership revoked successfully." };
};
 //ADMIN PAGE 1: All Students
 // Filters allowed: batch, gender
 
exports.getAllStudentsForAdmin = async (filters = {}) => {
  const { batch, gender } = filters;
  let memberQuery = {};

  if (batch) {
    memberQuery.batch = batch;
  }

  let members = await Member.find(memberQuery)
    .populate({
      path: "user",
      select: "-password",
      match: {
        role: "student",
        ...(gender ? { gender: gender.toLowerCase() } : {}),
      },
    })
    .populate("batch", "name startDate endDate")
    .populate("assignedMentor", "fullName email")
    .lean();

  return members.filter((m) => m.user !== null);
};

  //ADMIN PAGE 2: Admins & Mentors
 // Filters allowed: role (mentor / admin), batch, gender
exports.getStaffForAdmin = async (filters = {}) => {
  const { role, batch, gender } = filters;
  let memberQuery = {};

  if (batch) {
    memberQuery.batch = batch;
  }

  let roleMatch = ["mentor", "admin"];
  if (role && (role === "mentor" || role === "admin")) {
    roleMatch = [role];
  }

  let members = await Member.find(memberQuery)
    .populate({
      path: "user",
      select: "-password",
      match: {
        role: { $in: roleMatch },
        ...(gender ? { gender: gender.toLowerCase() } : {}),
      },
    })
    .populate("batch", "name")
    .lean();

  return members.filter((m) => m.user !== null);
};

              // 2. MENTOR OPERATIONS
// MENTOR PAGE: View members in the mentor's batch
 // Filters allowed: filter = "all" (all students in batch) | "my_students" (assigned only)
 
exports.getMembersForMentor = async (mentorUserId, filters = {}) => {
  const { filter } = filters;

  const mentorMember = await Member.findOne({ user: mentorUserId });
  if (!mentorMember || !mentorMember.batch) {
    const error = new Error("You are not assigned to any active batch.");
    error.statusCode = 400;
    throw error;
  }

  let memberQuery = { batch: mentorMember.batch };

  if (filter === "my_students") {
    memberQuery.assignedMentor = mentorUserId;
  }

  let members = await Member.find(memberQuery)
    .populate({
      path: "user",
      select: "fullName email gender year department avatar role",
      match: { role: "student" },
    })
    .populate("batch", "name")
    .lean();

  return members.filter((m) => m.user !== null);
};

// MENTOR DETAILED VIEW: Get student detail ONLY if assigned to this mentor
exports.getStudentDetailForMentor = async (studentUserId, mentorUserId) => {
  const member = await Member.findOne({
    user: studentUserId,
    assignedMentor: mentorUserId,
  })
    .populate("user", "-password")
    .populate("batch", "name startDate endDate")
    .lean();

  if (!member) {
    const error = new Error("Access denied. This student is not assigned to you.");
    error.statusCode = 403;
    throw error;
  }

  return member;
};

//   3. STUDENT OPERATIONS
//  STUDENT PAGE: View overview of members in their batch (No sensitive details)

exports.getMembersForStudent = async (studentUserId) => {
  const studentMember = await Member.findOne({ user: studentUserId });

  if (!studentMember || !studentMember.batch) {
    const error = new Error("You are not currently enrolled in any active batch.");
    error.statusCode = 400;
    throw error;
  }

  const members = await Member.find({ batch: studentMember.batch })
    .populate({
      path: "user",
      select: "fullName email avatar role gender department year",
      match: { role: "student" },
    })
    .lean();

  return members.filter((m) => m.user !== null);
};