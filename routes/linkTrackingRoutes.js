import express from "express";
import {
  createTrackedLink,
  getTrackedLinks,
  deleteTrackedLink,
  redirectTrackedLink,
  getLinkAnalytics,
} from "../controllers/linkTrackingController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public redirect endpoint: GET /api/links/r/:code
router.get("/r/:code", redirectTrackedLink);

// Protected routes
router.use(protect);
router.post("/", createTrackedLink);
router.get("/", getTrackedLinks);
router.delete("/:id", deleteTrackedLink);
router.get("/analytics", getLinkAnalytics);

export default router;
