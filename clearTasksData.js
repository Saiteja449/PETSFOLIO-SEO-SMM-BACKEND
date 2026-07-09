import dotenv from "dotenv";
import mongoose from "mongoose";
import SmmTask from "./models/SmmTask.js";
import TargetTemplate from "./models/TargetTemplate.js";
import EmployeeTarget from "./models/EmployeeTarget.js";
import SeoActivityTemplate from "./models/SeoActivityTemplate.js";
import SeoTask from "./models/SeoTask.js";

dotenv.config();

const clearData = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    console.log("Clearing tasks and templates data...");

    await SmmTask.deleteMany({});
    console.log("SmmTask collection cleared.");

    await SeoTask.deleteMany({});
    console.log("SeoTask collection cleared.");

    await TargetTemplate.deleteMany({});
    console.log("TargetTemplate collection cleared.");

    await EmployeeTarget.deleteMany({});
    console.log("EmployeeTarget collection cleared.");

    await SeoActivityTemplate.deleteMany({});
    console.log("SeoActivityTemplate collection cleared.");

    console.log("All tasks and templates data cleared successfully!");
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

clearData();
