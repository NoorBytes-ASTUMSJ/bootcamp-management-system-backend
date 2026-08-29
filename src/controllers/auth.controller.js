const authService = require("../services/auth.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * @desc    Register a Student Applicant
 * @route   POST /api/auth/register/student
 * @access  Public
 */
exports.registerStudent = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return errorResponse(
        res,
        "Please provide your full name, email, and password.",
        400,
      );
    }

    const result = await authService.registerStudent(req.body);

    return successResponse(
      res,
      result,
      "Your student application has been submitted successfully. Please check Announcements for updates.",
      201,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register a Mentor Applicant
 * @route   POST /api/auth/register/mentor
 * @access  Public
 */
exports.registerMentor = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return errorResponse(
        res,
        "Please provide your full name, email, and password.",
        400,
      );
    }

    const result = await authService.registerMentor(req.body);

    return successResponse(
      res,
      result,
      "Your mentor application has been submitted successfully.",
      201,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user and return JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return errorResponse(
        res,
        "Please enter both your email and password.",
        400,
      );
    }

    const result = await authService.loginUser(email, password);

    return successResponse(
      res,
      result,
      "Welcome back! You have been logged in successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current authenticated basic identity
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await authService.getUserIdentity(req.user.id);

    return successResponse(
      res,
      { user },
      "Your identity was retrieved successfully.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request Password Reset OTP
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(
        res,
        "Please provide your registered email address.",
        400,
      );
    }

    const result = await authService.forgotPassword(email);

    return successResponse(
      res,
      result,
      "A 6-digit verification code has been sent to your email.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP and Reset Password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
exports.resetPasswordWithOTP = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return errorResponse(
        res,
        "Please provide your email, verification code, and new password.",
        400,
      );
    }

    const result = await authService.resetPasswordWithOTP(
      email,
      otp,
      newPassword,
    );

    return successResponse(
      res,
      result,
      "Your password has been reset successfully! You can now log in.",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res) => {
  return successResponse(
    res,
    null,
    "You have been logged out successfully.",
    200,
  );
};
