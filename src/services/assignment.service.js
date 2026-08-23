const Assignment = require("../models/Assignment.model");
const Member = require("../models/Member.model");

// 1. Create a new assignment
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

  // If created by a MENTOR: Automatically retrieve their assigned batch
  if (creatorRole === "mentor") {
    const mentorMember = await Member.findOne({ user: creatorId });

    if (!mentorMember || !mentorMember.batch) {
      const error = new Error("You are not currently assigned to an active batch.");
      error.statusCode = 400;
      throw error;
    }

    // Lock the batch to the mentor's current batch
    targetBatch = mentorMember.batch;
  }

  // If created by ADMIN for a global assignment: Ensure batch ID is provided
  if (creatorRole === "admin" && scope === "global" && !targetBatch) {
    const error = new Error("Please select a batch for this global assignment.");
    error.statusCode = 400;
    throw error;
  }

  // If mentor_assigned scope: Ensure valid targeted student members are supplied
  if (scope === "mentor_assigned") {
    if (!assignedMembers || assignedMembers.length === 0) {
      const error = new Error("Please select at least one student for mentor_assigned scope.");
      error.statusCode = 400;
      throw error;
    }

    const validMembers = await Member.find({ _id: { $in: assignedMembers } });
    if (validMembers.length !== assignedMembers.length) {
      const error = new Error("One or more assigned student members were not found.");
      error.statusCode = 404;
      throw error;
    }
  }

  const assignment = await Assignment.create({
    title,
    description,
    instructions,
    scope,
    batch: targetBatch,
    assignedMembers: scope === "mentor_assigned" ? assignedMembers : [],
    deadline,
    maxScore,
    fileUrl,
    fileName,
    fileType,
    createdBy: creatorId,
  });

  return assignment;
};

// 2. Get all assignments (Admin overview)
exports.getAdminAssignments = async (query = {}) => {
  const { batchId, scope } = query;
  const filter = {};

  if (batchId) filter.batch = batchId;
  if (scope) filter.scope = scope;

  return await Assignment.find(filter)
    .populate("createdBy", "fullName email role")
    .populate("batch", "name")
    .sort({ createdAt: -1 })
    .lean();
};

// 3. Get assignments created by or relevant to a Mentor
exports.getMentorAssignments = async (mentorUserId) => {
  return await Assignment.find({ createdBy: mentorUserId })
    .populate("batch", "name")
    .populate({
      path: "assignedMembers",
      populate: { path: "user", select: "fullName email" },
    })
    .sort({ createdAt: -1 })
    .lean();
};

// 4. Get assignments assigned to a specific Student
exports.getStudentAssignments = async (studentUserId) => {
  const studentMember = await Member.findOne({ user: studentUserId });

  if (!studentMember || !studentMember.batch) {
    const error = new Error("Student membership or batch record not found.");
    error.statusCode = 404;
    throw error;
  }

  const filter = {
    $or: [
      { scope: "global", batch: studentMember.batch },
      { scope: "mentor_assigned", assignedMembers: studentMember._id },
    ],
  };

  return await Assignment.find(filter)
    .populate("createdBy", "fullName email role")
    .populate("batch", "name")
    .sort({ deadline: 1 })
    .lean();
};

// 5. Get assignment details by ID
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

// 6. Update assignment
exports.updateAssignment = async (assignmentId, userId, userRole, updateData) => {
  const assignment = await Assignment.findById(assignmentId);

  if (!assignment) {
    const error = new Error("Assignment not found.");
    error.statusCode = 404;
    throw error;
  }

  if (userRole !== "admin" && assignment.createdBy.toString() !== userId.toString()) {
    const error = new Error("Not authorized to update this assignment.");
    error.statusCode = 403;
    throw error;
  }

  Object.assign(assignment, updateData);
  await assignment.save();

  return assignment;
};

// 7. Delete assignment
exports.deleteAssignment = async (assignmentId, userId, userRole) => {
  const assignment = await Assignment.findById(assignmentId);

  if (!assignment) {
    const error = new Error("Assignment not found.");
    error.statusCode = 404;
    throw error;
  }

  if (userRole !== "admin" && assignment.createdBy.toString() !== userId.toString()) {
    const error = new Error("Not authorized to delete this assignment.");
    error.statusCode = 403;
    throw error;
  }

  await Assignment.findByIdAndDelete(assignmentId);
  return { message: "Assignment deleted successfully." };
};