const User = require("../models/User.model");
const Member = require("../models/Member.model");
const generateToken = require("../utils/generateToken");


// 1. Helper for applicant creation 
const createApplicant = async (data, applicationType) => {
  const { email, fullName } = data;

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    const error = new Error("An account with this email already exists.");
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

// --- EXPORTED SERVICE METHODS ---

exports.registerStudent = (data) => createApplicant(data, "student");

exports.registerMentor = (data) => createApplicant(data, "mentor");

exports.loginUser = async (email, password) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    const error = new Error("The email or password you entered is incorrect.");
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user._id, user.role);

  let memberInfo = null;
  if (["student", "mentor"].includes(user.role)) {
    memberInfo = await Member.findOne({ user: user._id })
      .populate("batch", "name startDate endDate status")
      .select("memberId batch joinedAt assignedMentor status");
  }

  return {
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      applicationType: user.applicationType,
      member: memberInfo,
    },
    token,
  };
};

exports.getUserIdentity = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    const error = new Error("We couldn't find your account. Please log in again.");
    error.statusCode = 404;
    throw error;
  }
  return user;
};