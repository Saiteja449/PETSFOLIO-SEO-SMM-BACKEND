import mongoose from 'mongoose';

const taskTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, 
    },
    department: {
      type: String,
      required: true,
      enum: ['SMM', 'SEO', 'Content', 'Sales', 'Creative'],
    },
    category: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: false, // mostly for SMM TargetTemplates
    },
    metric: {
      type: String,
      enum: ['PostCount', 'TotalViews', 'TotalLikes', 'TotalComments'],
      required: false,
    },
    defaultGoalValue: {
      type: Number,
      required: false,
    },
    isFixed: {
      type: Boolean,
      default: false,
    },
    dailyExpiry: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const TaskTemplate = mongoose.model('TaskTemplate', taskTemplateSchema);

export default TaskTemplate;
