const ProgressTask = require("../models/ProgressTask.model");
const ProgressRecord = require("../models/ProgressRecord.model");
const Member = require("../models/Member.model");
const User = require("../models/User.model");

exports.createProgressItem = async (creatorId, creatorRole, data) => {
  const {
    title,
    topicCategory,
    resourceType,
    resourceLink,
    weekNumber,
    targetStudentIds,
    instructions,
    batch,
    batchId,
  } = data;

  const isMentorCreated = creatorRole === "mentor";
  const scope = isMentorCreated ? "mentor_assigned" : "global";

  let resolvedBatchId = batch || batchId;
  let studentsToAssign = [];

  if (isMentorCreated) {
    const mentorUser = await User.findById(creatorId).select("batch");
    resolvedBatchId = mentorUser?.batch || null;

    const members = await Member.find({ assignedMentor: creatorId });
    studentsToAssign = members.map((m) => m._id);

    if (studentsToAssign.length === 0) {
      const error = new Error(
        "You have no assigned students to create a task for."
      );
      error.statusCode = 400;
      throw error;
    }
  } else {
    if (!resolvedBatchId || resolvedBatchId === "ALL") {
      const error = new Error("Batch reference is required");
      error.statusCode = 400;
      throw error;
    }

    if (targetStudentIds && targetStudentIds.length > 0) {
      studentsToAssign = targetStudentIds;
    } else {
      const usersInBatch = await User.find({
        batch: resolvedBatchId,
        role: "student",
      }).select("_id");
      const userIds = usersInBatch.map((u) => u._id);
      const members = await Member.find({ user: { $in: userIds } });
      studentsToAssign = members.map((m) => m._id);
    }
  }

  const newTask = await ProgressTask.create({
    batch: resolvedBatchId,
    title,
    topicCategory: topicCategory || "General",
    resourceType,
    resourceLink,
    weekNumber,
    scope,
    instructions,
    releasedBy: creatorId,
  });

  const recordEntries = studentsToAssign.map((studentId) => ({
    task: newTask._id,
    student: studentId,
    batch: resolvedBatchId,
    status: "not_started",
  }));

  if (recordEntries.length > 0) {
    await ProgressRecord.insertMany(recordEntries);
  }

  return newTask;
};

// 2. Student Updates Status
exports.updateStudentStatus = async (taskId, studentUserId, newStatus) => {
  const studentMember = await Member.findOne({ user: studentUserId });

  if (!studentMember) {
    const error = new Error("Student membership not found.");
    error.statusCode = 404;
    throw error;
  }

  const record = await ProgressRecord.findOne({ task: taskId, student: studentMember._id });

  if (!record) {
    const error = new Error("Progress record not found or unauthorized.");
    error.statusCode = 404;
    throw error;
  }

  record.status = newStatus;
  await record.save();

  return record;
};

// 3. Helper to calculate student statistics from records
const calculateStudentStats = (progressRecords) => {
  const total = progressRecords.length;
  if (total === 0) {
    return {
      overallProgressPercentage: 0,
      completedItems: 0,
      totalItems: 0,
      healthStatus: "On Track",
      topicBreakdown: [],
    };
  }

  const completed = progressRecords.filter((i) => i.status === "completed").length;
  const needsHelp = progressRecords.filter((i) => i.status === "needs_help").length;
  const percentage = Math.round((completed / total) * 100);

  let healthStatus = "On Track";
  if (needsHelp > 0 || percentage < 50) {
    healthStatus = "Needs Attention";
  } else if (percentage === 100) {
    healthStatus = "Completed";
  }

  const topicMap = {};
  progressRecords.forEach((item) => {
    const taskDef = item.task || {};
    const cat = taskDef.topicCategory || "General";
    if (!topicMap[cat]) topicMap[cat] = { total: 0, completed: 0 };
    topicMap[cat].total += 1;
    if (item.status === "completed") topicMap[cat].completed += 1;
  });

  const topicBreakdown = Object.keys(topicMap).map((cat) => ({
    topic: cat,
    percentage: topicMap[cat].total > 0 ? Math.round((topicMap[cat].completed / topicMap[cat].total) * 100) : 0,
  }));

  return {
    overallProgressPercentage: percentage,
    completedItems: completed,
    totalItems: total,
    healthStatus,
    topicBreakdown,
  };
};

exports.getProgressDashboard = async (filterQuery = {}) => {
  const { batchId, mentorId, scope } = filterQuery;

  let userFilter = { role: "student" };
  if (batchId && batchId !== "ALL") {
    userFilter.batch = batchId;
  }

  const matchingUsers = await User.find(userFilter).select("_id");
  const userIds = matchingUsers.map((u) => u._id);

  const memberFilter = { user: { $in: userIds } };
  if (mentorId) memberFilter.assignedMentor = mentorId;

  const students = await Member.find(memberFilter)
    .populate({
      path: "user",
      select: "fullName email avatar department year batch gender university",
      match: { role: "student" },
      populate: { path: "batch", select: "name" },
    })
    .populate({
      path: "assignedMentor",
      select: "fullName email",
    })
    .lean();

  const studentMembers = students.filter((s) => s.user !== null);

  const dashboardRows = await Promise.all(
    studentMembers.map(async (student) => {
      const allRecords = await ProgressRecord.find({ student: student._id }).populate("task").lean();

      let records = allRecords.filter((r) => r.task);

      // Admin page: count only admin-released ("global") progress.
      if (scope) {
        records = records.filter((r) => r.task.scope === scope);
      }

      if (mentorId) {
        records = records.filter((r) => String(r.task.releasedBy) === String(mentorId));
      }

      const stats = calculateStudentStats(records);

      return {
        memberId: student._id,
        studentName: student.user.fullName,
        email: student.user.email,
        batchId: student.user.batch ? student.user.batch._id : null,
        batchName: student.user.batch ? student.user.batch.name : "N/A",
        mentorName: student.assignedMentor?.fullName || "Unassigned",
        overallProgress: stats.overallProgressPercentage,
        completedRatio: `${stats.completedItems}/${stats.totalItems}`,
        status: stats.healthStatus,
        gender: student.user.gender,
        university: student.user.university,
        track: student.user.department,
      };
    })
  );

  return dashboardRows;
};

