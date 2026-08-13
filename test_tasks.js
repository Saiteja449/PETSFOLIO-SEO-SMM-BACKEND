import mongoose from "mongoose";
import User from "./models/User.js";
import EmployeeTarget from "./models/EmployeeTarget.js";
import SmmTask from "./models/SmmTask.js";

const run = async () => {
  await mongoose.connect("mongodb://crmuser:PetsfolioCRM%402026@127.0.0.1:27017/seo?authSource=admin");
  
  const interns = await User.find({ role: "intern" });
  console.log("Found interns:", interns.length);
  
  for (const intern of interns) {
    console.log(`\nIntern: ${intern.name} (${intern._id})`);
    
    const targets = await EmployeeTarget.find({ employeeId: intern._id });
    console.log(`Targets assigned: ${targets.length}`);
    for (const t of targets) {
      console.log(`  Target: ${t.targetType} ${t.frequency} ${t.targetGoal} ${t.templateId}`);
    }
    
    const tasks = await SmmTask.find({ employeeId: intern._id.toString() });
    console.log(`SMM Tasks assigned: ${tasks.length}`);
    if (tasks.length > 0) {
      console.log(`  Example task: ${tasks[0].title} ${tasks[0].date} ${tasks[0].dueDate}`);
    }
  }
  
  mongoose.connection.close();
};

run().catch(console.error);
