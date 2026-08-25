const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Assignment title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },

    description: {
      type: String,
      required: [true, "Assignment description is required"],
      trim: true,
    },

    instructions: {
      type: String,
      trim: true,
    },

    // Scope of release:
    // "global"          = created by Admin/Mentor for every student in a batch
    // "mentor_assigned" = created by a Mentor for a specific subset of their students
    scope: {
      type: String,
      enum: ["global", "mentor_assigned"],
      required: true,
    },

    // Required when scope === "global" — the whole batch is the audience.
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: function () {
        return this.scope === "global";
      },
    },

    // Required when scope === "mentor_assigned" — explicit list of targeted students.
    assignedMembers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Member",
      required: function () {
        return this.scope === "mentor_assigned";
      },
      validate: {
        validator: function (value) {
          return this.scope !== "mentor_assigned" || (value && value.length > 0);
        },
        message: "At least one student must be assigned for mentor_assigned scope",
      },
    },

    deadline: {
      type: Date,
      required: [true, "Assignment deadline is required"],
      validate: {
        validator: function (value) {
          return value > new Date();
        },
        message: "Deadline must be set to a future date and time",
      },
    },
    

    maxScore: {
      type: Number,
      required: [true, "Maximum score is required"],
      min: [1, "Max score must be at least 1 point"],
      default: 100,
    },

    // Optional template repo, boilerplate, or instructions attachment.
    fileUrl: {
      type: String,
      trim: true,
    },

    // The Admin or Mentor who released this assignment.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator reference is required"],
    },
  },
  { timestamps: true }
);

// Fast lookups for batch-wide and per-student dashboards.
assignmentSchema.index({ batch: 1, scope: 1, deadline: 1 });
assignmentSchema.index({ assignedMembers: 1, deadline: 1 });

module.exports = mongoose.model("Assignment", assignmentSchema);