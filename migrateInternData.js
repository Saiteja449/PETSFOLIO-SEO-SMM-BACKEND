import mongoose from 'mongoose';
import User from './models/User.js';
import EmployeeTarget from './models/EmployeeTarget.js';
import Task from './models/Task.js';
import dotenv from 'dotenv';

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const interns = await User.find({ role: 'intern' });
    const internIds = interns.map(i => i._id.toString());
    
    console.log(`Found ${interns.length} interns.`);

    // Flag targets
    const targetResult = await EmployeeTarget.updateMany(
      { employeeId: { $in: internIds } },
      { $set: { isLegacyInternData: true, status: 'Completed' } }
    );
    console.log(`Updated ${targetResult.modifiedCount} EmployeeTargets.`);

    // Flag tasks in the unified Task collection
    let totalModified = 0;
    for (const intern of interns) {
      const internId = intern._id.toString();
      const parentId = intern.createdBy ? intern.createdBy.toString() : null;
      
      const result = await Task.updateMany(
        { 
          $or: [
            { employeeId: internId },
            { assignedTo: internId }
          ] 
        },
        { 
          $set: { 
            isLegacyInternData: true,
            originalOwnerId: internId,
            parentEmployeeId: parentId
          } 
        }
      );
      totalModified += result.modifiedCount;
    }
    console.log(`Updated ${totalModified} tasks in the unified Task collection.`);

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
