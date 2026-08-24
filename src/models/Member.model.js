const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    memberId: {
      type: String,
      required: true,
      unique: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedMentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["active", "graduated", "dropped", "suspended"],
      required: true,
      default: "active",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Member", memberSchema);