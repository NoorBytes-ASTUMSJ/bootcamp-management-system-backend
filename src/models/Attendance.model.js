const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Student member reference is required"],
    },

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: [true, "Batch reference is required"],
    },

    date: {
      type: Date,
      required: [true, "Attendance date is required"],
    },

    weekNumber: {
      type: Number,
      min: [1, "Week number must be at least 1"],
    },

    sessionNumber: {
      type: Number,
      min: [1, "Session number must be at least 1"],
    },

    sessionType: {
      type: String,
      enum: {
        values: [
          "lecture",
          "contest",
          "experience_sharing",
          "showcase",
          "other",
          "weekly_meeting",
          "question_answer",
          "contest_review",
          "assignment_presentation",
        ],
        message:
          "Session type must be: lecture, contest, experience_sharing, showcase, or other",
      },
      default: "lecture",
      required: true,
    },

    sessionTopic: {
      type: String,
      trim: true,
      required: [true, "Session topic is required"],
    },

    status: {
      type: String,
      enum: {
        values: ["present", "absent", "late", "excused"],
        message: "Status must be: present, absent, late, or excused",
      },
      required: [true, "Attendance status is required"],
    },

    checkInTime: {
      type: Date,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recorder reference is required"],
    },
  },
  { timestamps: true },
);

attendanceSchema.index(
  { member: 1, batch: 1, date: 1, sessionTopic: 1 },
  { unique: true },
);

attendanceSchema.index({ batch: 1, date: -1 });
attendanceSchema.index({ member: 1, date: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
