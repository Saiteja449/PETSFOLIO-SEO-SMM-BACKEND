import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TargetTemplate from './models/TargetTemplate.js';
import SeoActivityTemplate from './models/SeoActivityTemplate.js';
import ContentActivityTemplate from './models/ContentActivityTemplate.js';
import SalesActivityTemplate from './models/SalesActivityTemplate.js';
import CreativeActivityTemplate from './models/CreativeActivityTemplate.js';

dotenv.config();

const smmTemplatesToSeed = [
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

const seoTemplatesToSeed = [
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

const contentTemplatesToSeed = [
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

const salesTemplatesToSeed = [
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

const creativeTemplatesToSeed = [
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

async function seedFixedTemplates() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      console.error("MongoDB URI is not defined in the environment.");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected to MongoDB successfully.\n");

    // ==========================================
    // 1. SEED SMM TEMPLATES
    // ==========================================
    console.log("--- Seeding SMM Templates ---");
    let smmAddedCount = 0;
    let smmExistingCount = 0;

    for (const name of smmTemplatesToSeed) {
      const exists = await TargetTemplate.findOne({ name });
      
      if (!exists) {
        await TargetTemplate.create({
          name: name,
          description: "Standard SMM Fixed Target",
          metric: "PostCount",
          isFixed: true
        });
        console.log(`[ADDED SMM] ${name}`);
        smmAddedCount++;
      } else {
        if (!exists.isFixed) {
          exists.isFixed = true;
          await exists.save();
          console.log(`[UPDATED SMM] ${name} (marked as fixed)`);
          smmAddedCount++;
        } else {
          console.log(`[SKIPPED SMM] ${name} (already exists and fixed)`);
          smmExistingCount++;
        }
      }
    }

    // ==========================================
    // 2. SEED SEO TEMPLATES
    // ==========================================
    console.log("\n--- Seeding SEO Templates ---");
    let seoAddedCount = 0;
    let seoExistingCount = 0;

    for (const name of seoTemplatesToSeed) {
      const exists = await SeoActivityTemplate.findOne({ activityName: name });
      
      if (!exists) {
        await SeoActivityTemplate.create({
          activityName: name,
          category: "SEO",
          description: "Standard SEO Fixed Target",
          isFixed: true
        });
        console.log(`[ADDED SEO] ${name}`);
        seoAddedCount++;
      } else {
        if (!exists.isFixed) {
          exists.isFixed = true;
          await exists.save();
          console.log(`[UPDATED SEO] ${name} (marked as fixed)`);
          seoAddedCount++;
        } else {
          console.log(`[SKIPPED SEO] ${name} (already exists and fixed)`);
          seoExistingCount++;
        }
      }
    }

    // ==========================================
    // 3. SEED CONTENT CREATION TEMPLATES
    // ==========================================
    console.log("\n--- Seeding Content Creation Templates ---");
    let contentAddedCount = 0;
    let contentExistingCount = 0;

    for (const name of contentTemplatesToSeed) {
      const exists = await ContentActivityTemplate.findOne({ activityName: name });
      
      if (!exists) {
        await ContentActivityTemplate.create({
          activityName: name,
          category: "Content",
          description: "Standard Content Fixed Target",
          isFixed: true
        });
        console.log(`[ADDED CONTENT] ${name}`);
        contentAddedCount++;
      } else {
        if (!exists.isFixed) {
          exists.isFixed = true;
          await exists.save();
          console.log(`[UPDATED CONTENT] ${name} (marked as fixed)`);
          contentAddedCount++;
        } else {
          console.log(`[SKIPPED CONTENT] ${name} (already exists and fixed)`);
          contentExistingCount++;
        }
      }
    }

    // ==========================================
    // 4. SEED SALES TEMPLATES
    // ==========================================
    console.log("\n--- Seeding Sales Templates ---");
    let salesAddedCount = 0;
    let salesExistingCount = 0;

    for (const name of salesTemplatesToSeed) {
      const exists = await SalesActivityTemplate.findOne({ activityName: name });
      
      if (!exists) {
        await SalesActivityTemplate.create({
          activityName: name,
          category: "Sales",
          description: "Standard Sales Fixed Target",
          isFixed: true
        });
        console.log(`[ADDED SALES] ${name}`);
        salesAddedCount++;
      } else {
        if (!exists.isFixed) {
          exists.isFixed = true;
          await exists.save();
          console.log(`[UPDATED SALES] ${name} (marked as fixed)`);
          salesAddedCount++;
        } else {
          console.log(`[SKIPPED SALES] ${name} (already exists and fixed)`);
          salesExistingCount++;
        }
      }
    }

    // ==========================================
    // 5. SEED CREATIVE TEMPLATES
    // ==========================================
    console.log("\n--- Seeding Creative Templates ---");
    let creativeAddedCount = 0;
    let creativeExistingCount = 0;

    for (const name of creativeTemplatesToSeed) {
      const exists = await CreativeActivityTemplate.findOne({ activityName: name });
      
      if (!exists) {
        await CreativeActivityTemplate.create({
          activityName: name,
          category: "Creative",
          description: "Standard Creative Fixed Target",
          isFixed: true
        });
        console.log(`[ADDED CREATIVE] ${name}`);
        creativeAddedCount++;
      } else {
        if (!exists.isFixed) {
          exists.isFixed = true;
          await exists.save();
          console.log(`[UPDATED CREATIVE] ${name} (marked as fixed)`);
          creativeAddedCount++;
        } else {
          console.log(`[SKIPPED CREATIVE] ${name} (already exists and fixed)`);
          creativeExistingCount++;
        }
      }
    }

    console.log(`\nSeed completed!`);
    console.log(`SMM      -> Added/Updated: ${smmAddedCount}, Skipped: ${smmExistingCount}`);
    console.log(`SEO      -> Added/Updated: ${seoAddedCount}, Skipped: ${seoExistingCount}`);
    console.log(`CONTENT  -> Added/Updated: ${contentAddedCount}, Skipped: ${contentExistingCount}`);
    console.log(`SALES    -> Added/Updated: ${salesAddedCount}, Skipped: ${salesExistingCount}`);
    console.log(`CREATIVE -> Added/Updated: ${creativeAddedCount}, Skipped: ${creativeExistingCount}`);
    process.exit(0);
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }
}

seedFixedTemplates();
