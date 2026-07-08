import express from "express";
import {
  getSmmTasks,
  createSmmTask,
  updateSmmTask,
  deleteSmmTask,
} from "../controllers/smmTaskController.js";

const router = express.Router();

router.route("/").get(getSmmTasks).post(createSmmTask);

router.route("/:id").put(updateSmmTask).delete(deleteSmmTask);

export default router;
