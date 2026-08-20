const Batch = require("../models/Batch.model");
const Member = require("../models/Member.model");
const User = require("../models/User.model");

// Get dashboard summary stats
exports.getBatchDashboardStats = async () => {
  const totalBatches = await Batch.countDocuments();
  const activeBatches = await Batch.countDocuments({ status: "ongoing" });
  
  // Count directly by user roles
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

// Get all batches with dynamic student counts
exports.getAllBatches = async () => {
  const batches = await Batch.find()
    .populate("createdBy", "fullName email")
    .sort({ createdAt: -1 })
    .lean();

  const batchesWithCounts = await Promise.all(
    batches.map(async (batch) => {
      const studentCount = await Member.countDocuments({ batch: batch._id });
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

  const studentCount = await Member.countDocuments({ batch: batchId });

  const membersInBatch = await Member.find({ batch: batchId })
    .populate({
      path: "user",
      select: "fullName email avatar role",
      match: { role: "mentor" },
    })
    .lean();

  const mentors = membersInBatch
    .filter((m) => m.user !== null)
    .map((m) => m.user);

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

// Delete batch
exports.deleteBatch = async (batchId) => {
  const batch = await Batch.findById(batchId);
  if (!batch) {
    const error = new Error("Batch not found.");
    error.statusCode = 404;
    throw error;
  }

  await Member.updateMany({ batch: batchId }, { $unset: { batch: "" } });
  await Batch.findByIdAndDelete(batchId);

  return { message: "Batch deleted successfully." };
};