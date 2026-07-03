import mongoose from 'mongoose';

const googleAccountSchema = new mongoose.Schema({
  userId: { // Maps to employeeId or manager role
    type: String,
    required: true
  },
  companyId: {
    type: String,
    required: true
  },
  googleId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String
  },
  expiryDate: {
    type: Number
  },
  connectedAt: {
    type: Date,
    default: Date.now
  }
});

const GoogleAccount = mongoose.model('GoogleAccount', googleAccountSchema);
export default GoogleAccount;
