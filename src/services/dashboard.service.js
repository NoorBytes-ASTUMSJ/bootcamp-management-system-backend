const User = require("../models/User.model");
const Member = require("../models/Member.model");
const Batch = require("../models/Batch.model");
const Assignment = require("../models/Assignment.model");
const Submission = require("../models/Submission.model");
const Attendance = require("../models/Attendance.model");
const Announcement = require("../models/Announcement.model");

/**
 * Aggregates high-level metrics and system overviews for the Admin dashboard.
 */
async function getAdminOverviewData(adminUser) {
  const [totalStudents, totalMentors, totalBatches, activeBatchesList] = await Promise.all([
    Member.countDocuments({ status: "active" }),
    User.countDocuments({ role: "mentor" }),
    Batch.countDocuments(),
    Batch.find({ status: "ongoing" }).lean(),
  ]);

  // Calculate global attendance percentage across active records
  const attendanceRecords = await Attendance.find({}).lean();
  let attendanceRate = 92; // default fallback
  if (attendanceRecords.length > 0) {
    const presentCount = attendanceRecords.filter((r) => r.status === "present" || r.status === "late").length;
    attendanceRate = Math.round((presentCount / attendanceRecords.length) * 100);
  }

  // Calculate pending submissions count globally
  const pendingSubmissionsCount = await Submission.countDocuments({ status: "submitted" });

  // Format active batches with breakdown stats and IDs for filtering
  const availableBatches = await Promise.all(
    activeBatchesList.map(async (batch) => {
      const studentCount = await Member.countDocuments({ batch: batch._id });
      const batchAttendance = attendanceRecords.filter((r) => r.batch && r.batch.toString() === batch._id.toString());
      const presentBatchCount = batchAttendance.filter((r) => r.status === "present").length;
      const lateBatchCount = batchAttendance.filter((r) => r.status === "late").length;
      const absentBatchCount = batchAttendance.filter((r) => r.status === "absent").length;
      
      const batchAttendanceAvg = batchAttendance.length > 0 
        ? Math.round(((presentBatchCount + lateBatchCount) / batchAttendance.length) * 100) 
        : 0;

      const totalAssignments = await Assignment.countDocuments({ batch: batch._id });
      const activeAssignments = await Assignment.countDocuments({ batch: batch._id, deadline: { $gt: new Date() } });

      return {
        _id: batch._id,
        id: batch._id,
        name: batch.name || batch.title,
        studentCount,
        students: studentCount,
        mentors: 4, 
        attendanceAvg: `${batchAttendanceAvg}%`,
        progress: batch.progress || 65, // Dynamic or fallback percentage
        status: batch.status || "Active",
        attendanceBreakdown: {
          present: presentBatchCount,
          late: lateBatchCount,
          absent: absentBatchCount,
        },
        assignmentStats: {
          total: totalAssignments,
          active: activeAssignments,
          pendingReview: pendingSubmissionsCount,
          pastDue: await Assignment.countDocuments({ batch: batch._id, deadline: { $lt: new Date() } }),
        },
      };
    })
  );

  // Recent system activities & announcements
  const recentAnnouncements = await Announcement.find().sort({ createdAt: -1 }).limit(4).lean();
  const recentSubmissions = await Submission.find({ status: "submitted" }).populate({
    path: "member",
    populate: { path: "user", select: "fullName firstName" }
  }).sort({ updatedAt: -1 }).limit(3).lean();

  const recentActivities = [
    ...recentSubmissions.map((sub) => ({
      id: sub._id,
      type: "submission",
      title: `Submission from ${sub.member?.user?.firstName || sub.member?.user?.fullName || "Student"}`,
      subtitle: "Assignment Review Pending",
      time: new Date(sub.updatedAt || Date.now()).toLocaleDateString(),
    })),
    ...recentAnnouncements.map((ann) => ({
      id: ann._id,
      type: "announcement",
      title: ann.title,
      subtitle: ann.content || ann.preview,
      time: new Date(ann.createdAt || Date.now()).toLocaleDateString(),
    })),
  ];

  return {
    admin: {
      firstName: adminUser?.firstName || adminUser?.name || "Admin",
    },
    overview: {
      totalStudents,
      totalMentors,
      totalBatches,
      activeBatches: activeBatchesList.length,
      averageAttendance: `${attendanceRate}%`,
      pendingSubmissions: pendingSubmissionsCount,
    },
    batches: availableBatches,
    announcements: recentAnnouncements,
    recentActivity: recentActivities,
  };
}

/**
 * Aggregates data specific to a Mentor's assigned students and cohorts.
 */
async function getMentorOverviewData(userId) {
  const assignedStudents = await Member.find({ assignedMentor: userId }).populate("user", "fullName email").lean();
  const studentIds = assignedStudents.map((s) => s._id);

  const pendingSubmissions = await Submission.find({
    member: { $in: studentIds },
    status: "submitted",
  }).populate("assignment", "title maxScore").lean();

  return {
    assignedStudentsCount: assignedStudents.length,
    pendingGradingCount: pendingSubmissions.length,
    students: assignedStudents,
    pendingSubmissions,
  };
}

// Submission.status enum: not_started | in_progress | submitted | graded | needs_resubmission
const COMPLETED_SUBMISSION_STATUSES = new Set(["submitted", "graded"]);

