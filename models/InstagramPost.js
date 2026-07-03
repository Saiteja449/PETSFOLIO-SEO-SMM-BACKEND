import mongoose from 'mongoose';

const instagramPostSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InstagramAccount',
    required: true
  },
  postId: {
    type: String,
    required: true
  },
  caption: {
    type: String
  },
  mediaType: {
    type: String // IMAGE, VIDEO, CAROUSEL_ALBUM
  },
  mediaUrl: {
    type: String
  },
  permalink: {
    type: String
  },
  timestamp: {
    type: Date
  },
  likes: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  reach: {
    type: Number,
    default: 0
  },
  saved: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const InstagramPost = mongoose.model('InstagramPost', instagramPostSchema);

export default InstagramPost;
