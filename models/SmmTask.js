import mongoose from 'mongoose';

const smmTaskSchema = new mongoose.Schema(
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
    platform: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      required: true,
      default: 'Reel Post',
    },
    status: {
      type: String,
      required: true,
      default: 'notstarted',
      enum: ['notstarted', 'inprogress', 'completed'],
    },
    employeeId: {
      type: String,
      required: true,
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
    isAutomated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Transform the _id to id in JSON responses for frontend compatibility
smmTaskSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

const SmmTask = mongoose.model('SmmTask', smmTaskSchema);

export default SmmTask;