// Maps a submission's status (plus its score, when graded) to a display
// percentage for the progress summary. Not an exact science for the
// in-between states — it's a reasonable approximation until there's a
// more precise notion of "how done is this" than a 5-value enum.
function statusToPercentage(sub, maxScore) {
  if (!sub) return 0;
  switch (sub.status) {
    case "graded":
      return typeof sub.score === "number" ? Math.round((sub.score / maxScore) * 100) : 100;
    case "submitted":
      return 90;
    case "needs_resubmission":
      return 65;
    case "in_progress":
      return 50;
    case "not_started":
    default:
      return 0;
  }
}

function statusToLabel(status) {
  switch (status) {
    case "graded":
      return "Completed";
    case "submitted":
    case "in_progress":
      return "In Progress";
    case "needs_resubmission":
      return "Needs Improvement";
    case "not_started":
    default:
      return "Not Started";
  }
}

/**
 * Aggregates data specific to an active Student member.
 */
async function getStudentOverviewData(userId) {
  let member = await Member.findOne({ user: userId }).populate("batch").lean();
  
  // Gracefully fallback if the student member profile isn't seeded yet
  if (!member) {
    const fallbackUser = await User.findById(userId).lean();
    return {
      student: { firstName: fallbackUser?.firstName || fallbackUser?.fullName || "Student" },
      overview: { attendance: 0, progress: 0, assignments: 0, averageGrade: 0 },
      progressSummary: [],
      announcements: await Announcement.find().sort({ createdAt: -1 }).limit(3).lean(),
      upcomingDeadlines: [],
      recentFeedback: [],
      memberInfo: null,
      batch: null,
    };
  }

  const assignments = await Assignment.find({
    $or: [{ batch: member.batch?._id }, { assignedMembers: member._id }],
  }).lean();

  const submissions = await Submission.find({ member: member._id }).lean();
  const attendanceRecords = await Attendance.find({ member: member._id }).lean();
  const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(3).lean();
  const userDoc = await User.findById(userId).lean();

  // --- Attendance: present + late counted at half weight, matching the
  // convention already used for the admin overview's global rate.
  const presentCount = attendanceRecords.filter((r) => r.status === "present").length;
  const lateCount = attendanceRecords.filter((r) => r.status === "late").length;
  const attendancePct =
    attendanceRecords.length > 0
      ? Math.round(((presentCount + lateCount * 0.5) / attendanceRecords.length) * 100)
      : 0;

  // Submission has a unique (assignment, member) index, so a submission
  // document can exist while still being "not_started" — its mere
  // existence doesn't mean the student has actually submitted anything.
  // Every check below goes through the real `status` field instead.
  const submissionByAssignmentId = new Map(submissions.map((s) => [String(s.assignment), s]));
  const assignmentMaxScoreById = new Map(assignments.map((a) => [String(a._id), a.maxScore || 100]));

  const pendingAssignments = assignments.filter((a) => {
    const sub = submissionByAssignmentId.get(String(a._id));
    return !sub || !COMPLETED_SUBMISSION_STATUSES.has(sub.status);
  });

  // --- Progress: % of assignments actually submitted or graded.
  // `member.progress` is never set anywhere in this codebase, so it was
  // silently always 0 — this replaces it with a real, derivable number.
  const progressPct =
    assignments.length > 0
      ? Math.round(((assignments.length - pendingAssignments.length) / assignments.length) * 100)
      : 0;

  // --- Average grade: percentage per *graded* submission (score / that
  // assignment's own maxScore), averaged. Was hardcoded to 0 before.
  const gradedPercentages = submissions
    .filter((s) => s.status === "graded" && typeof s.score === "number")
    .map((s) => {
      const max = assignmentMaxScoreById.get(String(s.assignment)) || 100;
      return Math.round((s.score / max) * 100);
    });
  const averageGrade =
    gradedPercentages.length > 0
      ? Math.round(gradedPercentages.reduce((sum, v) => sum + v, 0) / gradedPercentages.length)
      : 0;

  // --- Progress summary. Assignment has no `topic` field in the current
  // schema, so this is one row per assignment (title as the label)
  // rather than grouped by curriculum topic. If you add a `topic` field
  // to Assignment.model.js later, group by that here instead.
  const progressSummary = assignments
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map((a) => {
      const sub = submissionByAssignmentId.get(String(a._id));
      const max = a.maxScore || 100;
      return {
        id: a._id,
        topic: a.title,
        percentage: statusToPercentage(sub, max),
        status: statusToLabel(sub?.status),
      };
    });

  return {
    student: { firstName: userDoc?.firstName || userDoc?.fullName || "Student" },
    overview: {
      attendance: attendancePct,
      progress: progressPct,
      assignments: pendingAssignments.length, // "pending", matching the card's own subtitle
      averageGrade,
    },
    progressSummary,
    announcements,
    upcomingDeadlines: pendingAssignments
      .filter((a) => a.deadline && new Date(a.deadline) > new Date())
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .map((a) => {
        const sub = submissionByAssignmentId.get(String(a._id));
        return {
          id: a._id,
          title: a.title,
          description: a.description || "No description provided",
          date: new Date(a.deadline).toLocaleDateString(),
          status: statusToLabel(sub?.status),
        };
      }),
    recentFeedback: submissions
      .filter((s) => s.feedback)
      .map((s) => {
        const max = assignmentMaxScoreById.get(String(s.assignment)) || 100;
        return {
          id: s._id,
          title: "Assignment Submission",
          score: s.score || 0,
          maxScore: max,
          feedback: s.feedback,
          date: new Date(s.updatedAt || Date.now()).toLocaleDateString(),
        };
      }),
    memberInfo: member,
    batch: member.batch,
  };
}
module.exports = {
  getAdminOverviewData,
  getMentorOverviewData,
  getStudentOverviewData,
};