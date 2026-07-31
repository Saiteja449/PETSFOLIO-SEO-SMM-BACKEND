import mongoose from 'mongoose';

const seoTaskSchema = new mongoose.Schema(
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
      default: 'Blog Post',
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
    isAutomated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

seoTaskSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

const SeoTask = mongoose.model('SeoTask', seoTaskSchema);

export default SeoTask;
