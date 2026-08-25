import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      enum: ['SMM', 'SEO', 'Content', 'Sales', 'Creative'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    url: {
      type: String,
      trim: true,
      default: '',
    },
    platform: {
      type: String, // mostly used for SMM
      default: '',
    },
    type: {
      type: String,
      required: true,
      default: 'Task',
    },
    status: {
      type: String,
      required: true,
      default: 'notstarted',
      enum: ['notstarted', 'inprogress', 'completed'],
    },
    assignedTo: {
      type: String,
    },
    employeeId: {
      type: String,
    },
    companyId: {
      type: String,
      required: true,
    },
    weekLabel: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      default: 'Today',
    },
    startDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    frequency: {
      type: String,
      enum: ['Daily', 'Weekly', 'Monthly', ''],
      default: '',
    },
    targetQuantity: {
      type: Number,
      default: 1,
    },
    completedQuantity: {
      type: Number,
      default: 0,
    },
    updates: [{
      quantityAdded: { type: Number, required: true, min: 1 },
      description: { type: String, required: true, trim: true },
      url: { type: String, trim: true },
      date: { type: Date, default: Date.now },
    }],
    isAutomated: {
      type: Boolean,
      default: false,
    },
    dailyExpiry: {
      type: Boolean,
      default: true,
    },
    isLegacyInternData: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    originalOwnerId: {
      type: String,
    },
    parentEmployeeId: {
      type: String,
    },
    subTasks: [{
      assignedToInternId: { type: String, required: true },
      assignedByEmployeeId: { type: String, required: true },
      targetQuantity: { type: Number, required: true },
      completedQuantity: { type: Number, default: 0 },
      status: { type: String, enum: ['notstarted', 'inprogress', 'paused', 'completed'], default: 'notstarted' },
      proofUrl: { type: String },
      notes: { type: String },
      completedBy: {
        userId: String,
        name: String,
        role: String
      },
      submissions: [{
        quantityAdded: { type: Number, required: true, min: 1 },
        proofUrl: { type: String },
        notes: { type: String },
        submittedAt: { type: Date, default: Date.now },
      }],
      completedAt: Date,
      updatedAt: Date
    }],
  },
  {
    timestamps: true,
  }
);

taskSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

const Task = mongoose.model('Task', taskSchema);

export default Task;
