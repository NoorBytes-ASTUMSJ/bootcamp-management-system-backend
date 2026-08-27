const Announcement = require("../models/Announcement.model");
const Member = require("../models/Member.model");

function cleanFilterValue(value) {
  if (!value) return null;
  if (typeof value === "string" && value.trim().toUpperCase() === "ALL") return null;
  return value;
}

exports.createAnnouncement = async (creatorId, creatorRole, data) => {
  let batchId = data.batch;
  let targetMembers = data.targetMembers || [];

  if (creatorRole === "mentor") {
    // Find the mentor's own member record to check for a batch (optional fallback)
    const mentorMember = await Member.findOne({ user: creatorId });
    batchId = data.batch || mentorMember?.batch || null;

    // Automatically find all students assigned to this specific mentor
    const mentees = await Member.find({ assignedMentor: creatorId }).select("_id");
    targetMembers = mentees.map((m) => m._id);

    // Default target audience for mentor announcements to their student group
    if (!data.targetAudience) {
      data.targetAudience = "mentor_group";
    }
  } else {
    const needsBatchScope = ["student", "mentor", "admin", "member"].includes(data.targetAudience);
    if (!needsBatchScope || !batchId) {
      batchId = null;
    }
  }

  return await Announcement.create({
    ...data,
    batch: batchId,
    targetMembers,
    createdBy: creatorId,
  });
};

exports.getAdminMentorAnnouncements = async (user, filters = {}) => {
  const query = {};

  if (user.role === "mentor") {
    const mentorMember = await Member.findOne({ user: user._id });

    // Allow mentors to see their own announcements OR admin broadcasts targeted appropriately
    query.$or = [
      { createdBy: user._id },
      { targetAudience: "public" },
      { targetAudience: "mentor" },
      { targetAudience: "member" },
      { targetAudience: "mentor_group" },
      { targetAudience: "batch", batch: mentorMember?.batch }
    ];
  } else if (user.role === "admin") {
    const batchId = cleanFilterValue(filters.batchId);
    const audience = cleanFilterValue(filters.audience);

    if (batchId) query.batch = batchId;
    if (audience) query.targetAudience = audience;
  }

  // Status ("draft" / "published") is intentionally NOT defaulted to
  // "published" here — admins (and mentors, for their own posts) need to
  // see drafts on the management page. It only filters when a real,
  // specific status is passed (not the "ALL" sentinel).
  const status = cleanFilterValue(filters.status);
  if (status) query.status = status;

  if (filters.priority) query.priority = filters.priority;

  return await Announcement.find(query)
    .populate("createdBy", "fullName email role")
    .populate("batch", "name")
    .sort({ isPinned: -1, publishDate: -1 })
    .lean();
};

exports.getUserAnnouncements = async (userId, userRole) => {
  if (userRole === "public" || userRole === "user") {
    return await Announcement.find({ targetAudience: "public", status: "published" })
      .populate("createdBy", "fullName role")
      .sort({ isPinned: -1, publishDate: -1 })
      .lean();
  }

  const studentMember = await Member.findOne({ user: userId });

  const query = {
    status: "published",
    $or: [
      { targetAudience: "public" },
      { targetAudience: "student" },
      { targetAudience: "member" },
      { targetAudience: "batch", batch: studentMember?.batch },
      { targetAudience: "mentor_group", targetMembers: studentMember?._id },
    ],
  };

  return await Announcement.find(query)
    .populate("createdBy", "fullName role")
    .populate("batch", "name")
    .sort({ isPinned: -1, publishDate: -1 })
    .lean();
};

exports.updateAnnouncement = async (id, userId, userRole, data) => {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw new Error("Announcement not found.");

  if (userRole !== "admin" && announcement.createdBy.toString() !== userId.toString()) {
    const error = new Error("Unauthorized to edit this announcement.");
    error.statusCode = 403;
    throw error;
  }

  const needsBatchScope = data.targetAudience
    ? ["student", "mentor", "admin", "member", "mentor_group"].includes(data.targetAudience)
    : ["student", "mentor", "admin", "member", "mentor_group"].includes(announcement.targetAudience);

  if (!needsBatchScope || data.batch === "" || data.batch === undefined) {
    data.batch = null;
  }

  Object.assign(announcement, data);
  return await announcement.save();
};

exports.deleteAnnouncement = async (id, userId, userRole) => {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw new Error("Announcement not found.");

  if (userRole !== "admin" && announcement.createdBy.toString() !== userId.toString()) {
    const error = new Error("Unauthorized to delete this announcement.");
    error.statusCode = 403;
    throw error;
  }

  await Announcement.findByIdAndDelete(id);
  return { message: "Announcement deleted successfully." };
};