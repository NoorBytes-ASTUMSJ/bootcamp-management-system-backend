const Announcement = require("../models/Announcement.model");
const Member = require("../models/Member.model");

// 1. Create Announcement (Admin or Mentor)
exports.createAnnouncement = async (creatorId, creatorRole, data) => {
  let batchId = data.batch;
  let targetMembers = data.targetMembers || [];

  // MENTOR LOGIC: Lock to mentor's assigned batch/mentees
  if (creatorRole === "mentor") {
    const mentorMember = await Member.findOne({ user: creatorId });

    if (!mentorMember || !mentorMember.batch) {
      const error = new Error("You are not currently assigned to an active batch.");
      error.statusCode = 400;
      throw error;
    }

    batchId = mentorMember.batch;

    if (data.targetAudience === "mentor_group") {
      const mentees = await Member.find({ assignedMentor: creatorId }).select("_id");
      targetMembers = mentees.map((m) => m._id);
    }
  }

  return await Announcement.create({
    ...data,
    batch: batchId,
    targetMembers,
    createdBy: creatorId,
  });
};

// 2. Fetch Announcements for Admin & Mentor Dashboard
exports.getAdminMentorAnnouncements = async (user, filters = {}) => {
  const query = {};

  if (user.role === "mentor") {
    query.createdBy = user._id;
  } else if (user.role === "admin") {
    if (filters.batchId) query.batch = filters.batchId;
    if (filters.audience) query.targetAudience = filters.audience;
  }

  if (filters.priority) query.priority = filters.priority;
  if (filters.status) query.status = filters.status;

  return await Announcement.find(query)
    .populate("createdBy", "fullName email role")
    .populate("batch", "name")
    .sort({ isPinned: -1, publishDate: -1 })
    .lean();
};

// 3. Fetch Feed for Logged-In User (Students / Public Users)
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

// 4. Update Announcement
exports.updateAnnouncement = async (id, userId, userRole, data) => {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw new Error("Announcement not found.");

  if (userRole !== "admin" && announcement.createdBy.toString() !== userId.toString()) {
    const error = new Error("Unauthorized to edit this announcement.");
    error.statusCode = 403;
    throw error;
  }

  Object.assign(announcement, data);
  return await announcement.save();
};

// 5. Delete Announcement
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