import mongoose from 'mongoose';

const youtubeInsightSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'YoutubeAccount',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  views: {
    type: Number,
    default: 0
  },
  subscribersGained: {
    type: Number,
    default: 0
  },
  watchTimeHours: {
    type: Number,
    default: 0
  }
});

const YoutubeInsight = mongoose.model('YoutubeInsight', youtubeInsightSchema);
export default YoutubeInsight;
