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

  return {
    student: { firstName: userDoc?.firstName || userDoc?.fullName || "Student" },
    overview: {
      attendance: attendanceRecords.length > 0 
        ? Math.round((attendanceRecords.filter(r => r.status === "present").length / attendanceRecords.length) * 100) 
        : 0,
      progress: member.progress || 0,
      assignments: assignments.length,
      averageGrade: 0,
    },
    progressSummary: [],
    announcements,
    upcomingDeadlines: assignments.map(a => ({
      id: a._id,
      title: a.title,
      description: a.description || "No description provided",
      date: new Date(a.deadline).toLocaleDateString(),
      status: "In Progress",
    })),
    recentFeedback: submissions.filter(s => s.feedback).map(s => ({
      id: s._id,
      title: "Assignment Submission",
      score: s.score || 0,
      maxScore: 100,
      feedback: s.feedback,
      date: new Date(s.updatedAt || Date.now()).toLocaleDateString(),
    })),
    memberInfo: member,
    batch: member.batch,
  };
}
module.exports = {
  getAdminOverviewData,
  getMentorOverviewData,
  getStudentOverviewData,
};