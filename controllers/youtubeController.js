import YoutubeAccount from '../models/YoutubeAccount.js';
import YoutubeInsight from '../models/YoutubeInsight.js';
import GoogleAccount from '../models/GoogleAccount.js';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// @desc    Connect Youtube Account
// @route   POST /api/youtube/connect
// @access  Public (for now)
export const connectYoutubeAccount = async (req, res) => {
  try {
    const { code, companyId } = req.body;

    if (!code || !companyId) {
      return res.status(400).json({ message: 'Code and companyId are required' });
    }

    // Exchange authorization code for access token
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile using Google OAuth2 API
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoRes = await oauth2.userinfo.get();
    const googleUserInfo = userInfoRes.data;

    // Check if Google Account already exists
    let googleAccount = await GoogleAccount.findOne({ googleId: googleUserInfo.id, companyId });

    if (googleAccount) {
      googleAccount.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        googleAccount.refreshToken = tokens.refresh_token;
      }
      googleAccount.expiryDate = tokens.expiry_date;
      await googleAccount.save();
    } else {
      googleAccount = new GoogleAccount({
        userId: 'admin', // In a real system, pass this from req.user.id
        companyId,
        googleId: googleUserInfo.id,
        email: googleUserInfo.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiryDate: tokens.expiry_date
      });
      await googleAccount.save();
    }

    // Fetch user channel information using YouTube Data API v3
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    const channelRes = await youtube.channels.list({
      part: 'snippet,id',
      mine: true
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      return res.status(404).json({ message: 'No YouTube channel found for this account.' });
    }

    const channel = channelRes.data.items[0];
    
    // Check if account already exists
    let account = await YoutubeAccount.findOne({ channelId: channel.id, companyId });

    if (account) {
      // Update existing account tokens
      account.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        account.refreshToken = tokens.refresh_token;
      }
      account.channelTitle = channel.snippet.title;
      await account.save();
    } else {
      // Create new account
      account = new YoutubeAccount({
        companyId,
        channelId: channel.id,
        channelTitle: channel.snippet.title,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || ''
      });
      await account.save();
    }

    res.status(200).json({
      message: 'YouTube connected successfully',
      account
    });
  } catch (error) {
    console.error('Error connecting YouTube:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get Account Insights (Dummy data for now unless fully implemented)
// @route   GET /api/youtube/:accountId/insights
// @access  Public
export const getAccountInsights = async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = await YoutubeAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // In a real scenario, use google.youtubeAnalytics API with account.accessToken
    // We will return dummy insights for dashboard testing
    const insights = await YoutubeInsight.find({ accountId }).sort({ date: -1 }).limit(7);
    
    if (insights.length === 0) {
       // Return some mock data if db is empty
       return res.status(200).json({
         message: 'Insights retrieved successfully (mock)',
         data: [
           { date: new Date(), views: 1250, subscribersGained: 15, watchTimeHours: 42.5 }
         ]
       });
    }

    res.status(200).json({
      message: 'Insights retrieved successfully',
      data: insights
    });

  } catch (error) {
    console.error('Error fetching YouTube insights:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
