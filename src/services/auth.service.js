
const User = require("../models/User.model");
const Member = require("../models/Member.model");
const generateToken = require("../utils/generateToken");


const createApplicant = async (data, applicationType) => {
  const { email, fullName } = data;

  const existingUser = await User.findOne({
    email: email.toLowerCase().trim(),
  });

  if (existingUser) {
    const error = new Error(
      "An account with this email already exists."
    );
    error.statusCode = 400;
    throw error;
  }

  const user = await User.create({
    ...data,
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    role: "user",
    applicationType,
  });

  const token = generateToken(user._id, user.role);

  return {
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      applicationType: user.applicationType,
    },
    token,
  };
};


exports.registerStudent = (data) => {
  return createApplicant(data, "student");
};


exports.registerMentor = (data) => {
  return createApplicant(data, "mentor");
};

exports.loginUser = async (email, password) => {
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+password");

  // Check credentials
  if (!user || !(await user.comparePassword(password))) {
    const error = new Error(
      "The email or password you entered is incorrect."
    );
    error.statusCode = 401;
    throw error;
  }

  // Generate JWT
  const token = generateToken(user._id, user.role);

  let memberInfo = null;

  // Students and mentors have Member records
  if (["student", "mentor"].includes(user.role)) {
    memberInfo = await Member.findOne({
      user: user._id,
    })
      .select("memberId joinedAt assignedMentor status user")
      .populate({
        path: "user",
        select: "batch",
        populate: {
          path: "batch",
          select: "name startDate endDate status",
        },
      })
      .populate(
        "assignedMentor",
        "fullName email"
      )
      .lean();
  }

  return {
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      applicationType: user.applicationType,

      // Batch comes directly from User
      batch: user.batch || null,

      // Member information
      member: memberInfo,
    },

    token,
  };
};

exports.getUserIdentity = async (userId) => {
  const user = await User.findById(userId)
    .select("-password")
    .populate("batch", "name startDate endDate status");

  if (!user) {
    const error = new Error(
      "We couldn't find your account. Please log in again."
    );
    error.statusCode = 404;
    throw error;
  }

  return user;
};

