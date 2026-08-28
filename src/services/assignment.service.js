const Assignment = require("../models/Assignment.model");
const Member = require("../models/Member.model");
const Submission = require("../models/Submission.model");
const User = require("../models/User.model");
const fs = require("fs");
const path = require("path");

exports.createAssignment = async (creatorId, creatorRole, data) => {
  const {
    title,
    description,
    instructions,
    scope,
    batch,
    assignedMembers,
    deadline,
    maxScore,
    fileUrl,
    fileName,
    fileType,
  } = data;

  let targetBatch = batch;
  let targetMemberIds = [];

  if (creatorRole === "mentor") {
    const mentorUser = await User.findById(creatorId);

    if (!mentorUser || !mentorUser.batch) {
      const error = new Error(
        "You are not currently assigned to an active batch.",
      );
      error.statusCode = 400;
      throw error;
    }

    targetBatch = mentorUser.batch;

    const assignedStudents = await Member.find({
      assignedMentor: creatorId,
      status: "active",
    });

    if (assignedStudents.length === 0) {
      const error = new Error(
        "You have no active students assigned to you to receive this assignment.",
      );
      error.statusCode = 400;
      throw error;
    }

    targetMemberIds = assignedStudents.map((s) => s._id);
  }

  if (creatorRole === "admin" && scope === "global" && !targetBatch) {
    const error = new Error(
      "Please select a batch for this global assignment.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (scope === "mentor_assigned" && creatorRole === "admin") {
    if (!assignedMembers || assignedMembers.length === 0) {
      const error = new Error(
        "Please select at least one student for mentor_assigned scope.",
      );
      error.statusCode = 400;
      throw error;
    }

    const validMembers = await Member.find({ _id: { $in: assignedMembers } });
    if (validMembers.length !== assignedMembers.length) {
      const error = new Error(
        "One or more assigned student members were not found.",
      );
      error.statusCode = 404;
      throw error;
    }
    targetMemberIds = assignedMembers;
  }

  const finalScope = creatorRole === "mentor" ? "mentor_assigned" : scope;

  const assignment = await Assignment.create({
    title,
    description,
    instructions,
    scope: finalScope,
    batch: targetBatch,
    assignedMembers: finalScope === "mentor_assigned" ? targetMemberIds : [],
    deadline,
    maxScore,
    fileUrl,
    fileName,
    fileType,
    createdBy: creatorId,
  });

  if (creatorRole === "admin" && finalScope === "global") {
    const usersInBatch = await User.find({
      batch: targetBatch,
      role: "student",
    });
    const userIds = usersInBatch.map((u) => u._id);

    const studentsInBatch = await Member.find({ user: { $in: userIds } });
    targetMemberIds = studentsInBatch.map((student) => student._id);
  }

  const submissionRecords = targetMemberIds.map((memberId) => ({
    assignment: assignment._id,
    member: memberId,
    status: "not_started",
  }));

  if (submissionRecords.length > 0) {
    await Submission.insertMany(submissionRecords);
  }

  return assignment;
};

exports.getAdminAssignments = async (query = {}) => {
  const { batchId } = query;
  const filter = { scope: "global" };

  if (batchId) filter.batch = batchId;

  const assignments = await Assignment.find(filter)
    .populate("createdBy", "fullName email role")
    .populate("batch", "name")
    .sort({ createdAt: -1 })
    .lean();

  const assignmentIds = assignments.map((a) => a._id);
  const submissions = await Submission.find({
    assignment: { $in: assignmentIds },
  }).lean();

  return assignments.map((a) => {
    const relSubs = submissions.filter(
      (s) => s.assignment && s.assignment.toString() === a._id.toString(),
    );
    return {
      ...a,
      totalStudents: relSubs.length,
      submissionsCount: relSubs.filter((s) => s.status !== "not_started")
        .length,
    };
  });
};

exports.getMentorAssignments = async (mentorUserId) => {
  console.log("--- RUNNING NEW MENTOR ASSIGNMENT FETCH ---");
  const mentorUser = await User.findById(mentorUserId);
  const assignedStudents = await Member.find({
    assignedMentor: mentorUserId,
  }).select("_id");
  const studentIds = assignedStudents.map((s) => s._id.toString());

  const filter = {
    $or: [{ createdBy: mentorUserId }],
  };

  if (mentorUser && mentorUser.batch) {
    filter.$or.push({ scope: "global", batch: mentorUser.batch });
  }

  const assignments = await Assignment.find(filter)
    .populate("batch", "name")
    .populate({
      path: "assignedMembers",
      populate: { path: "user", select: "fullName email" },
    })
    .populate("createdBy", "fullName email role")
    .sort({ createdAt: -1 })
    .lean();

  const assignmentIds = assignments.map((a) => a._id);
  const submissions = await Submission.find({
    assignment: { $in: assignmentIds },
  }).lean();

  return assignments.map((a) => {
    let relSubs = submissions.filter(
      (s) => s.assignment && s.assignment.toString() === a._id.toString(),
    );

    if (a.scope !== "global") {
      relSubs = relSubs.filter(
        (s) => s.member && studentIds.includes(s.member.toString()),
      );
    }

    return {
      ...a,
      totalStudents: relSubs.length,
      submissionsCount: relSubs.filter((s) => s.status !== "not_started")
        .length,
    };
  });
};

exports.getStudentAssignments = async (studentUserId) => {
  const studentUser = await User.findById(studentUserId);
  const studentMember = await Member.findOne({ user: studentUserId });

  if (!studentUser || !studentUser.batch || !studentMember) {
    const error = new Error("Student membership or batch record not found.");
    error.statusCode = 404;
    throw error;
  }

  const filter = {
    $or: [
      { scope: "global", batch: studentUser.batch },
      { scope: "mentor_assigned", assignedMembers: studentMember._id },
    ],
  };

  return await Assignment.find(filter)
    .populate("createdBy", "fullName email role")
    .populate("batch", "name")
    .sort({ deadline: 1 })
    .lean();
};

exports.getAssignmentById = async (assignmentId) => {
  const assignment = await Assignment.findById(assignmentId)
    .populate("createdBy", "fullName email role")
    .populate("batch", "name")
    .populate({
      path: "assignedMembers",
      populate: { path: "user", select: "fullName email memberId" },
    })
    .lean();

  if (!assignment) {
    const error = new Error("Assignment not found.");
    error.statusCode = 404;
    throw error;
  }

  return assignment;
};

exports.updateAssignment = async (
  assignmentId,
  userId,
  userRole,
  updateData,
) => {
  const assignment = await Assignment.findById(assignmentId);

  if (!assignment) {
    const error = new Error("Assignment not found.");
    error.statusCode = 404;
    throw error;
  }

  if (
    userRole !== "admin" &&
    assignment.createdBy.toString() !== userId.toString()
  ) {
    const error = new Error("Not authorized to update this assignment.");
    error.statusCode = 403;
    throw error;
  }

  Object.assign(assignment, updateData);
  await assignment.save();

  return assignment;
};

exports.deleteAssignment = async (assignmentId, userId, userRole) => {
  const assignment = await Assignment.findById(assignmentId);

  if (!assignment) {
    const error = new Error("Assignment not found.");
    error.statusCode = 404;
    throw error;
  }

  if (
    userRole !== "admin" &&
    assignment.createdBy.toString() !== userId.toString()
  ) {
    const error = new Error("Not authorized to delete this assignment.");
    error.statusCode = 403;
    throw error;
  }

  if (assignment.fileUrl) {
    const filePath = path.join(__dirname, "..", assignment.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  await Submission.deleteMany({ assignment: assignmentId });
  await Assignment.findByIdAndDelete(assignmentId);

  return { message: "Assignment deleted successfully." };
};
