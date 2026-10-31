import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { handleBiChat } from "../routes/biRoutes.js";

async function runBiTests() {
  console.log("==========================================");
  console.log("   GoalX BI Assistant Test Suite");
  console.log("==========================================\n");

  const testsFile = path.resolve("bi-tests.json");
  if (!fs.existsSync(testsFile)) {
    console.error("Error: bi-tests.json not found!");
    process.exit(1);
  }

  const tests = JSON.parse(fs.readFileSync(testsFile, "utf-8"));
  console.log(`Loaded ${tests.length} test cases from bi-tests.json\n`);

  // Try DB connection
  let dbConnected = false;
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
      dbConnected = true;
      console.log("Connected to MongoDB successfully.\n");
    }
  } catch (err) {
    console.warn("Notice: Local MongoDB not available (" + err.message + ").");
    console.warn("Tests requiring live database execution will be evaluated when connected.\n");
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const test of tests) {
    console.log(`------------------------------------------`);
    console.log(`Test #${test.id} [${test.category}]: "${test.question}"`);

    if (!dbConnected) {
      console.log(`[SKIP] MongoDB not connected.`);
      skipped++;
      continue;
    }

    try {
      const response = await handleBiChat({
        message: test.question,
        history: [],
        userId: new mongoose.Types.ObjectId(),
        isTest: true
      });

      const reply = response.reply || "";
      console.log(`Reply: ${reply.trim().substring(0, 160)}...`);

      let testPass = true;
      const val = test.validation || {};

      if (val.mustNotContain) {
        for (const badStr of val.mustNotContain) {
          if (reply.toLowerCase().includes(badStr.toLowerCase())) {
            console.log(`❌ FAIL: Reply contains forbidden string: "${badStr}"`);
            testPass = false;
          }
        }
      }

      if (val.mustContainOneOf) {
        const found = val.mustContainOneOf.some(s => reply.toLowerCase().includes(s.toLowerCase()));
        if (!found) {
          console.log(`❌ FAIL: Reply did not contain any expected keywords: ${JSON.stringify(val.mustContainOneOf)}`);
          testPass = false;
        }
      }

      if (testPass) {
        console.log(`✅ PASS`);
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n==========================================`);
  console.log(`Test Results Summary:`);
  console.log(`Total: ${tests.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
  console.log(`==========================================\n`);

  if (dbConnected) {
    await mongoose.disconnect();
  }
}

runBiTests().catch(console.error);

