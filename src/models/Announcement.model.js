const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },

    content: {
      type: String,
      required: [true, "Content is required"],
      trim: true,
    },

    // Status matching Admin table (Draft vs Published)
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },

    targetAudience: {
      type: String,
      enum: ["public", "student", "mentor", "admin", "batch", "mentor_group"],
      required: true,
    },

    // Required when targetAudience === "batch"
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: function () {
        return this.targetAudience === "batch";
      },
    },

    // Optional list of specific student members for mentor_group scope
    targetMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
      },
    ],

    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      required: true,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },

    attachmentUrl: {
      type: String,
      trim: true,
    },

    publishDate: {
      type: Date,
      default: Date.now,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

announcementSchema.index({ targetAudience: 1, isPinned: -1, publishDate: -1 });
announcementSchema.index({ batch: 1, isPinned: -1, publishDate: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);