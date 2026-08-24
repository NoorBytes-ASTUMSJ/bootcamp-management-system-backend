const Batch = require("../models/Batch.model");
const User = require("../models/User.model");

// Get dashboard summary stats directly from User and Batch models
exports.getBatchDashboardStats = async () => {
  const totalBatches = await Batch.countDocuments();
  const activeBatches = await Batch.countDocuments({ status: "ongoing" });

  const totalStudents = await User.countDocuments({ role: "student" });
  const totalMentors = await User.countDocuments({ role: "mentor" });

  return {
    totalBatches,
    activeBatches,
    totalStudents,
    totalMentors,
  };
};

// Create a new batch
exports.createBatch = async (adminId, batchData) => {
  return await Batch.create({
    ...batchData,
    createdBy: adminId,
  });
};

// Get all batches with dynamic student counts based on User.batch
exports.getAllBatches = async () => {
  const batches = await Batch.find()
    .populate("createdBy", "fullName email")
    .sort({ createdAt: -1 })
    .lean();

  const batchesWithCounts = await Promise.all(
    batches.map(async (batch) => {
      const studentCount = await User.countDocuments({
        batch: batch._id,
        role: "student",
      });
      return { ...batch, studentCount };
    })
  );

  return batchesWithCounts;
};

// Get single batch details by ID
exports.getBatchById = async (batchId) => {
  const batch = await Batch.findById(batchId)
    .populate("createdBy", "fullName email")
    .lean();

  if (!batch) {
    const error = new Error("Batch not found.");
    error.statusCode = 404;
    throw error;
  }

  const studentCount = await User.countDocuments({
    batch: batchId,
    role: "student",
  });

  const mentors = await User.find({
    batch: batchId,
    role: "mentor",
  })
    .select("fullName email role department year")
    .lean();

  return { ...batch, studentCount, mentors };
};

// Update batch
exports.updateBatch = async (batchId, updateData) => {
  delete updateData.createdBy;

  const updatedBatch = await Batch.findByIdAndUpdate(batchId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!updatedBatch) {
    const error = new Error("Batch not found.");
    error.statusCode = 404;
    throw error;
  }

  return updatedBatch;
};

// Delete batch - Unsets batch reference in User model
exports.deleteBatch = async (batchId) => {
  const batch = await Batch.findById(batchId);
  if (!batch) {
    const error = new Error("Batch not found.");
    error.statusCode = 404;
    throw error;
  }

  await User.updateMany({ batch: batchId }, { $unset: { batch: "" } });
  await Batch.findByIdAndDelete(batchId);

  return { message: "Batch deleted successfully." };
};