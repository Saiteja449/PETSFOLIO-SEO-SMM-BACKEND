import mongoose from 'mongoose';

const instagramAccountSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true
  },
  facebookPageId: {
    type: String,
    required: true
  },
  instagramBusinessAccountId: {
    type: String,
    required: false
  },
  pageAccessToken: {
    type: String,
    required: true
  },
  name: {
    type: String
  },
  followersCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const InstagramAccount = mongoose.model('InstagramAccount', instagramAccountSchema);

export default InstagramAccount;
