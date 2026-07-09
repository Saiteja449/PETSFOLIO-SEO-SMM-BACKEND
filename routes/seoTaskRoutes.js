import express from "express";
import {
  getSeoTasks,
  createSeoTask,
  updateSeoTask,
  deleteSeoTask,
} from "../controllers/seoTaskController.js";

const router = express.Router();

router.route("/").get(getSeoTasks).post(createSeoTask);

router.route("/:id").put(updateSeoTask).delete(deleteSeoTask);

export default router;
