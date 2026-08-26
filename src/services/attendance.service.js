const Attendance = require("../models/Attendance.model");
const Member = require("../models/Member.model");
const Batch = require("../models/Batch.model");

exports.markBulkAttendance = async ({
  records,
  batchId,
  sessionType,
  sessionTopic,
  weekNumber,
  sessionNumber,
  date,
  recordedBy,
}) => {
  if (!records || records.length === 0) {
    const error = new Error("No attendance records provided.");
    error.statusCode = 400;
    throw error;
  }

  const attendanceDate = new Date(date);

  const operations = records.map((item) => ({
    updateOne: {
      filter: {
        member: item.member,
        batch: batchId,
        date: attendanceDate,
        sessionTopic: sessionTopic,
      },
      update: {
        $set: {
          batch: batchId,
          sessionType: sessionType || "lecture",
          sessionTopic,
          weekNumber,
          sessionNumber,
          date: attendanceDate,
          status: item.status,
          notes: item.notes || "",
          recordedBy,
        },
      },
      upsert: true,
    },
  }));

  const result = await Attendance.bulkWrite(operations);
  return { message: "Attendance saved successfully.", result };
};

exports.getAttendanceByRole = async (user, filters = {}) => {
  let query = {};

  if (user.role === "mentor") {
    const mentorId = user.id || user._id;

    const assignedMembers = await Member.find({
      assignedMentor: mentorId,
    }).select("_id");

    query.member = { $in: assignedMembers.map((m) => m._id) };

    if (filters.batchId) {
      query.batch = filters.batchId;
    }
  }

  if (user.role === "admin") {
    if (filters.batchId) {
      query.batch = filters.batchId;
    } else {
      const activeBatch = await Batch.findOne({ isActive: true }).select("_id");
      if (activeBatch) {
        query.batch = activeBatch._id;
      }
    }

    query.sessionType = {
      $nin: [
        "weekly_meeting",
        "question_answer",
        "contest_review",
        "assignment_presentation",
      ],
    };
  }

  if (filters.date) query.date = new Date(filters.date);
  if (filters.sessionTopic) query.sessionTopic = filters.sessionTopic;

  const records = await Attendance.find(query)
    .populate({
      path: "member",
      populate: { path: "user", select: "fullName email avatar gender" },
    })
    .populate("batch", "name")
    .sort({ date: -1 });

  return records;
};

exports.getStudentAttendanceStats = async (studentUserId) => {
  const studentMember = await Member.findOne({ user: studentUserId });

  if (!studentMember) {
    const error = new Error("Student membership record not found.");
    error.statusCode = 404;
    throw error;
  }

  const records = await Attendance.find({ member: studentMember._id })
    .populate("recordedBy", "fullName role")
    .sort({ date: -1 })
    .lean();

  const totalSessions = records.length;

  if (totalSessions === 0) {
    return {
      percentage: 0,
      totalSessions: 0,
      stats: { present: 0, absent: 0, late: 0, excused: 0 },
      records: [],
    };
  }

  const stats = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0 },
  );

  const attended = stats.present + stats.late + stats.excused;
  const percentage = Number(((attended / totalSessions) * 100).toFixed(1));

  return {
    percentage,
    totalSessions,
    stats,
    records,
  };
};

exports.updateAttendance = async (attendanceId, updateData) => {
  const attendance = await Attendance.findByIdAndUpdate(
    attendanceId,
    updateData,
    { new: true, runValidators: true },
  );

  if (!attendance) {
    const error = new Error("Attendance record not found.");
    error.statusCode = 404;
    throw error;
  }

  return attendance;
};
