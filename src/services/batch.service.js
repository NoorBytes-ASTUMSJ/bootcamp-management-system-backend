const Batch = require("../models/Batch.model");
const User = require("../models/User.model");

// Get dashboard summary stats
exports.getBatchDashboardStats = async () => {
  const [totalBatches, activeBatches, totalStudents, totalMentors] =
    await Promise.all([
      Batch.countDocuments(),
      Batch.countDocuments({
        status: { $in: ["ongoing", "active", "Active", "upcoming"] },
      }),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "mentor" }),
    ]);

  return {
    totalBatches,
    activeBatches,
    totalStudents,
    totalMentors,
  };
};

// Create a new batch & automatically assign it to users without a batch
exports.createBatch = async (adminId, batchData) => {
  const batch = await Batch.create({
    ...batchData,
    createdBy: adminId,
  });

  // አዲሱ ባች ክፍት (ongoing ወይም upcoming) ከሆነ እስካሁን ባች ያልነበራቸውን ተጠቃሚዎች በሙሉ ይመድባል
  if (["ongoing", "upcoming", "active"].includes(batch.status)) {
    await User.updateMany(
      {
        $or: [{ batch: null }, { batch: { $exists: false } }],
      },
      {
        $set: { batch: batch._id },
      },
    );
  }

  return batch;
};

// Get all batches with dynamic member counts
exports.getAllBatches = async () => {
  const batches = await Batch.find()
    .populate("createdBy", "fullName email")
    .sort({ createdAt: -1 })
    .lean();

  const batchesWithCounts = await Promise.all(
    batches.map(async (batch) => {
      const [studentCount, mentorCount] = await Promise.all([
        User.countDocuments({
          batch: batch._id,
          role: "student",
        }),
        User.countDocuments({
          batch: batch._id,
          role: "mentor",
        }),
      ]);

      return {
        ...batch,
        studentCount,
        mentorCount,
      };
    }),
  );

  return batchesWithCounts;
};

// Get a single batch with its students and mentors
exports.getBatchById = async (batchId) => {
  const batch = await Batch.findById(batchId)
    .populate("createdBy", "fullName email")
    .lean();

  if (!batch) {
    const error = new Error("Batch not found.");
    error.statusCode = 404;
    throw error;
  }

  const [students, mentors] = await Promise.all([
    User.find({
      batch: batchId,
      role: "student",
    })
      .select(
        "fullName email phone gender university department year role createdAt",
      )
      .lean(),

    User.find({
      batch: batchId,
      role: "mentor",
    })
      .select(
        "fullName email phone gender university department year role createdAt",
      )
      .lean(),
  ]);

  return {
    ...batch,
    studentCount: students.length,
    mentorCount: mentors.length,
    students,
    mentors,
  };
};

// Update batch
exports.updateBatch = async (batchId, updateData) => {
  const safeUpdateData = { ...updateData };
  delete safeUpdateData.createdBy;

  const updatedBatch = await Batch.findByIdAndUpdate(batchId, safeUpdateData, {
    new: true,
    runValidators: true,
  }).populate("createdBy", "fullName email");

  if (!updatedBatch) {
    const error = new Error("Batch not found.");
    error.statusCode = 404;
    throw error;
  }

  // ባቹ ወደ active/ongoing ከተቀየረ ባች የሌላቸውን ተጠቃሚዎች አብሮ assign ያደርጋል
  if (["ongoing", "upcoming", "active"].includes(updatedBatch.status)) {
    await User.updateMany(
      {
        $or: [{ batch: null }, { batch: { $exists: false } }],
      },
      {
        $set: { batch: updatedBatch._id },
      },
    );
  }

  return updatedBatch;
};

// Delete batch
exports.deleteBatch = async (batchId) => {
  const batch = await Batch.findById(batchId);

  if (!batch) {
    const error = new Error("Batch not found.");
    error.statusCode = 404;
    throw error;
  }

  // Remove batch reference from all users assigned to this batch
  await User.updateMany({ batch: batchId }, { $unset: { batch: "" } });

  // Delete the batch
  await Batch.findByIdAndDelete(batchId);

  return {
    message: "Batch deleted successfully.",
  };
};
