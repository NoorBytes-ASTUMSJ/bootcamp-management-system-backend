const Member = require("../models/Member.model");
const User = require("../models/User.model");
const generateMemberId = require("../utils/generateMemberId");

exports.approveMember = async (applicantId, adminId, memberData = {}) => {
  const { assignedMentorId, batchId } = memberData;

  const user = await User.findById(applicantId);

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const existingMember = await Member.findOne({
    user: applicantId,
  });

  if (existingMember) {
    const error = new Error("This user is already an active member.");
    error.statusCode = 400;
    throw error;
  }

  user.role = user.applicationType;

  if (batchId) {
    user.batch = batchId;
  }

  await user.save();

  const memberId = await generateMemberId();

  const newMember = await Member.create({
    user: user._id,
    memberId,
    approvedBy: adminId,
    assignedMentor: assignedMentorId || null,
    status: "active",
  });

  const populatedMember = await Member.findById(newMember._id)
    .populate({
      path: "user",
      select: "-password",
      populate: {
        path: "batch",
        select: "name description startDate endDate status",
      },
    })
    .populate("assignedMentor", "fullName email")
    .populate("approvedBy", "fullName email");

  return {
    user: populatedMember.user,
    member: populatedMember,
  };
};

exports.updateMember = async (memberId, updateData) => {
  const updatedMember = await Member.findByIdAndUpdate(
    memberId,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  )
    .populate({
      path: "user",
      select: "-password",
      populate: {
        path: "batch",
        select: "name description startDate endDate status",
      },
    })
    .populate("assignedMentor", "fullName email")
    .populate("approvedBy", "fullName email");

  if (!updatedMember) {
    const error = new Error("Member profile not found.");
    error.statusCode = 404;
    throw error;
  }

  return updatedMember;
};

exports.deleteMember = async (memberId) => {
  const member = await Member.findById(memberId);

  if (!member) {
    const error = new Error("Member not found.");
    error.statusCode = 404;
    throw error;
  }

  await User.findByIdAndUpdate(member.user, {
    role: "user",
    batch: null,
  });

  await Member.findByIdAndDelete(memberId);

  return {
    message: "Membership revoked successfully.",
  };
};

exports.getAllStudentsForAdmin = async (filters = {}) => {
  const { gender, batch } = filters;

  const userMatch = {
    role: "student",
  };

  if (gender && gender !== "ALL") {
    userMatch.gender = gender.toLowerCase();
  }

  if (batch && batch !== "ALL") {
    userMatch.batch = batch;
  }

  const members = await Member.find()
    .populate({
      path: "user",
      select: "-password",
      match: userMatch,
      populate: {
        path: "batch",
        select: "name description startDate endDate status",
      },
    })
    .populate("assignedMentor", "fullName email")
    .populate("approvedBy", "fullName email")
    .sort({ createdAt: -1 })
    .lean();

  return members.filter((member) => member.user !== null);
};

exports.getStaffForAdmin = async (filters = {}) => {
  const {
    role,
    university,
    gender,
    batch,
  } = filters;

  const query = {
    role: {
      $in: ["mentor", "admin"],
    },
  };

  if (role && ["mentor", "admin"].includes(role)) {
    query.role = role;
  }

  if (university && university !== "ALL") {
    query.university = new RegExp(`^${university}$`, "i");
  }

  if (gender && gender !== "ALL") {
    query.gender = gender.toLowerCase();
  }

  if (batch && batch !== "ALL") {
    query.batch = batch;
  }

  return await User.find(query)
    .select("-password")
    .populate("batch", "name description startDate endDate status")
    .sort({ fullName: 1 })
    .lean();
};

exports.getMembersForMentor = async (
  mentorUserId,
  filters = {}
) => {
  const mentor = await User.findById(mentorUserId)
    .select("batch role")
    .lean();

  if (!mentor) {
    const error = new Error("Mentor not found.");
    error.statusCode = 404;
    throw error;
  }

  // Removed assignedMentor restriction here so ALL batch members are fetched
  const memberQuery = {
    status: "active",
  };

  const members = await Member.find(memberQuery)
    .populate({
      path: "user",
      select:
        "fullName email gender year department avatar role university phone batch",
      match: {
        role: "student",
      },
      populate: {
        path: "batch",
        select: "name description startDate endDate status",
      },
    })
    .populate("assignedMentor", "fullName email")
    .lean();

  return members.filter((member) => {
    if (!member.user) {
      return false;
    }

    if (!mentor.batch) {
      return true;
    }

    return (
      member.user.batch &&
      member.user.batch._id.toString() === mentor.batch.toString()
    );
  });
};

exports.getMembersForStudent = async (studentUserId, filter = "all") => {
  const studentMember = await Member.findOne({
    user: studentUserId,
    status: "active",
  });

  if (!studentMember) {
    const error = new Error(
      "You are not currently enrolled as a student."
    );
    error.statusCode = 400;
    throw error;
  }

  const student = await User.findById(studentUserId)
    .select("role batch")
    .lean();

  if (!student) {
    const error = new Error("Student account not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!student.batch) {
    return [];
  }

  const memberQuery = {
    status: "active",
  };

  if (filter === "my-group") {
    if (!studentMember.assignedMentor) {
      return [];
    }

    memberQuery.assignedMentor = studentMember.assignedMentor;
  }

  const members = await Member.find(memberQuery)
    .populate({
      path: "user",
      select:
        "fullName email phone avatar role gender department year university batch",
      match: {
        role: "student",
      },
      populate: {
        path: "batch",
        select: "name description startDate endDate status",
      },
    })
    .populate("assignedMentor", "fullName email")
    .lean();

  return members.filter((member) => {
    if (!member.user || !member.user.batch) {
      return false;
    }

    return (
      member.user.batch._id.toString() ===
      student.batch.toString()
    );
  });
};

exports.getStudentDetailForMentor = async (mentorUserId, studentUserId) => {
  const studentMember = await Member.findOne({
    user: studentUserId,
    assignedMentor: mentorUserId,
    status: "active",
  })
    .populate({
      path: "user",
      select: "-password",
      populate: {
        path: "batch",
        select: "name description startDate endDate status",
      },
    })
    .populate("assignedMentor", "fullName email")
    .populate("approvedBy", "fullName email")
    .lean();

  if (!studentMember) {
    const error = new Error("Student not found or not assigned to you.");
    error.statusCode = 403;
    throw error;
  }

  return studentMember;
};