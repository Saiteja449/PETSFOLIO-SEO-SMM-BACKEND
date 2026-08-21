import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskTemplate from './models/TaskTemplate.js';
import EmployeeTarget from './models/EmployeeTarget.js';

dotenv.config();

const smmTemplates = [
  "Graphic posts (all platform)",
  "Video Reels Post (Insta & FB)",
  "Video Shot Post (YTB)",
  "Long Video Post (YTB & FB)",
  "Stories Post (Insta, Fb & Whatsapp)",
  "Sp App Community post",
  "Client App Community post",
  "FB group joining",
  "FB group Sharing",
  "Lkdn group joinig",
  "Lkdn group sharing",
  "Influencer collab (Insta)",
  "Influencer collab (YTB)",
  "Post Comment Reply (All Platform)",
  "DM (Direct Message) ( All Platform)"
];

const seoTemplates = [
  "Guest Blog Sites Data",
  "Guest Blog Posting",
  "Internal Article Posting",
  "Article sharing",
  "Article submission",
  "Old Article Rewrite",
  "Classified submission",
  "Socialbook Marking",
  "Question and anwers",
  "Business Listings",
  "AEO Activities",
  "Report"
];

const contentTemplates = [
  "Internal Article",
  "External Article",
  "Post Content Script",
  "Reels Scripts",
  "Long Video Scripts",
  "UGC Script",
  "UGC Production",
  "Podcast Script",
  "Podcast Production",
  "SP Post Script"
];

const salesTemplates = [
  "Prospects Data Collection",
  "WhatsApp Marketing (Existing Clients - PF)",
  "WhatsApp Marketing (New Leads )",
  "WhatsApp group joining",
  "whatsapp Sending Posts to relavant Groups",
  "WhatsApp Marketing (Service Provider Data)",
  "WhatsApp Channel Post",
  "Telegram group joining",
  "Telegram content sharing",
  "Email Marketing"
];

const creativeTemplates = [
  "Image Post",
  "Carousel Post",
  "Short Video/Reel",
  "Long Video",
  "Infographic",
  "PDF / Guide",
  "PPT / Presentation",
  "UGC Editing",
  "Podcast Editing"
];

async function seedUnifiedTemplates() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      console.error("MongoDB URI is not defined in the environment.");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected to MongoDB successfully.\n");

    console.log("--- Clearing Old Data ---");
    const targetsResult = await EmployeeTarget.deleteMany({});
    console.log(`Deleted ${targetsResult.deletedCount} Employee Targets.`);

    const templatesResult = await TaskTemplate.deleteMany({});
    console.log(`Deleted ${templatesResult.deletedCount} Task Templates.\n`);

    const templatesToInsert = [];

    smmTemplates.forEach(name => templatesToInsert.push({ name, department: "SMM", isFixed: true, category: "SMM" }));
    seoTemplates.forEach(name => templatesToInsert.push({ name, department: "SEO", isFixed: true, category: "SEO" }));
    contentTemplates.forEach(name => templatesToInsert.push({ name, department: "Content", isFixed: true, category: "Content" }));
    salesTemplates.forEach(name => templatesToInsert.push({ name, department: "Sales", isFixed: true, category: "Sales" }));
    creativeTemplates.forEach(name => templatesToInsert.push({ name, department: "Creative", isFixed: true, category: "Creative" }));

    console.log("--- Inserting Unified Templates ---");
    const result = await TaskTemplate.insertMany(templatesToInsert);
    console.log(`Successfully seeded ${result.length} unified templates.`);

    console.log("\nFinished seeding successfully.");
    process.exit(0);

  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }
}

seedUnifiedTemplates();
