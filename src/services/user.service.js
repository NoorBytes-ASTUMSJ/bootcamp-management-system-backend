const User = require("../models/User.model");
const Member = require("../models/Member.model");

exports.getAllUsers = async (queryParams = {}) => {
  const { gender, status, role } = queryParams;
  let query = {};

  // Filter by Gender (male / female)
  if (gender) {
    query.gender = gender.toLowerCase();
  }
  // Filter by Approval Status (derived from role)
  if (status) {
    if (status === "not_approved") {
      query.role = "user";
    } else if (status === "approved") {
      query.role = { $in: ["student", "mentor", "admin"] };
    }
  }

  // Filter by specific Role
  if (role) {
    query.role = role;
  }

  return await User.find(query)
    .select("-password")
    .sort({ fullName: 1 })
    .lean();
};

/**
 * Fetch single user by ID
 */
exports.getUserById = async (userId) => {
  const user = await User.findById(userId).select("-password").lean();

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  return user;
};
//  Update logged-in user's profile information
 
exports.updateProfile = async (userId, updates) => {
  // Prevent direct update of sensitive/system fields
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

/**
 * Change password for logged-in user
 */
exports.changePassword = async (userId, currentPassword, newPassword) => {
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
  // Validate new password length (matches schema minlength)
  if (newPassword.length < 8) {
    const error = new Error("New password must be at least 8 characters long.");
    error.statusCode = 400;
    throw error;
  }

  user.password = newPassword;
  await user.save();

  return { message: "Password updated successfully." };
};

/**
 * Delete user account and linked membership record (Admin)
 */
exports.deleteUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  // Cleanup member record if one exists
  await Member.findOneAndDelete({ user: userId });
  await User.findByIdAndDelete(userId);

  return { message: "User deleted successfully." };
};