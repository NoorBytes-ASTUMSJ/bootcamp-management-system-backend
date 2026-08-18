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
      return errorResponse(res, "Please provide your full name, email, and password.", 400);
    }

    const result = await authService.registerStudent(req.body);

    return successResponse(
      res,
      result,
      "Your student application has been submitted successfully. Please check Announcements for updates.",
      201
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
      return errorResponse(res, "Please provide your full name, email, and password.", 400);
    }

    const result = await authService.registerMentor(req.body);

    return successResponse(
      res,
      result,
      "Your mentor application has been submitted successfully.",
      201
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
      return errorResponse(res, "Please enter both your email and password.", 400);
    }

    const result = await authService.loginUser(email, password);

    return successResponse(
      res,
      result,
      "Welcome back! You have been logged in successfully.",
      200
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
      200
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
  return successResponse(res, null, "You have been logged out successfully.", 200);
};