const ProgressRecord = require("../models/ProgressRecord.model");
const User = require("../models/User.model");
const Member = require("../models/Member.model");
const progressService = require("../services/progress.service");
const { successResponse } = require("../utils/apiResponse");

// Release Progress Items (Admin/Mentor)
exports.createProgressItem = async (req, res, next) => {
  try {
    const items = await progressService.createProgressItem(req.user.id, req.user.role, req.body);
    return successResponse(res, { items }, "Progress item(s) released successfully.", 201);
  } catch (error) {
    next(error);
  }
};

// Update Progress Status (Student Only)
exports.updateStudentStatus = async (req, res, next) => {
  try {
    const { progressId } = req.params;
    const { status } = req.body;
    const updated = await progressService.updateStudentStatus(progressId, req.user.id, status);
    return successResponse(res, { progress: updated }, "Progress status updated.", 200);
  } catch (error) {
    next(error);
  }
};

// Get Dashboard Rows (Admin / Mentor)
exports.getProgressDashboard = async (req, res, next) => {
  try {
    const filterQuery = { ...req.query };

    if (req.user.role === "mentor") {
      // Default (unchanged): scope to this mentor's own assigned students.
      // Pass scopeToAssigned=false to see every student instead.
      const scopeToAssigned = req.query.scopeToAssigned !== "false";

      if (scopeToAssigned) {
        filterQuery.mentorId = req.user.id;
      }
    } else if (req.user.role === "admin") {
      filterQuery.scope = "global";
    }

    const data = await progressService.getProgressDashboard(filterQuery);
    return successResponse(res, { students: data }, "Progress dashboard data retrieved.", 200);
  } catch (error) {
    next(error);
  }
};

// Get All Raw Progress Items (Admin / Mentor) - Required for dynamic table matrix mapping
exports.getAllProgressItems = async (req, res, next) => {
  try {
    const { batchId, scopeToAssigned } = req.query;
    const isScoped = scopeToAssigned !== "false";

    let studentFilter = {};

    if (batchId && batchId !== "ALL") {
      const usersInBatch = await User.find({ batch: batchId, role: "student" }).select("_id");
      const userIds = usersInBatch.map((u) => u._id);
      const members = await Member.find({ user: { $in: userIds } }).select("_id");
      studentFilter = { student: { $in: members.map((m) => m._id) } };
    }

    if (req.user.role === "mentor" && isScoped) {
      const myStudents = await Member.find({ assignedMentor: req.user.id }).select("_id");
      const myStudentIds = myStudents.map((m) => String(m._id));

      studentFilter = studentFilter.student
        ? {
            student: {
              $in: studentFilter.student.$in.filter((id) =>
                myStudentIds.includes(String(id))
              ),
            },
          }
        : { student: { $in: myStudentIds } };
    }

    const records = await ProgressRecord.find(studentFilter)
      .populate({
        path: "task",
        populate: { path: "releasedBy", select: "fullName role" },
      })
      .populate("student", "_id")
      .lean();

    let filtered = records.filter((r) => r.task);

    if (req.user.role === "admin") {
      filtered = filtered.filter((r) => r.task.scope === "global");
    } else if (req.user.role === "mentor" && isScoped) {
      filtered = filtered.filter(
        (r) =>
          r.task.scope === "global" ||
          String(r.task.releasedBy?._id || r.task.releasedBy) === String(req.user.id)
      );
    }
    // When a mentor passes scopeToAssigned=false, no releasedBy filtering
    // happens — every item for the batch comes back as-is.

    const items = filtered.map((r) => ({
      id: r.task._id,
      student: r.student,
      status: r.status,
      title: r.task.title,
      topicCategory: r.task.topicCategory,
      resourceType: r.task.resourceType,
      resourceLink: r.task.resourceLink,
      weekNumber: r.task.weekNumber,
      instructions: r.task.instructions,
      releasedBy: r.task.releasedBy,
    }));

    return successResponse(res, { items }, "All progress items retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

// Get Single Student Drawer Details (Triggered on row click)
exports.getStudentDrawerDetails = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const data = await progressService.getStudentDrawerDetails(memberId);
    return successResponse(res, { drawerData: data }, "Student details retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

// Get Logged-in Student View
exports.getStudentDashboard = async (req, res, next) => {
  try {
    const data = await progressService.getStudentDashboard(req.user.id);
    return successResponse(res, { dashboard: data }, "Student progress dashboard loaded.", 200);
  } catch (error) {
    next(error);
  }
};

exports.updateProgressItem = async (req, res, next) => {
  try {
    const { progressId } = req.params;
    const task = await progressService.updateProgressItem(
      progressId,
      req.user.id,
      req.user.role,
      req.body
    );
    return successResponse(res, { task }, "Progress task updated successfully.", 200);
  } catch (error) {
    next(error);
  }
};

// Delete Progress Task
exports.deleteProgressItem = async (req, res, next) => {
  try {
    const result = await progressService.deleteProgressItem(
      req.params.progressId,
      req.user.id,
      req.user.role
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};