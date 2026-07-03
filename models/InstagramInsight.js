import mongoose from 'mongoose';

const instagramInsightSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InstagramAccount',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  reach: {
    type: Number,
    default: 0
  },
  impressions: {
    type: Number,
    default: 0
  },
  profileViews: {
    type: Number,
    default: 0
  },
  websiteClicks: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const InstagramInsight = mongoose.model('InstagramInsight', instagramInsightSchema);

export default InstagramInsight;
