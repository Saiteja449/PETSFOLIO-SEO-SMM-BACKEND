import mongoose from 'mongoose';

const TrackedVideoSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  employeeId: {
    // Null if not claimed yet
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  platform: {
    type: String,
    enum: ['Meta', 'YouTube'],
    required: true,
  },
  externalId: {
    type: String,
    required: true, // YouTube Video ID or Meta Post ID
  },
  title: {
    type: String,
  },
  embedUrl: {
    type: String,
  },
  thumbnailUrl: {
    type: String,
  },
  views: {
    type: Number,
    default: 0,
  },
  likes: {
    type: Number,
    default: 0,
  },
  comments: {
    type: Number,
    default: 0,
  },
  shares: {
    type: Number,
    default: 0,
  },
  publishedAt: {
    type: Date,
  },
  isClaimed: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

const TrackedVideo = mongoose.model('TrackedVideo', TrackedVideoSchema);
export default TrackedVideo;
