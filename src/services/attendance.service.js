const Attendance = require("../models/Attendance.model");
const Member = require("../models/Member.model");
const Batch = require("../models/Batch.model");
const User = require("../models/User.model");

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
    // Default (unchanged): restrict to this mentor's own assigned students.
    // Pass scopeToAssigned=false to see every student in the batch instead
    // (used by the mentor's "Batch Members" page).
    const isScoped = filters.scopeToAssigned !== "false";

    if (isScoped) {
      const mentorId = user.id || user._id;

      const assignedMembers = await Member.find({
        assignedMentor: mentorId,
      }).select("_id");

      query.member = { $in: assignedMembers.map((m) => m._id) };
    }

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

    // Default (unchanged): exclude mentor-run session types from the admin
    // view. Pass includeAllSessionTypes=true to include every session type.
    const includeAllSessionTypes = filters.includeAllSessionTypes === "true";

    if (!includeAllSessionTypes) {
      query.sessionType = {
        $nin: [
          "weekly_meeting",
          "question_answer",
          "contest_review",
          "assignment_presentation",
        ],
      };
    }
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

// ==================================================
// ATTENDANCE SCORING (shared convention across all stats below)
// present = 1.0, late = 0.5, excused = 0.25, absent = 0
// All four statuses count toward the session denominator.
// A member/mentor with zero recorded sessions defaults to 100%.
// ==================================================

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
      percentage: 100,
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

  const score = stats.present * 1 + stats.late * 0.5 + stats.excused * 0.25;
  const percentage = Math.round((score / totalSessions) * 100);

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

exports.getBatchAttendanceStats = async (studentUserId) => {
  const studentMember = await Member.findOne({ user: studentUserId }).populate({
    path: "user",
    select: "batch",
  });

  if (!studentMember) {
    const error = new Error("Student membership record not found.");
    error.statusCode = 404;
    throw error;
  }

  const batchId = studentMember.user?.batch;
  if (!batchId) return [];

  // NOTE: this still only pulls role: "student" users into the batch
  // roster below, so mentors are not yet included in the returned list.
  // If you want mentors scored on this same endpoint (not just the same
  // formula), see the note under this function.
  const usersInBatch = await User.find({ batch: batchId, role: "student" }).select("_id");
  const userIds = usersInBatch.map((u) => u._id);

  const batchMembers = await Member.find({ user: { $in: userIds } }).select("_id");
  const memberIds = batchMembers.map((m) => m._id);

  const records = await Attendance.find({ member: { $in: memberIds } }).lean();

  const grouped = {};

  records.forEach((record) => {
    const memberId = String(record.member);

    if (!grouped[memberId]) {
      grouped[memberId] = { score: 0, validSessions: 0 };
    }

    if (record.status === "present") {
      grouped[memberId].score += 1;
      grouped[memberId].validSessions += 1;
    } else if (record.status === "late") {
      grouped[memberId].score += 0.5;
      grouped[memberId].validSessions += 1;
    } else if (record.status === "excused") {
      grouped[memberId].score += 0.25;
      grouped[memberId].validSessions += 1;
    } else if (record.status === "absent") {
      grouped[memberId].validSessions += 1;
    }
  });

  return memberIds.map((memberId) => {
    const key = String(memberId);
    const { score, validSessions } = grouped[key] || { score: 0, validSessions: 0 };

    return {
      memberId: key,
      percentage: validSessions === 0 ? 100 : Math.round((score / validSessions) * 100),
      totalSessions: validSessions,
    };
  });
};

// ==================================================
// MENTOR ATTENDANCE
// ==================================================
// Same scoring convention as above (present=1, late=0.5, excused=0.25,
// absent=0; zero sessions defaults to 100%). Scopes to Member records
// whose role is "mentor" rather than students in a batch.
// Wire this up to a route/controller if you want a "my mentor
// attendance" or "batch mentor attendance" endpoint — it isn't called
// from anywhere yet, since none of the existing endpoints touched
// mentors before this.

exports.getMentorAttendanceStats = async (mentorUserId) => {
  const mentorMember = await Member.findOne({ user: mentorUserId, role: "mentor" });

  if (!mentorMember) {
    const error = new Error("Mentor membership record not found.");
    error.statusCode = 404;
    throw error;
  }

  const records = await Attendance.find({ member: mentorMember._id })
    .populate("recordedBy", "fullName role")
    .sort({ date: -1 })
    .lean();

  const totalSessions = records.length;

  if (totalSessions === 0) {
    return {
      percentage: 100,
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

  const score = stats.present * 1 + stats.late * 0.5 + stats.excused * 0.25;
  const percentage = Math.round((score / totalSessions) * 100);

  return {
    percentage,
    totalSessions,
    stats,
    records,
  };
};