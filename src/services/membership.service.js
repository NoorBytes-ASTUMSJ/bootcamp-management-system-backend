const Member = require("../models/Member.model");
const User = require("../models/User.model");
const generateMemberId = require("../utils/generateMemberId");

// ==================================================
// ADMIN
// ==================================================

// Approve applicant and create member
exports.approveMember = async (applicantId, adminId, memberData = {}) => {
  const { assignedMentorId } = memberData;

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
    const error = new Error(
      "This user is already an active member.",
    );
    error.statusCode = 400;
    throw error;
  }

  // Convert applicant to the selected application role
  user.role = user.applicationType;

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
    .populate("user", "-password")
    .populate("assignedMentor", "fullName email")
    .populate("approvedBy", "fullName email");

  return {
    user,
    member: populatedMember,
  };
};

// Update member
exports.updateMember = async (memberId, updateData) => {
  const updatedMember = await Member.findByIdAndUpdate(
    memberId,
    updateData,
    {
      new: true,
      runValidators: true,
    },
  )
    .populate("user", "-password")
    .populate("assignedMentor", "fullName email")
    .populate("approvedBy", "fullName email");

  if (!updatedMember) {
    const error = new Error("Member profile not found.");
    error.statusCode = 404;
    throw error;
  }

  return updatedMember;
};

// Delete member
exports.deleteMember = async (memberId) => {
  const member = await Member.findById(memberId);

  if (!member) {
    const error = new Error("Member not found.");
    error.statusCode = 404;
    throw error;
  }

  // Revert user's role
  await User.findByIdAndUpdate(member.user, {
    role: "user",
  });

  await Member.findByIdAndDelete(memberId);

  return {
    message: "Membership revoked successfully.",
  };
};

// Get all students for admin
exports.getAllStudentsForAdmin = async (filters = {}) => {
  const { gender } = filters;

  const userMatch = {
    role: "student",
  };

  if (gender && gender !== "ALL") {
    userMatch.gender = gender.toLowerCase();
  }

  const members = await Member.find()
    .populate({
      path: "user",
      select: "-password",
      match: userMatch,
    })
    .populate("assignedMentor", "fullName email")
    .populate("approvedBy", "fullName email")
    .sort({ createdAt: -1 })
    .lean();

  return members.filter(
    (member) => member.user !== null,
  );
};

// Get staff for admin
exports.getStaffForAdmin = async (filters = {}) => {
  const {
    role,
    university,
    gender,
  } = filters;

  const query = {
    role: {
      $in: ["mentor", "admin"],
    },
  };

  if (
    role &&
    ["mentor", "admin"].includes(role)
  ) {
    query.role = role;
  }

  if (
    university &&
    university !== "ALL"
  ) {
    query.university = new RegExp(
      `^${university}$`,
      "i",
    );
  }

  if (
    gender &&
    gender !== "ALL"
  ) {
    query.gender = gender.toLowerCase();
  }

  return await User.find(query)
    .select("-password")
    .sort({ fullName: 1 })
    .lean();
};

// ==================================================
// MENTOR
// ==================================================

// Get students assigned to mentor
exports.getMembersForMentor = async (
  mentorUserId,
  filters = {},
) => {
  const { filter } = filters;

  const memberQuery = {
    assignedMentor: mentorUserId,
  };

  const members = await Member.find(memberQuery)
    .populate({
      path: "user",
      select:
        "fullName email gender year department avatar role university phone",
      match: {
        role: "student",
      },
    })
    .populate(
      "assignedMentor",
      "fullName email",
    )
    .lean();

  return members.filter(
    (member) => member.user !== null,
  );
};

// Get individual student detail for mentor
exports.getStudentDetailForMentor = async (
  studentUserId,
  mentorUserId,
) => {
  const member = await Member.findOne({
    user: studentUserId,
    assignedMentor: mentorUserId,
  })
    .populate("user", "-password")
    .populate(
      "assignedMentor",
      "fullName email",
    )
    .lean();

  if (!member) {
    const error = new Error(
      "Access denied. This student is not assigned to you.",
    );

    error.statusCode = 403;

    throw error;
  }

  return member;
};

// ==================================================
// STUDENT
// ==================================================

// Get students visible to current student
exports.getMembersForStudent = async (
  studentUserId,
) => {
  const studentMember = await Member.findOne({
    user: studentUserId,
  });

  if (!studentMember) {
    const error = new Error(
      "You are not currently enrolled as a student.",
    );

    error.statusCode = 400;

    throw error;
  }

  /*
   * Since there is currently no batch field,
   * students can see all active students.
   *
   * If you later add batches, this function
   * can be changed to filter by batch.
   */
  const members = await Member.find({
    status: "active",
  })
    .populate({
      path: "user",
      select:
        "fullName email avatar role gender department year university",
      match: {
        role: "student",
      },
    })
    .populate(
      "assignedMentor",
      "fullName email",
    )
    .lean();

  return members.filter(
    (member) => member.user !== null,
  );
};