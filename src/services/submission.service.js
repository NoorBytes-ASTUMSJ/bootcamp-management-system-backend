const Submission = require("../models/Submission.model");
const Assignment = require("../models/Assignment.model");
const Member = require("../models/Member.model");

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

  const globalAssignments = await Assignment.find()
    .select("title deadline maxScore batch")
    .populate("batch", "name")
    .lean();

  const globalAssignmentIds = globalAssignments.map((a) => a._id);

  const filter = {
    assignment: assignmentId ? assignmentId : { $in: globalAssignmentIds },
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
    assignment: assignmentId ? assignmentId : { $in: globalAssignmentIds },
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
    .populate("assignment", "title deadline maxScore")
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
  if (!student) {
    throw new Error("Student record not found.");
  }

  const studentMemberId = student._id;

  const assignmentQuery = {
    $or: [{ scope: "global" }, { batch: { $exists: false } }, { batch: null }],
  };

  if (student.batch) {
    assignmentQuery.$or.push({ batch: student.batch });
  }

  const applicableAssignments = await Assignment.find(assignmentQuery)
    .select("_id")
    .lean();
  const applicableAssignmentIds = applicableAssignments.map((a) =>
    a._id.toString(),
  );

  const existingSubmissions = await Submission.find({ member: studentMemberId })
    .select("assignment")
    .lean();
  const existingAssignmentIds = existingSubmissions.map((s) =>
    s.assignment?.toString(),
  );

  const missingAssignmentIds = applicableAssignmentIds.filter(
    (id) => !existingAssignmentIds.includes(id),
  );

  if (missingAssignmentIds.length > 0) {
    const newSubmissions = missingAssignmentIds.map((id) => ({
      assignment: id,
      member: studentMemberId,
      status: "not_started",
    }));

    try {
      await Submission.insertMany(newSubmissions);
    } catch (err) {}
  }

  const finalSubmissions = await Submission.find({
    member: studentMemberId,
    assignment: { $in: applicableAssignmentIds },
  })
    .populate({
      path: "assignment",
      select: "title description deadline maxScore fileUrl fileName batch",
      populate: { path: "batch", select: "name" },
    })
    .sort({ "assignment.deadline": 1 })
    .lean();

  return finalSubmissions.filter((sub) => sub.assignment);
};
