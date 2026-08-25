const User = require("../models/User.model");
const Member = require("../models/Member.model");

exports.getAllUsers = async (queryParams = {}) => {
  const {
    search,
    role,
    university,
    gender,
    batch,
  } = queryParams;

  const query = {};

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");

    query.$or = [
      { fullName: searchRegex },
      { email: searchRegex },
    ];
  }

  if (gender && gender !== "ALL") {
    query.gender = gender.toLowerCase();
  }

  if (university && university !== "ALL") {
    query.university = new RegExp(`^${university}$`, "i");
  }

  if (batch && batch !== "ALL") {
    query.batch = batch;
  }

  if (role && role !== "ALL") {
    if (role === "ALLmembers") {
      query.role = {
        $in: ["student", "mentor", "admin"],
      };
    } else if (
      ["user", "student", "mentor", "admin"].includes(role)
    ) {
      query.role = role;
    }
  }

  return await User.find(query)
    .select("-password")
    .populate("batch", "name")
    .sort({ fullName: 1 })
    .lean();
};

exports.getUserById = async (userId) => {
  const user = await User.findById(userId)
    .select("-password")
    .populate("batch", "name")
    .lean();

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  return user;
};

exports.updateProfile = async (userId, updates) => {
  delete updates.password;
  delete updates.role;
  delete updates.email;
  delete updates.applicationType;

  const updatedUser = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updatedUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  return updatedUser;
};

exports.changePassword = async (
  userId,
  currentPassword,
  newPassword
) => {
  const user = await User.findById(userId).select("+password");

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    const error = new Error("Current password is incorrect.");
    error.statusCode = 400;
    throw error;
  }

  if (newPassword.length < 8) {
    const error = new Error(
      "New password must be at least 8 characters long."
    );
    error.statusCode = 400;
    throw error;
  }

  user.password = newPassword;
  await user.save();

  return { message: "Password updated successfully." };
};

exports.deleteUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  await Member.findOneAndDelete({ user: userId });
  await User.findByIdAndDelete(userId);

  return { message: "User deleted successfully." };
};

