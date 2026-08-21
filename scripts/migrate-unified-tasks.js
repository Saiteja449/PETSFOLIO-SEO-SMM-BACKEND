import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const migrateTasks = async (db) => {
  console.log('Migrating Tasks...');
  const collections = [
    { name: 'smmtasks', dept: 'SMM' },
    { name: 'seotasks', dept: 'SEO' },
    { name: 'contenttasks', dept: 'Content' },
    { name: 'salestasks', dept: 'Sales' },
    { name: 'creativetasks', dept: 'Creative' },
  ];

  let totalTasksMigrated = 0;

  for (const coll of collections) {
    const existingData = await db.collection(coll.name).find({}).toArray();
    if (existingData.length === 0) {
      console.log(`No tasks found in ${coll.name}`);
      continue;
    }

    const migratedData = existingData.map(doc => {
      // Add department
      doc.department = coll.dept;
      return doc;
    });

    // Insert into new 'tasks' collection
    await db.collection('tasks').insertMany(migratedData);
    totalTasksMigrated += migratedData.length;
    console.log(`Migrated ${migratedData.length} tasks from ${coll.name} -> tasks`);
  }
  
  console.log(`Successfully migrated ${totalTasksMigrated} tasks total.\n`);
};

const migrateTemplates = async (db) => {
  console.log('Migrating Templates...');
  const collections = [
    { name: 'targettemplates', dept: 'SMM' }, // TargetTemplate is for SMM
    { name: 'seoactivitytemplates', dept: 'SEO' },
    { name: 'contentactivitytemplates', dept: 'Content' },
    { name: 'salesactivitytemplates', dept: 'Sales' },
    { name: 'creativeactivitytemplates', dept: 'Creative' },
  ];

  let totalTemplatesMigrated = 0;

  for (const coll of collections) {
    const existingData = await db.collection(coll.name).find({}).toArray();
    if (existingData.length === 0) {
      console.log(`No templates found in ${coll.name}`);
      continue;
    }

    const migratedData = existingData.map(doc => {
      // Standardize activityName to name
      if (doc.activityName && !doc.name) {
        doc.name = doc.activityName;
        delete doc.activityName;
      }
      // Set department
      doc.department = coll.dept;
      return doc;
    });

    // Insert into new 'tasktemplates' collection
    await db.collection('tasktemplates').insertMany(migratedData);
    totalTemplatesMigrated += migratedData.length;
    console.log(`Migrated ${migratedData.length} templates from ${coll.name} -> tasktemplates`);
  }

  console.log(`Successfully migrated ${totalTemplatesMigrated} templates total.\n`);
};

const updateEmployeeTargets = async (db) => {
  console.log('Updating EmployeeTargets...');
  const targets = await db.collection('employeetargets').find({}).toArray();
  
  if (targets.length === 0) {
    console.log('No EmployeeTargets found.\n');
    return;
  }

  let updatedCount = 0;

  for (const target of targets) {
    let needsUpdate = false;
    
    // Map specific template IDs to the generic templateId
    if (target.seoTemplateId && !target.templateId) {
      target.templateId = target.seoTemplateId;
      needsUpdate = true;
    }
    if (target.contentTemplateId && !target.templateId) {
      target.templateId = target.contentTemplateId;
      needsUpdate = true;
    }
    if (target.salesTemplateId && !target.templateId) {
      target.templateId = target.salesTemplateId;
      needsUpdate = true;
    }
    if (target.creativeTemplateId && !target.templateId) {
      target.templateId = target.creativeTemplateId;
      needsUpdate = true;
    }

    // Clean up old fields
    delete target.seoTemplateId;
    delete target.contentTemplateId;
    delete target.salesTemplateId;
    delete target.creativeTemplateId;

    if (needsUpdate) {
      await db.collection('employeetargets').updateOne(
        { _id: target._id },
        { $set: { templateId: target.templateId }, $unset: { seoTemplateId: "", contentTemplateId: "", salesTemplateId: "", creativeTemplateId: "" } }
      );
      updatedCount++;
    } else {
        // Just clean up old fields just in case they exist alongside templateId
        await db.collection('employeetargets').updateOne(
            { _id: target._id },
            { $unset: { seoTemplateId: "", contentTemplateId: "", salesTemplateId: "", creativeTemplateId: "" } }
        );
    }
  }

  console.log(`Updated ${updatedCount} EmployeeTargets.\n`);
};

const runMigration = async () => {
  try {
    console.log(`Connecting to MongoDB...`);
    const conn = await mongoose.connect(process.env.MONGO_URI);
    const db = conn.connection.db;
    console.log(`Connected to Database: ${db.databaseName}\n`);

    // Ensure the new collections are empty before migrating to prevent duplicates
    await db.collection('tasks').deleteMany({});
    await db.collection('tasktemplates').deleteMany({});
    
    await migrateTasks(db);
    await migrateTemplates(db);
    await updateEmployeeTargets(db);

    console.log('MIGRATION COMPLETE! 🎉');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
