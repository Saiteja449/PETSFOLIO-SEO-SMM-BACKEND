import express from "express";
import {
  getSalesTasks,
  createSalesTask,
  updateSalesTask,
  deleteSalesTask,
} from "../controllers/salesTaskController.js";

const router = express.Router();

router.route("/").get(getSalesTasks).post(createSalesTask);

router.route("/:id").put(updateSalesTask).delete(deleteSalesTask);

export default router;
