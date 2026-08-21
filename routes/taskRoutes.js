import express from "express";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  splitTask,
  updateSubTask,
  reassignSubTask,
} from "../controllers/taskController.js";

const router = express.Router();

router.route("/").get(getTasks).post(createTask);
router.route("/:id").put(updateTask).delete(deleteTask);
router.route("/:id/split").post(splitTask);
router.route("/:id/subtasks/:subTaskId").put(updateSubTask);
router.route("/:id/reassign-subtask").post(reassignSubTask);

export default router;
