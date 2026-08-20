const express = require("express");
const router = express.Router();
const batchController = require("../controllers/batch.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect);
router.use(authorize("admin"));

router.get("/stats", batchController.getBatchDashboardStats);
router.get("/", batchController.getAllBatches);
router.post("/", batchController.createBatch);
router.get("/:batchId", batchController.getBatchById);
router.patch("/:batchId", batchController.updateBatch);
router.delete("/:batchId", batchController.deleteBatch);

module.exports = router;
