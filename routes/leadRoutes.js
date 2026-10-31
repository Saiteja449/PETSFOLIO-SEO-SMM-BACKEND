import express from "express";
import {
  createLead,
  getLeads,
  updateLead,
  deleteLead,
  getLeadAnalytics,
} from "../controllers/leadController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createLead);
router.get("/", getLeads);
router.put("/:id", updateLead);
router.delete("/:id", deleteLead);
router.get("/analytics", getLeadAnalytics);

export default router;

