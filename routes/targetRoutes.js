import express from "express";
import {
  createTargetTemplate,
  getTargetTemplates,
  getGlobalTargetTemplates,
  deleteTargetTemplate,
  assignTarget,
  assignBatchTargets,
  getEmployeeTargets,
  getCompanyEmployeeTargets,
  getTrackedVideos,
  claimVideo,
  createSeoActivityTemplate,
  getSeoActivityTemplates,
  deleteSeoActivityTemplate,
  assignSeoBatchTargets,
} from "../controllers/targetController.js";

const router = express.Router();

router.post("/templates", createTargetTemplate);
router.get("/templates/global", getGlobalTargetTemplates);
router.get("/templates/:companyId", getTargetTemplates);
router.delete("/templates/:id", deleteTargetTemplate);

// SEO Templates
router.post("/seo-templates", createSeoActivityTemplate);
router.get("/seo-templates/global", getSeoActivityTemplates);
router.delete("/seo-templates/:id", deleteSeoActivityTemplate);
router.post("/seo-assign-batch", assignSeoBatchTargets);

router.post("/assign", assignTarget);
router.post("/assign-batch", assignBatchTargets);
router.get("/employee/:employeeId", getEmployeeTargets);
router.get("/company/:companyId/employees", getCompanyEmployeeTargets);
router.get("/videos/:companyId", getTrackedVideos);
router.put("/videos/:videoId/claim", claimVideo);

export default router;
