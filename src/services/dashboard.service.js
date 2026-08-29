const User = require("../models/User.model");
const Member = require("../models/Member.model");
const Batch = require("../models/Batch.model");
const Assignment = require("../models/Assignment.model");
const Submission = require("../models/Submission.model");
const Attendance = require("../models/Attendance.model");
const Announcement = require("../models/Announcement.model");

const formatActivityTime = (date) => {
  const d = new Date(date);
  const isToday = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return isToday
    ? `Today, ${time}`
    : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
};

async function getAdminOverviewData(adminUser) {
  const allUsers = await User.find().lean();
  const allMembers = await Member.find().lean();
  const allBatchesList = await Batch.find().sort({ createdAt: -1 }).lean();
  const allAssignments = await Assignment.find()
    .select("_id batch deadline maxScore")
    .lean();
  const allSubmissions = await Submission.find().populate("assignment").lean();

  const attendanceRecords = await Attendance.find({})
    .populate("recordedBy", "role")
    .lean();
  const adminAttendanceRecords = attendanceRecords.filter(
    (r) => r.recordedBy && String(r.recordedBy.role).toLowerCase() === "admin",
  );

  const totalStudents = allUsers.filter(
    (u) => String(u.role || "").toLowerCase() === "student",
  ).length;
  const totalMentors = allUsers.filter(
    (u) => String(u.role || "").toLowerCase() === "mentor",
  ).length;
  const totalBatches = allBatchesList.length;

  const availableBatches = allBatchesList.map((batch) => {
    const batchIdStr = batch._id.toString();

    let studentIds = new Set();
    let mentorIds = new Set();
    let batchStudentsMap = new Map();

    allUsers.forEach((u) => {
      const uBatch = u.batch || u.batchId;
      if (uBatch && uBatch.toString() === batchIdStr) {
        const role = String(u.role || "student").toLowerCase();
        if (role === "student") {
          studentIds.add(u._id.toString());
          const mDoc = allMembers.find(
            (m) => m.user && m.user.toString() === u._id.toString(),
          );
          batchStudentsMap.set(u._id.toString(), {
            userId: u._id.toString(),
            memberId: mDoc ? mDoc._id.toString() : null,
            name:
              u.fullName ||
              (u.firstName
                ? `${u.firstName} ${u.lastName || ""}`.trim()
                : null) ||
              u.name ||
              "Student",
          });
        }
        if (role === "mentor") mentorIds.add(u._id.toString());
      }
    });

    allMembers.forEach((m) => {
      const mBatch = m.batch || m.batchId;
      if (mBatch && mBatch.toString() === batchIdStr) {
        if (m.user) {
          const uId = m.user.toString();
          const uDoc = allUsers.find((u) => u._id.toString() === uId);
          const role = uDoc
            ? String(uDoc.role || "student").toLowerCase()
            : "student";

          if (role === "student") {
            studentIds.add(uId);
            if (!batchStudentsMap.has(uId)) {
              batchStudentsMap.set(uId, {
                userId: uId,
                memberId: m._id.toString(),
                name: uDoc
                  ? uDoc.fullName ||
                    (uDoc.firstName
                      ? `${uDoc.firstName} ${uDoc.lastName || ""}`.trim()
                      : null) ||
                    uDoc.name ||
                    "Student"
                  : "Student",
              });
            }
          }
          if (role === "mentor") mentorIds.add(uId);
        }
        if (m.assignedMentor) {
          mentorIds.add(m.assignedMentor.toString());
        }
      }
    });

    const batchStudents = Array.from(batchStudentsMap.values());

    const batchAssignments = allAssignments.filter((a) => {
      const b = a.batch || a.batchId;
      return b && b.toString() === batchIdStr;
    });
    const assignmentIds = batchAssignments.map((a) => a._id.toString());
    const assignmentMaxScores = {};
    batchAssignments.forEach((a) => {
      assignmentMaxScores[a._id.toString()] = a.maxScore || 100;
    });

    const activeAssignments = batchAssignments.filter(
      (a) => new Date(a.deadline) > new Date(),
    ).length;
    const pastDueAssignments = batchAssignments.filter(
      (a) => new Date(a.deadline) < new Date(),
    ).length;

    const batchSubmissions = allSubmissions.filter((s) => {
      const aId = (s.assignment?._id || s.assignment)?.toString();
      return aId && assignmentIds.includes(aId);
    });
    const pendingSubmissionsCount = batchSubmissions.filter(
      (s) => s.status === "submitted",
    ).length;

    const batchAttendance = adminAttendanceRecords.filter((r) => {
      const b = r.batch || r.batchId;
      return b && b.toString() === batchIdStr;
    });
    const totalAtt = batchAttendance.length || 1;

    const presentBatchCount = batchAttendance.filter(
      (r) => r.status === "present",
    ).length;
    const lateBatchCount = batchAttendance.filter(
      (r) => r.status === "late",
    ).length;
    const absentBatchCount = batchAttendance.filter(
      (r) => r.status === "absent",
    ).length;

    const presentPct = Math.round((presentBatchCount / totalAtt) * 100);
    const latePct = Math.round((lateBatchCount / totalAtt) * 100);
    const absentPct = Math.round((absentBatchCount / totalAtt) * 100);

    const batchAttendanceAvg =
      batchAttendance.length > 0
        ? Math.round(
            ((presentBatchCount + lateBatchCount) / batchAttendance.length) *
              100,
          )
        : 100;

    const batchAttendanceAll = attendanceRecords.filter((r) => {
      const b = r.batch || r.batchId;
      return b && b.toString() === batchIdStr;
    });

    const attendanceLeaderboard = batchStudents
      .map((student) => {
        const mAtt = batchAttendanceAll.filter((a) => {
          const aMem = a.member || a.memberId;
          const aUser = a.user || a.userId;
          return (
            (aMem &&
              student.memberId &&
              aMem.toString() === student.memberId) ||
            (aUser && student.userId && aUser.toString() === student.userId)
          );
        });

        let score = 0;
        let gradeable = 0;
        mAtt.forEach((a) => {
          if (a.status === "present") score += 1;
          else if (a.status === "late") score += 0.5;
          else if (a.status === "excused") score += 0.25;
          if (["present", "late", "absent", "excused"].includes(a.status))
            gradeable++;
        });
        const pct = gradeable > 0 ? Math.round((score / gradeable) * 100) : 100;
        return {
          id: student.userId || student.memberId,
          name: student.name,
          value: pct,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const gradesLeaderboard = batchStudents
      .map((student) => {
        const mSubs = batchSubmissions.filter((s) => {
          const sMem = s.member || s.memberId;
          const sUser = s.user || s.userId;
          const isMatch =
            (sMem &&
              student.memberId &&
              sMem.toString() === student.memberId) ||
            (sUser && student.userId && sUser.toString() === student.userId);
          return (
            isMatch &&
            ["graded", "reviewed"].includes(s.status) &&
            s.score != null
          );
        });

        const value =
          batchAssignments.length > 0
            ? Math.round(
                mSubs.reduce((sum, s) => {
                  const aId = (s.assignment?._id || s.assignment)?.toString();
                  const maxScore = assignmentMaxScores[aId] || 100;
                  return sum + (Number(s.score) / maxScore) * 100;
                }, 0) / batchAssignments.length,
              )
            : 0;

        return {
          id: student.userId || student.memberId,
          name: student.name,
          value,
          count: mSubs.length,
        };
      })
      .filter((x) => x.count > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    let progressStr = "Active";
    if (batch.startDate && batch.endDate) {
      const now = new Date();
      const start = new Date(batch.startDate);
      const end = new Date(batch.endDate);

      if (now < start) progressStr = "Starts Soon";
      else if (now > end) progressStr = "Completed";
      else
        progressStr = `${Math.ceil((end - now) / (1000 * 60 * 60 * 24))} Days Remaining`;
    } else if (batch.status) {
      progressStr =
        batch.status.charAt(0).toUpperCase() + batch.status.slice(1);
    }

    return {
      id: batchIdStr,
      name: batch.name,
      students: studentIds.size,
      mentors: mentorIds.size,
      attendanceAvg: `${batchAttendanceAvg}%`,
      progress: progressStr,
      attendanceBreakdown: {
        present: presentPct,
        late: latePct,
        absent: absentPct,
      },
      assignmentStats: {
        total: batchAssignments.length,
        active: activeAssignments,
        pendingReview: pendingSubmissionsCount,
        pastDue: pastDueAssignments,
      },
      leaderboard: {
        attendance: attendanceLeaderboard,
        grades: gradesLeaderboard,
      },
    };
  });

  const activeBatches = availableBatches.filter(
    (b) =>
      b.progress.includes("Remaining") ||
      b.progress === "Ongoing" ||
      b.progress === "Active",
  );
  let globalAttendanceRate = 100;

  if (activeBatches.length > 0) {
    const sum = activeBatches.reduce(
      (acc, curr) => acc + parseInt(curr.attendanceAvg),
      0,
    );
    globalAttendanceRate = Math.round(sum / activeBatches.length);
  } else if (availableBatches.length > 0) {
    const sum = availableBatches.reduce(
      (acc, curr) => acc + parseInt(curr.attendanceAvg),
      0,
    );
    globalAttendanceRate = Math.round(sum / availableBatches.length);
  }

  const recentAnnouncements = await Announcement.find()
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  const recentSubmissions = await Submission.find({ status: "submitted" })
    .populate({
      path: "member",
      populate: { path: "user", select: "fullName" },
    })
    .sort({ updatedAt: -1 })
    .limit(3)
    .lean();

  const rawActivities = [
    ...recentSubmissions.map((sub) => ({
      type: "submission",
      title: `Submission from ${sub.member?.user?.fullName || "Student"}`,
      subtitle: "Pending Review",
      time: formatActivityTime(sub.updatedAt || Date.now()),
      rawDate: new Date(sub.updatedAt || Date.now()),
    })),
    ...recentAnnouncements.map((ann) => ({
      type: "announcement",
      title: ann.title,
      subtitle: "New Announcement",
      time: formatActivityTime(ann.createdAt || Date.now()),
      rawDate: new Date(ann.createdAt || Date.now()),
    })),
  ];

  const recentActivities = rawActivities
    .sort((a, b) => b.rawDate - a.rawDate)
    .slice(0, 5)
    .map(({ rawDate, ...rest }) => rest);

  return {
    metrics: {
      students: totalStudents,
      mentors: totalMentors,
      batches: totalBatches,
      attendance: `${globalAttendanceRate}%`,
    },
    batches: availableBatches,
    recentActivities,
  };
}

async function getMentorOverviewData(userId) {
  const assignedStudents = await Member.find({ assignedMentor: userId })
    .populate("user", "fullName email")
    .lean();
  const studentIds = assignedStudents.map((s) => s._id);

  const pendingSubmissions = await Submission.find({
    member: { $in: studentIds },
    status: "submitted",
  })
    .populate("assignment", "title maxScore")
    .lean();

  return {
    assignedStudentsCount: assignedStudents.length,
    pendingGradingCount: pendingSubmissions.length,
    students: assignedStudents,
    pendingSubmissions,
  };
}

const COMPLETED_SUBMISSION_STATUSES = new Set(["submitted", "graded"]);

function statusToPercentage(sub, maxScore) {
  if (!sub) return 0;
  switch (sub.status) {
    case "graded":
      return typeof sub.score === "number"
        ? Math.round((sub.score / maxScore) * 100)
        : 100;
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

async function getStudentOverviewData(userId) {
  let member = await Member.findOne({ user: userId }).populate("batch").lean();

  if (!member) {
    const fallbackUser = await User.findById(userId).lean();
    return {
      student: {
        firstName:
          fallbackUser?.firstName || fallbackUser?.fullName || "Student",
      },
      overview: { attendance: 0, progress: 0, assignments: 0, averageGrade: 0 },
      progressSummary: [],
      announcements: await Announcement.find()
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
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
  const attendanceRecords = await Attendance.find({
    member: member._id,
  }).lean();
  const announcements = await Announcement.find()
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  const userDoc = await User.findById(userId).lean();

  const presentCount = attendanceRecords.filter(
    (r) => r.status === "present",
  ).length;
  const lateCount = attendanceRecords.filter((r) => r.status === "late").length;
  const attendancePct =
    attendanceRecords.length > 0
      ? Math.round(
          ((presentCount + lateCount * 0.5) / attendanceRecords.length) * 100,
        )
      : 0;

  const submissionByAssignmentId = new Map(
    submissions.map((s) => [String(s.assignment), s]),
  );
  const assignmentMaxScoreById = new Map(
    assignments.map((a) => [String(a._id), a.maxScore || 100]),
  );

  const pendingAssignments = assignments.filter((a) => {
    const sub = submissionByAssignmentId.get(String(a._id));
    return !sub || !COMPLETED_SUBMISSION_STATUSES.has(sub.status);
  });

  const progressPct =
    assignments.length > 0
      ? Math.round(
          ((assignments.length - pendingAssignments.length) /
            assignments.length) *
            100,
        )
      : 0;

  const gradedPercentages = submissions
    .filter((s) => s.status === "graded" && typeof s.score === "number")
    .map((s) => {
      const max = assignmentMaxScoreById.get(String(s.assignment)) || 100;
      return Math.round((s.score / max) * 100);
    });
  const averageGrade =
    gradedPercentages.length > 0
      ? Math.round(
          gradedPercentages.reduce((sum, v) => sum + v, 0) /
            gradedPercentages.length,
        )
      : 0;

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
    student: {
      firstName: userDoc?.firstName || userDoc?.fullName || "Student",
    },
    overview: {
      attendance: attendancePct,
      progress: progressPct,
      assignments: pendingAssignments.length,
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
