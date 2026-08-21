import mongoose from 'mongoose';
import Task from './models/Task.js';
import dotenv from 'dotenv';

dotenv.config();

const archive = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB for Archiving');
    
    const result = await Task.updateMany(
      {}, // Target all existing tasks currently in the DB
      { $set: { isArchived: true } }
    );
    
    console.log(`Successfully archived ${result.modifiedCount} old tasks. They will remain in DB but be hidden from UI.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

archive();
