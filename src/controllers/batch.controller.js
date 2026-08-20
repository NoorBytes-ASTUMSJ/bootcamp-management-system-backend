const batchService = require("../services/batch.service");
const { successResponse } = require("../utils/apiResponse");

// GET /api/batches/stats
exports.getBatchDashboardStats = async (req, res, next) => {
  try {
    const stats = await batchService.getBatchDashboardStats();
    return successResponse(res, { stats }, "Batch statistics retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

// POST /api/batches
exports.createBatch = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const batch = await batchService.createBatch(adminId, req.body);
    return successResponse(res, { batch }, "Batch created successfully.", 201);
  } catch (error) {
    next(error);
  }
};

// GET /api/batches
exports.getAllBatches = async (req, res, next) => {
  try {
    const batches = await batchService.getAllBatches();
    return successResponse(res, { batches }, "Batches retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

// GET /api/batches/:batchId
exports.getBatchById = async (req, res, next) => {
  try {
    const batch = await batchService.getBatchById(req.params.batchId);
    return successResponse(res, { batch }, "Batch details retrieved successfully.", 200);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/batches/:batchId
exports.updateBatch = async (req, res, next) => {
  try {
    const batch = await batchService.updateBatch(req.params.batchId, req.body);
    return successResponse(res, { batch }, "Batch updated successfully.", 200);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/batches/:batchId
exports.deleteBatch = async (req, res, next) => {
  try {
    const result = await batchService.deleteBatch(req.params.batchId);
    return successResponse(res, result, result.message, 200);
  } catch (error) {
    next(error);
  }
};