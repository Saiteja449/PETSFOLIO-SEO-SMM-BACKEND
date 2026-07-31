import mongoose from "mongoose";
import ContentActivityTemplate from "./models/ContentActivityTemplate.js";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const template = await ContentActivityTemplate.create({
    activityName: "Test Fixed Template",
    category: "Content",
    description: "Testing isFixed",
    isFixed: true
  });
  
  console.log("Created Template:", template);
  
  // also test fetch
  const fetched = await ContentActivityTemplate.find({ activityName: "Test Fixed Template" });
  console.log("Fetched:", fetched);
  
  await ContentActivityTemplate.deleteOne({ _id: template._id });
  
  mongoose.disconnect();
}

test();
