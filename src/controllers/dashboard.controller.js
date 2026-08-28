const dashboardService = require("../services/dashboard.service");

const getDashboardOverview = async (req, res) => {
  try {
    const { role } = req.user; // Provided by auth middleware

    let data;
    if (role === "admin") {
      // Pass req.user so the service can retrieve the admin's first name
      data = await dashboardService.getAdminOverviewData(req.user);
    } else if (role === "mentor") {
      data = await dashboardService.getMentorOverviewData(req.user._id);
    } else if (role === "student" || role === "user") {
      data = await dashboardService.getStudentOverviewData(req.user._id);
    } else {
      return res.status(403).json({ success: false, message: "Unauthorized role access." });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Dashboard Overview Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error fetching dashboard." });
  }
};

module.exports = {
  getDashboardOverview,
};