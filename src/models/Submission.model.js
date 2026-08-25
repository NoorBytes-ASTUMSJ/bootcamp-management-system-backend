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

    // --- STUDENT WORK & SUBMISSION LINKS ---
    githubUrl: {
      type: String,
      trim: true,
      // Not required at document creation — a record exists from "not_started".
      // Enforce presence in the controller when status transitions to "submitted".
    },

    liveDemoUrl: {
      type: String,
      trim: true,
    },

    fileUrl: {
      type: String,
      trim: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },

    // --- WORKFLOW STATUS ---
    // Set by student: "not_started" -> "in_progress" -> "submitted"
    // Set by mentor:  "graded" | "needs_resubmission"
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

    // --- MENTOR GRADING & REVIEW ---
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
      ref: "User", // mentor who reviewed the assignment
    },

    gradedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// One submission record per student per assignment — created up front
// (status "not_started") when the assignment is released, then updated
// through the workflow rather than re-created.
submissionSchema.index({ assignment: 1, member: 1 }, { unique: true });

// Fast dashboard/grading queue lookups.
submissionSchema.index({ member: 1, status: 1 });
submissionSchema.index({ assignment: 1, status: 1 });

module.exports = mongoose.model("Submission", submissionSchema);