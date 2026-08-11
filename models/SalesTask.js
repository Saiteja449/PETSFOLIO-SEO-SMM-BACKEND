import mongoose from 'mongoose';

const salesTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
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
    type: {
      type: String,
      required: true,
      default: 'Sales Task',
    },
    status: {
      type: String,
      required: true,
      default: 'notstarted',
      enum: ['notstarted', 'inprogress', 'completed'],
    },
    assignedTo: {
      type: String,
      required: true,
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
    dueDate: {
      type: Date,
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
      date: { type: Date, default: Date.now },
    }],
    isAutomated: {
      type: Boolean,
      default: false,
    },
    dailyExpiry: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

salesTaskSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

const SalesTask = mongoose.model('SalesTask', salesTaskSchema);

export default SalesTask;
