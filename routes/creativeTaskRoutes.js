import express from "express";
import {
  getCreativeTasks,
  createCreativeTask,
  updateCreativeTask,
  deleteCreativeTask,
} from "../controllers/creativeTaskController.js";

const router = express.Router();

router.route("/").get(getCreativeTasks).post(createCreativeTask);

router.route("/:id").put(updateCreativeTask).delete(deleteCreativeTask);

export default router;
