import express from "express";
import {
  getContentTasks,
  createContentTask,
  updateContentTask,
  deleteContentTask,
} from "../controllers/contentTaskController.js";

const router = express.Router();

router.route("/").get(getContentTasks).post(createContentTask);

router.route("/:id").put(updateContentTask).delete(deleteContentTask);

export default router;
