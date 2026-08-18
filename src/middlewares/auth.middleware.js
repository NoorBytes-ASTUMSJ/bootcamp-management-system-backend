const jwt = require("jsonwebtoken");
const { errorResponse } = require("../utils/apiResponse");

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // Return error if no token is found
    if (!token) {
      return errorResponse(
        res,
        "Access denied. No authentication token provided.",
        401
      );
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //  Attach decoded payload (e.g., { id, role }) to request object
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return errorResponse(
        res,
        "Your session has expired. Please log in again.",
        401
      );
    }

    if (error.name === "JsonWebTokenError") {
      return errorResponse(
        res,
        "Invalid token. Authentication failed.",
        401
      );
    }

    return errorResponse(res, "Authentication failed.", 401);
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access denied. Your role (${req.user?.role || "guest"}) is not authorized to access this route.`,
        403
      );
    }
    next();
  };
};