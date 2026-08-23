const Progress = require("../models/Progress.model");
const Member = require("../models/Member.model");

// 1. Release Progress Item (Admin or Mentor)
exports.createProgressItem = async (creatorId, creatorRole, data) => {
  const { title, topicCategory, resourceType, resourceLink, weekNumber, scope, targetStudentIds, instructions } = data;

  let studentsToAssign = [];

  if (scope === "global") {
    // Release to all students in the creator's batch or specified batch
    const mentorMember = await Member.findOne({ user: creatorId });
    const batchId = data.batchId || (mentorMember ? mentorMember.batch : null);

    const members = await Member.find({ batch: batchId }).populate({
      path: "user",
      match: { role: "student" },
    });

    studentsToAssign = members.filter((m) => m.user !== null).map((m) => m._id);
  } else {
    studentsToAssign = targetStudentIds;
  }

  const items = studentsToAssign.map((studentId) => ({
    student: studentId,
    title,
    topicCategory: topicCategory || "General",
    resourceType,
    resourceLink,
    weekNumber,
    scope,
    instructions,
    releasedBy: creatorId,
  }));

  return await Progress.insertMany(items);
};

// 2. Student Updates Status (STUDENT ONLY)
exports.updateStudentStatus = async (progressId, studentUserId, newStatus) => {
  const studentMember = await Member.findOne({ user: studentUserId });

  if (!studentMember) {
    const error = new Error("Student membership not found.");
    error.statusCode = 404;
    throw error;
  }

  const item = await Progress.findOne({ _id: progressId, student: studentMember._id });

  if (!item) {
    const error = new Error("Progress item not found or unauthorized.");
    error.statusCode = 404;
    throw error;
  }

  item.status = newStatus;
  await item.save();

  return item;
};

// 3. Helper to aggregate student progress statistics (Calculates %, Status, Topic Breakdown)
const calculateStudentStats = (progressItems) => {
  const total = progressItems.length;
  if (total === 0) {
    return {
      overallProgressPercentage: 0,
      completedItems: 0,
      totalItems: 0,
      healthStatus: "On Track",
      topicBreakdown: [],
    };
  }

  const completed = progressItems.filter((i) => i.status === "completed").length;
  const inProgress = progressItems.filter((i) => i.status === "in_progress").length;
  const needsHelp = progressItems.filter((i) => i.status === "needs_help").length;

  const percentage = Math.round((completed / total) * 100);

  // Health status determination logic based on percentage and 'needs_help' flag
  let healthStatus = "On Track";
  if (needsHelp > 0 || percentage < 50) {
    healthStatus = "Needs Attention";
  } else if (percentage === 100) {
    healthStatus = "Completed";
  }

  // Group by topicCategory for side-drawer breakdown
  const topicMap = {};
  progressItems.forEach((item) => {
    const cat = item.topicCategory || "General";
    if (!topicMap[cat]) topicMap[cat] = { total: 0, completed: 0 };
    topicMap[cat].total += 1;
    if (item.status === "completed") topicMap[cat].completed += 1;
  });

  const topicBreakdown = Object.keys(topicMap).map((cat) => ({
    topic: cat,
    percentage: Math.round((topicMap[cat].completed / topicMap[cat].total) * 100),
  }));

  return {
    overallProgressPercentage: percentage,
    completedItems: completed,
    totalItems: total,
    healthStatus,
    topicBreakdown,
  };
};

// 4. Get Admin / Mentor Dashboard List (Populates summary metrics & table)
exports.getProgressDashboard = async (filterQuery = {}) => {
  const { batchId, mentorId } = filterQuery;
  const memberFilter = {};

  if (batchId) memberFilter.batch = batchId;

  // Find all student members
  const students = await Member.find(memberFilter)
    .populate({
      path: "user",
      select: "fullName email avatar department year",
      match: { role: "student" },
    })
    .populate({
      path: "assignedMentor",
      populate: { path: "user", select: "fullName" },
    })
    .populate("batch", "name")
    .lean();

  const studentMembers = students.filter((s) => s.user !== null);

  // Map progress stats for each student row
  const dashboardRows = await Promise.all(
    studentMembers.map(async (student) => {
      const items = await Progress.find({ student: student._id }).lean();
      const stats = calculateStudentStats(items);

      return {
        memberId: student._id,
        studentName: student.user.fullName,
        email: student.user.email,
        batchName: student.batch ? student.batch.name : "N/A",
        mentorName: student.assignedMentor?.user?.fullName || "Unassigned",
        overallProgress: stats.overallProgressPercentage,
        completedRatio: `${stats.completedItems}/${stats.totalItems}`,
        status: stats.healthStatus,
      };
    })
  );

  return dashboardRows;
};

// 5. Get Single Student Progress Details (Figma Side Drawer View)
exports.getStudentDrawerDetails = async (studentMemberId) => {
  const student = await Member.findById(studentMemberId)
    .populate("user", "fullName email avatar department year")
    .populate({ path: "assignedMentor", populate: { path: "user", select: "fullName" } })
    .populate("batch", "name")
    .lean();

  if (!student) {
    const error = new Error("Student not found.");
    error.statusCode = 404;
    throw error;
  }

  const items = await Progress.find({ student: studentMemberId })
    .sort({ updatedAt: -1 })
    .lean();

  const stats = calculateStudentStats(items);

  // Recent Activity Feed
  const recentActivity = items.slice(0, 5).map((item) => ({
    title: item.title,
    status: item.status,
    topicCategory: item.topicCategory,
    updatedAt: item.updatedAt,
  }));

  return {
    studentInfo: {
      fullName: student.user.fullName,
      email: student.user.email,
      batch: student.batch?.name,
      mentorName: student.assignedMentor?.user?.fullName || "Unassigned",
    },
    overallProgress: stats.overallProgressPercentage,
    completedRatio: `${stats.completedItems}/${stats.totalItems}`,
    status: stats.healthStatus,
    topicBreakdown: stats.topicBreakdown,
    recentActivity,
    allProgressItems: items,
  };
};

// 6. Student Dashboard View (Imagined Student View)
exports.getStudentDashboard = async (studentUserId) => {
  const studentMember = await Member.findOne({ user: studentUserId });

  if (!studentMember) {
    const error = new Error("Student membership record not found.");
    error.statusCode = 404;
    throw error;
  }

  const items = await Progress.find({ student: studentMember._id })
    .sort({ weekNumber: 1, createdAt: -1 })
    .lean();

  const stats = calculateStudentStats(items);

  return {
    stats: {
      overallProgress: stats.overallProgressPercentage,
      completedItems: stats.completedItems,
      totalItems: stats.totalItems,
      status: stats.healthStatus,
    },
    topicBreakdown: stats.topicBreakdown,
    learningItems: items,
  };
};