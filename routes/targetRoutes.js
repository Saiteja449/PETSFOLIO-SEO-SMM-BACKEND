import express from "express";
import {
  createTargetTemplate,
  getTargetTemplates,
  getGlobalTargetTemplates,
  deleteTargetTemplate,
  updateTargetTemplate,
  assignTarget,
  assignBatchTargets,
  getEmployeeTargets,
  getCompanyEmployeeTargets,
  getTrackedVideos,
  claimVideo,
  addDelegation,
  removeDelegation
} from "../controllers/targetController.js";

const router = express.Router();

router.post("/templates", createTargetTemplate);
router.get("/templates/global", getGlobalTargetTemplates);
router.get("/templates/:companyId", getTargetTemplates);
router.delete("/templates/:id", deleteTargetTemplate);
router.put("/templates/:id", updateTargetTemplate);

router.post("/assign", assignTarget);
router.post("/assign-batch", assignBatchTargets);
router.get("/employee/:employeeId", getEmployeeTargets);
router.get("/company/:companyId/employees", getCompanyEmployeeTargets);

// Automated Delegation Routes
router.post("/:id/delegate", addDelegation);
router.delete("/:id/delegate/:internId", removeDelegation);

// SMM specific video tracking
router.get("/videos/:companyId", getTrackedVideos);
router.put("/videos/:videoId/claim", claimVideo);

export default router;
