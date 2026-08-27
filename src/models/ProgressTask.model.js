const mongoose = require("mongoose");

const progressTaskSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: [true, "Batch reference is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    topicCategory: {
      type: String,
      required: [true, "Topic category is required"],
      trim: true,
      default: "General",
    },
    resourceType: {
      type: String,
      enum: ["video", "documentation", "other"],
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
  { timestamps: true }
);

module.exports = mongoose.model("ProgressTask", progressTaskSchema);