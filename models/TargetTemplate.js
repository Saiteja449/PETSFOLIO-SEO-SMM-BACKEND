import mongoose from 'mongoose';

const TargetTemplateSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false,
  },
  name: {
    type: String,
    required: true, // e.g., "Weekly Reel Master", "10k Views Challenge"
  },
  description: {
    type: String,
  },
  platform: {
    type: String,
    enum: ['Meta', 'YouTube', 'Both'],
    required: true,
  },
  metric: {
    type: String,
    enum: ['PostCount', 'TotalViews', 'TotalLikes', 'TotalComments'],
    required: false,
  },
  defaultGoalValue: {
    type: Number,
    required: false,
  }
}, { timestamps: true });

const TargetTemplate = mongoose.model('TargetTemplate', TargetTemplateSchema);
export default TargetTemplate;
