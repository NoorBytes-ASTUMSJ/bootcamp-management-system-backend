const { errorResponse } = require("../utils/apiResponse");

module.exports = (err, req, res, next) => {
  console.error(err);

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return errorResponse(res, messages.join(", "), 400);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return errorResponse(res, `${field} already in use.`, 400);
  }

  // Invalid ObjectId format
  if (err.name === "CastError") {
    return errorResponse(res, "Invalid ID format.", 400);
  }

  // Errors thrown manually in services (error.statusCode set)
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong. Please try again.";

  return errorResponse(res, message, statusCode);
};