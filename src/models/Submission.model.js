const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: [true, "Assignment reference is required"],
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Student member reference is required"],
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    liveDemoUrl: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: {
        values: [
          "not_started",
          "in_progress",
          "submitted",
          "graded",
          "needs_resubmission",
        ],
        message: "Invalid submission status",
      },
      default: "not_started",
      required: true,
    },
    submittedAt: {
      type: Date,
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    score: {
      type: Number,
      min: [0, "Score cannot be negative"],
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: [1000, "Mentor feedback cannot exceed 1000 characters"],
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    gradedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

submissionSchema.index({ assignment: 1, member: 1 }, { unique: true });
submissionSchema.index({ member: 1, status: 1 });
submissionSchema.index({ assignment: 1, status: 1 });

module.exports = mongoose.model("Submission", submissionSchema);
