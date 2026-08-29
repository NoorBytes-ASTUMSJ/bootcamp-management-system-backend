const User = require("../models/User.model");
const Member = require("../models/Member.model");
const Batch = require("../models/Batch.model");
const generateToken = require("../utils/generateToken");
const { sendOTPEmail } = require("../utils/sendEmail");

const createApplicant = async (data, applicationType) => {
  const { email, fullName } = data;

  const existingUser = await User.findOne({
    email: email.toLowerCase().trim(),
  });

  if (existingUser) {
    const error = new Error("An account with this email already exists.");
    error.statusCode = 400;
    throw error;
  }

  // 1. አክቲቭ የሆነውን ባች መፈለግ
  let assignedBatch = data.batch || null;
  if (!assignedBatch) {
    let activeBatch = await Batch.findOne({
      status: { $regex: /^(upcoming|ongoing|active)$/i },
    }).sort({ createdAt: -1 });

    if (!activeBatch) {
      activeBatch = await Batch.findOne({
        status: { $not: { $regex: /^completed$/i } },
      }).sort({ createdAt: -1 });
    }

    if (!activeBatch) {
      activeBatch = await Batch.findOne().sort({ createdAt: -1 });
    }

    if (activeBatch) {
      assignedBatch = activeBatch._id;
    }
  }

  const universityId =
    data.universityId || data.studentId || data.studentID || "";
  const university =
    data.university ||
    data.universityName ||
    "Adama Science and Technology University";

  // 2. ተጠቃሚውን ከነ ባች IDው መፍጠር
  const user = await User.create({
    ...data,
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    role: "user",
    applicationType,
    batch: assignedBatch,
    universityId,
    university,
  });

  const populatedUser = await User.findById(user._id).populate(
    "batch",
    "name startDate endDate status",
  );

  const token = generateToken(user._id, user.role);

  return {
    user: {
      _id: populatedUser._id,
      fullName: populatedUser.fullName,
      email: populatedUser.email,
      role: populatedUser.role,
      applicationType: populatedUser.applicationType,
      batch: populatedUser.batch || null,
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
  })
    .select("+password")
    .populate("batch", "name startDate endDate status");

  if (!user || !(await user.comparePassword(password))) {
    const error = new Error("The email or password you entered is incorrect.");
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user._id, user.role);

  let memberInfo = null;

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
      .populate("assignedMentor", "fullName email")
      .lean();
  }

  return {
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      applicationType: user.applicationType,
      batch: user.batch || null,
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
      "We couldn't find your account. Please log in again.",
    );
    error.statusCode = 404;
    throw error;
  }

  return user;
};

/**
 * @desc Generate OTP and send email for password reset
 */
exports.forgotPassword = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    const error = new Error("No account found with this email address.");
    error.statusCode = 404;
    throw error;
  }

  // Generate 6-digit random code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  user.resetPasswordOTP = otp;
  user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  await sendOTPEmail(user.email, otp);

  return { message: "Verification code sent to your email." };
};

/**
 * @desc Verify OTP and update user password
 */
exports.resetPasswordWithOTP = async (email, otp, newPassword) => {
  if (newPassword.length < 8) {
    const error = new Error("Password must be at least 8 characters long.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    resetPasswordOTP: otp.trim(),
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    const error = new Error("Invalid or expired verification code.");
    error.statusCode = 400;
    throw error;
  }

  user.password = newPassword; // Will be hashed by pre('save') hook in userSchema
  user.resetPasswordOTP = null;
  user.resetPasswordExpires = null;
  await user.save();

  return { message: "Password reset successful! You can now log in." };
};
