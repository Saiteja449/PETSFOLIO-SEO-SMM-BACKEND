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
  createSeoActivityTemplate,
  getSeoActivityTemplates,
  deleteSeoActivityTemplate,
  updateSeoActivityTemplate,
  assignSeoBatchTargets,
  createContentActivityTemplate,
  getContentActivityTemplates,
  deleteContentActivityTemplate,
  updateContentActivityTemplate,
  assignContentBatchTargets,
  createSalesActivityTemplate,
  getSalesActivityTemplates,
  deleteSalesActivityTemplate,
  updateSalesActivityTemplate,
  assignSalesBatchTargets,
  createCreativeActivityTemplate,
  getCreativeActivityTemplates,
  deleteCreativeActivityTemplate,
  updateCreativeActivityTemplate,
  assignCreativeBatchTargets,
} from "../controllers/targetController.js";

const router = express.Router();

router.post("/templates", createTargetTemplate);
router.get("/templates/global", getGlobalTargetTemplates);
router.get("/templates/:companyId", getTargetTemplates);
router.delete("/templates/:id", deleteTargetTemplate);
router.put("/templates/:id", updateTargetTemplate);

// SEO Templates
router.post("/seo-templates", createSeoActivityTemplate);
router.get("/seo-templates/global", getSeoActivityTemplates);
router.delete("/seo-templates/:id", deleteSeoActivityTemplate);
router.put("/seo-templates/:id", updateSeoActivityTemplate);
router.post("/seo-assign-batch", assignSeoBatchTargets);

// Content Templates
router.post("/content-templates", createContentActivityTemplate);
router.get("/content-templates/global", getContentActivityTemplates);
router.delete("/content-templates/:id", deleteContentActivityTemplate);
router.put("/content-templates/:id", updateContentActivityTemplate);
router.post("/content-assign-batch", assignContentBatchTargets);

// Sales Templates
router.post("/sales-templates", createSalesActivityTemplate);
router.get("/sales-templates/global", getSalesActivityTemplates);
router.delete("/sales-templates/:id", deleteSalesActivityTemplate);
router.put("/sales-templates/:id", updateSalesActivityTemplate);
router.post("/sales-assign-batch", assignSalesBatchTargets);

// Creative Templates
router.post("/creative-templates", createCreativeActivityTemplate);
router.get("/creative-templates/global", getCreativeActivityTemplates);
router.delete("/creative-templates/:id", deleteCreativeActivityTemplate);
router.put("/creative-templates/:id", updateCreativeActivityTemplate);
router.post("/creative-assign-batch", assignCreativeBatchTargets);

router.post("/assign", assignTarget);
router.post("/assign-batch", assignBatchTargets);
router.get("/employee/:employeeId", getEmployeeTargets);
router.get("/company/:companyId/employees", getCompanyEmployeeTargets);
router.get("/videos/:companyId", getTrackedVideos);
router.put("/videos/:videoId/claim", claimVideo);

export default router;
