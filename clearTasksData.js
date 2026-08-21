import dotenv from "dotenv";
import mongoose from "mongoose";
import Task from "./models/Task.js";
import TaskTemplate from "./models/TaskTemplate.js";
import EmployeeTarget from "./models/EmployeeTarget.js";

dotenv.config();

const clearData = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    console.log("Clearing all unified tasks, targets, and templates...");

    await Task.deleteMany({});
    console.log("Task collection cleared.");

    await TaskTemplate.deleteMany({});
    console.log("TaskTemplate collection cleared.");

    await EmployeeTarget.deleteMany({});
    console.log("EmployeeTarget collection cleared.");

    console.log("All tasks and templates data cleared successfully!");
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

clearData();
