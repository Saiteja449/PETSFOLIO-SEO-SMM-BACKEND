import mongoose from 'mongoose';
import Task from './models/Task.js';
import dotenv from 'dotenv';

dotenv.config();

const clearTasks = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB for Deletion');
    
    // Delete all tasks from the database to start completely fresh
    const result = await Task.deleteMany({});
    
    console.log(`Successfully deleted ${result.deletedCount} tasks. The database is now completely clean.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

clearTasks();
