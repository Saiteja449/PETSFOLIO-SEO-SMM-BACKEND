import mongoose from 'mongoose';

const youtubeAccountSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  channelTitle: {
    type: String
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String
  },
  connectedAt: {
    type: Date,
    default: Date.now
  }
});

const YoutubeAccount = mongoose.model('YoutubeAccount', youtubeAccountSchema);
export default YoutubeAccount;