exports.getStudentDashboard = async (userId) => {
  const callerMember = await Member.findOne({ user: userId }).populate({
    path: "user",
    select: "fullName email avatar department year batch gender university",
    populate: { path: "batch", select: "name" },
  });

  if (!callerMember) {
    const error = new Error("Student membership not found.");
    error.statusCode = 404;
    throw error;
  }

  const batch = callerMember.user?.batch;
  const myMentorId = callerMember.assignedMentor ? String(callerMember.assignedMentor) : null;

  if (!batch) {
    return {
      batchName: "N/A",
      selfMemberId: callerMember._id,
      students: [],
    };
  }

  const usersInBatch = await User.find({
    batch: batch._id,
    role: "student",
  }).select("_id fullName email");

  const userIds = usersInBatch.map((u) => u._id);

  const batchMembers = await Member.find({ user: { $in: userIds } })
    .populate({ path: "user", select: "fullName email" })
    .lean();

  const students = await Promise.all(
    batchMembers.map(async (member) => {
      const isSelf = String(member._id) === String(callerMember._id);

      const rawRecords = await ProgressRecord.find({ student: member._id })
        .populate({
          path: "task",
          populate: { path: "releasedBy", select: "fullName role" },
        })
        .lean();

      const validRecords = rawRecords.filter((r) => {
        if (!r.task) return false;
        if (r.task.scope === "global") return true;
        if (isSelf && myMentorId && String(r.task.releasedBy?._id) === myMentorId) {
          return true;
        }
        return false;
      });

      const progressMap = {};

      validRecords.forEach((r) => {
        const key = (r.task.topicCategory || "general").toLowerCase().trim();

        if (!progressMap[key]) {
          progressMap[key] = [];
        }

        progressMap[key].push({
          id: r.task._id,
          title: r.task.title,
          topic: r.task.topicCategory,
          status: r.status,
          resourceType: r.task.resourceType,
          resourceLink: r.task.resourceLink,
          week: r.task.weekNumber,
          instructions: r.task.instructions,
          releasedBy: r.task.releasedBy?.role || "admin",
          creatorName: r.task.releasedBy?.fullName || "Admin",
        });
      });
      const statsRecords = isSelf
        ? validRecords
        : validRecords.filter((r) => r.task.scope === "global");
      const stats = calculateStudentStats(statsRecords);

      const nameParts = (member.user?.fullName || "Student").split(" ");
      const initials =
        nameParts.length > 1
          ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
          : (member.user?.fullName?.[0] || "S").toUpperCase();

      return {
        id: member._id,
        isSelf,
        initials,
        name: member.user?.fullName || "Student",
        email: member.user?.email || "",
        overallProgress: stats.overallProgressPercentage,
        progressMap,
      };
    })
  );

  return {
    batchName: batch.name || "N/A",
    selfMemberId: callerMember._id,
    students,
  };
};

// 6. Delete Progress Task (Deletes the task definition and all student records tied to it)
exports.deleteProgressItem = async (taskId, userId, userRole) => {
  const task = await ProgressTask.findById(taskId);

  if (!task) {
    const error = new Error("Progress task not found.");
    error.statusCode = 404;
    throw error;
  }

  await ProgressRecord.deleteMany({ task: taskId });
  await task.deleteOne();

  return { message: "Progress task and associated student records deleted successfully" };
};

// 7. Update Progress Task
exports.updateProgressItem = async (taskId, userId, userRole, data) => {
  const task = await ProgressTask.findById(taskId);

  if (!task) {
    const error = new Error("Progress task not found.");
    error.statusCode = 404;
    throw error;
  }

  if (userRole === "mentor" && String(task.releasedBy) !== String(userId)) {
    const error = new Error("You can only edit progress tasks you released.");
    error.statusCode = 403;
    throw error;
  }

  const {
    title,
    topicCategory,
    resourceType,
    resourceLink,
    weekNumber,
    instructions,
  } = data;

  if (title !== undefined) task.title = title;
  if (topicCategory !== undefined) task.topicCategory = topicCategory;
  if (resourceType !== undefined) task.resourceType = resourceType;
  if (resourceLink !== undefined) task.resourceLink = resourceLink;
  if (weekNumber !== undefined) task.weekNumber = weekNumber;
  if (instructions !== undefined) task.instructions = instructions;

  await task.save();

  return task;
};