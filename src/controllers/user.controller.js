const userService = require("../services/user.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * GET /api/users
 * Get all users for Admin with filters (gender, status, role)
 * Query parameters:
 * - gender: male | female
 * - status: not_approved | approved
 * - role: user | student | mentor | admin
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers(req.query);
    return successResponse(res, { users }, "Users retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/me
 * Get profile details for the currently logged-in user
 */
exports.getOwnProfile = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.id);
    return successResponse(res, { user }, "Profile retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:userId
 * Get user by ID (Admin)
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.userId);
    return successResponse(res, { user }, "User retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/me
 * Update profile information for the currently logged-in user
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    return successResponse(res, { user }, "Profile updated successfully.", 200);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/me/password
 * Change password for the currently logged-in user
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return errorResponse(res, "Please provide your current and new password.", 400);
    }
    const result = await userService.changePassword(req.user.id, currentPassword, newPassword);
    return successResponse(res, result, result.message, 200);
  } catch (error) {
    next(error);
  }
};
exports.updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.userId, req.body);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};
/**
 * DELETE /api/users/:userId
 * Delete a user account and their linked member record (Admin)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.userId);
    return successResponse(res, result, result.message, 200);
  } catch (error) {
    next(error);
  }
};