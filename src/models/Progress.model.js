const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Student reference is required"],
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    // Category/Topic to group progress in the UI drawer (e.g., "React", "Node.js", "HTML/CSS")
    topicCategory: {
      type: String,
      required: [true, "Topic category is required"],
      trim: true,
      default: "General",
    },

    resourceType: {
      type: String,
      enum: ["video", "documentation", "article", "project", "other"],
      default: "documentation",
    },

    resourceLink: {
      type: String,
      trim: true,
      required: [true, "Resource link is required"],
    },

    weekNumber: {
      type: Number,
      min: [1, "Week number must be at least 1"],
    },

    scope: {
      type: String,
      enum: ["global", "mentor_assigned"],
      required: true,
    },

    // Updated ONLY by Student
    status: {
      type: String,
      enum: {
        values: ["not_started", "in_progress", "completed", "needs_help"],
        message:
          "Status must be: not_started, in_progress, completed, or needs_help",
      },
      default: "not_started",
      required: true,
    },

    // Mentor feedback or notes attached to student progress
    mentorNotes: [
      {
        note: String,
        createdAt: { type: Date, default: Date.now },
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    instructions: {
      type: String,
      trim: true,
      maxlength: [1000, "Instructions cannot exceed 1000 characters"],
    },

    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

progressSchema.index({ student: 1, status: 1 });
progressSchema.index({ student: 1, topicCategory: 1 });

module.exports = mongoose.model("Progress", progressSchema);
