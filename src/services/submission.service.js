const Submission = require("../models/Submission.model");
const Assignment = require("../models/Assignment.model");
const Member = require("../models/Member.model");
const User = require("../models/User.model");

exports.submitAssignment = async (submissionId, studentMemberId, data) => {
  const submission = await Submission.findOne({
    _id: submissionId,
    member: studentMemberId,
  }).populate("assignment");

  if (!submission) {
    const error = new Error("Submission record not found.");
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const isLate = now > new Date(submission.assignment.deadline);

  submission.githubUrl = data.githubUrl || submission.githubUrl;
  submission.liveDemoUrl = data.liveDemoUrl || submission.liveDemoUrl;
  submission.notes = data.notes || submission.notes;

  submission.status = "submitted";
  submission.submittedAt = now;
  submission.isLate = isLate;

  await submission.save();
  return submission;
};

exports.gradeSubmission = async (submissionId, mentorUserId, data) => {
  const submission = await Submission.findById(submissionId);

  if (!submission) {
    const error = new Error("Submission not found.");
    error.statusCode = 404;
    throw error;
  }

  submission.score = data.score;
  submission.feedback = data.feedback;
  submission.status = data.needsResubmission ? "needs_resubmission" : "graded";
  submission.gradedBy = mentorUserId;
  submission.gradedAt = new Date();

  await submission.save();
  return submission;
};

exports.getAdminSubmissions = async (query = {}) => {
  const { status, assignmentId } = query;

  const allAssignments = await Assignment.find()
    .select("title deadline maxScore batch scope createdBy")
    .populate("batch", "name")
    .lean();

  const globalAssignments = allAssignments.filter((a) => a.scope === "global");

  const globalAssignmentIds = globalAssignments.map((a) => a._id);

  const filter = {
    assignment:
      assignmentId && assignmentId !== "ALL"
        ? assignmentId
        : { $in: globalAssignmentIds },
    status: { $ne: "not_started" },
  };

  if (status && status !== "ALL") {
    filter.status = status;
  }

  const submissionsQuery = Submission.find(filter)
    .populate({
      path: "assignment",
      select: "title deadline maxScore batch",
      populate: { path: "batch", select: "name" },
    })
    .populate({
      path: "member",
      populate: { path: "user", select: "fullName email" },
    })
    .populate("gradedBy", "fullName")
    .sort({ submittedAt: -1 })
    .lean();

  const rawSubmissions = await submissionsQuery;

  const formattedSubmissions = rawSubmissions.map((sub) => {
    const student = sub.member?.user || {};
    const fullName = student.fullName || "Unknown Student";
    const initials = fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    let mappedStatus = "Pending Review";
    if (sub.status === "graded" || sub.status === "reviewed") {
      mappedStatus = "Reviewed";
    } else if (sub.status === "needs_resubmission") {
      mappedStatus = "Needs Resubmission";
    } else if (sub.isLate || sub.status === "late") {
      mappedStatus = "Late";
    }

    return {
      id: sub._id,
      studentName: fullName,
      studentInitials: initials,
      assignmentId: sub.assignment?._id,
      assignmentTitle: sub.assignment?.title || "Untitled Assignment",
      batchName: sub.assignment?.batch?.name || "Unassigned Batch",
      submittedDate: sub.submittedAt
        ? new Date(sub.submittedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Not Submitted",
      status: mappedStatus,
      rawStatus: sub.status,
      grade:
        sub.score !== undefined && sub.score !== null
          ? `${sub.score} / ${sub.assignment?.maxScore || 100}`
          : "Ungraded",
      isLate: sub.isLate || false,
      githubUrl: sub.githubUrl || "",
      demoUrl: sub.liveDemoUrl || "",
      feedback: sub.feedback || "",
    };
  });

  const baseMetricsFilter = {
    assignment:
      assignmentId && assignmentId !== "ALL"
        ? assignmentId
        : { $in: globalAssignmentIds },
    status: { $ne: "not_started" },
  };

  const totalSubmissions = await Submission.countDocuments(baseMetricsFilter);
  const pendingReview = await Submission.countDocuments({
    ...baseMetricsFilter,
    status: { $in: ["submitted", "pending", "Pending Review"] },
  });
  const reviewed = await Submission.countDocuments({
    ...baseMetricsFilter,
    status: { $in: ["graded", "reviewed", "Reviewed"] },
  });
  const lateSubmissions = await Submission.countDocuments({
    ...baseMetricsFilter,
    $or: [{ isLate: true }, { status: "late" }],
  });

  return {
    submissions: formattedSubmissions,
    globalAssignments,
    metrics: {
      totalSubmissions,
      pendingReview,
      reviewed,
      lateSubmissions,
    },
  };
};

exports.getMentorSubmissions = async (mentorUserId) => {
  const assignedStudents = await Member.find({
    assignedMentor: mentorUserId,
  }).select("_id");
  const studentMemberIds = assignedStudents.map((s) => s._id);

  const submissions = await Submission.find({
    member: { $in: studentMemberIds },
    status: { $ne: "not_started" },
  })
    .populate("assignment", "title deadline maxScore fileUrl fileName")
    .populate({
      path: "member",
      populate: { path: "user", select: "fullName email" },
    })
    .populate("gradedBy", "fullName")
    .sort({ submittedAt: -1 })
    .lean();

  return submissions;
};

exports.getSubmissionsByAssignment = async (assignmentId) => {
  return await Submission.find({
    assignment: assignmentId,
    status: { $ne: "not_started" },
  })
    .populate({
      path: "member",
      populate: { path: "user", select: "fullName email" },
    })
    .populate("gradedBy", "fullName")
    .lean();
};

exports.getStudentSubmissions = async (userId) => {
  const student = await Member.findOne({ user: userId });
  if (!student) throw new Error("Student record not found.");

  const allAssignments = await Assignment.find()
    .select(
      "title description deadline maxScore fileUrl fileName batch scope assignedMembers",
    )
    .populate("batch", "name")
    .lean();

  const applicableAssignments = allAssignments.filter((a) => {
    if (a.scope === "global" && !a.batch) return true;
    if (
      a.scope === "global" &&
      a.batch &&
      student.batch &&
      a.batch._id.toString() === student.batch.toString()
    )
      return true;

    if (a.assignedMembers && Array.isArray(a.assignedMembers)) {
      const isAssigned = a.assignedMembers.some(
        (id) => id.toString() === student._id.toString(),
      );
      if (isAssigned) return true;
    }
    return false;
  });

  const applicableAssignmentIds = applicableAssignments.map((a) =>
    a._id.toString(),
  );

  const existingSubmissions = await Submission.find({
    member: student._id,
  }).lean();
  const existingAssignmentIds = existingSubmissions.map((s) =>
    s.assignment?.toString(),
  );

  const missingAssignmentIds = applicableAssignmentIds.filter(
    (id) => !existingAssignmentIds.includes(id),
  );

  if (missingAssignmentIds.length > 0) {
    const newSubmissions = missingAssignmentIds.map((id) => ({
      assignment: id,
      member: student._id,
      status: "not_started",
    }));
    await Submission.insertMany(newSubmissions);
  }

  // FIX: Added 'scope' and nested populate for 'createdBy' so the frontend gets the mentor's name
  const finalSubmissions = await Submission.find({ member: student._id })
    .populate({
      path: "assignment",
      select:
        "title description deadline maxScore fileUrl fileName batch scope createdBy",
      populate: [
        { path: "batch", select: "name" },
        { path: "createdBy", select: "fullName role" },
      ],
    })
    .sort({ "assignment.deadline": 1 })
    .lean();

  return finalSubmissions.filter((sub) => sub.assignment);
};

exports.getBatchGradeStats = async ({ userId, role, batchId }) => {
  let resolvedBatchId = batchId;

  if (role === "student") {
    const studentMember = await Member.findOne({ user: userId }).populate({
      path: "user",
      select: "batch",
    });

    if (!studentMember) {
      const error = new Error("Student membership record not found.");
      error.statusCode = 404;
      throw error;
    }

    resolvedBatchId = studentMember.user?.batch;
  } else if (role === "mentor") {
    if (!batchId) {
      const error = new Error("batchId is required.");
      error.statusCode = 400;
      throw error;
    }

    const batchUserIds = await User.find({ batch: batchId }).distinct("_id");
    const hasAssignedStudentInBatch = await Member.exists({
      assignedMentor: userId,
      user: { $in: batchUserIds },
    });

    if (!hasAssignedStudentInBatch) {
      const error = new Error("You are not assigned to this batch.");
      error.statusCode = 403;
      throw error;
    }
  } else if (role === "admin") {
    if (!batchId) {
      const error = new Error("batchId is required.");
      error.statusCode = 400;
      throw error;
    }
  } else {
    const error = new Error("Not authorized to view batch grade statistics.");
    error.statusCode = 403;
    throw error;
  }

  if (!resolvedBatchId) {
    return [];
  }

  const totalAssignmentsCount = await Assignment.countDocuments({
    batch: resolvedBatchId,
  });

  const usersInBatch = await User.find({
    batch: resolvedBatchId,
    role: "student",
  }).select("_id");
  const userIds = usersInBatch.map((u) => u._id);

  const batchMembers = await Member.find({ user: { $in: userIds } }).select("_id");
  const memberIds = batchMembers.map((m) => m._id);

  const submissions = await Submission.find({
    member: { $in: memberIds },
    status: "graded",
    score: { $ne: null },
  })
    .populate("assignment", "maxScore")
    .lean();

  const grouped = {};

  submissions.forEach((sub) => {
    if (typeof sub.score !== "number") return;

    const memberId = String(sub.member);
    const maxScore = sub.assignment?.maxScore || 100;
    const pct = (sub.score / maxScore) * 100;

    if (!grouped[memberId]) {
      grouped[memberId] = { total: 0, count: 0 };
    }

    grouped[memberId].total += pct;
    grouped[memberId].count += 1;
  });

  return memberIds.map((memberId) => {
    const key = String(memberId);
    const stats = grouped[key];
    const totalPct = stats ? stats.total : 0;

    return {
      memberId: key,
      percentage:
        totalAssignmentsCount > 0
          ? Math.round(totalPct / totalAssignmentsCount)
          : 0,
      gradedCount: stats ? stats.count : 0,
      totalAssignments: totalAssignmentsCount,
    };
  });
};