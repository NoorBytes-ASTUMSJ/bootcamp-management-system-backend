const mongoose = require("mongoose");

const progressRecordSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProgressTask",
      required: [true, "Task reference is required"],
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Student reference is required"],
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: [true, "Batch reference is required"],
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "needs_help"],
      default: "not_started",
      required: true,
    },
    mentorNotes: [
      {
        note: String,
        createdAt: { type: Date, default: Date.now },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  { timestamps: true }
);

progressRecordSchema.index({ task: 1, student: 1 }, { unique: true });
progressRecordSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model("ProgressRecord", progressRecordSchema);