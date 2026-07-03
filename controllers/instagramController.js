import InstagramAccount from '../models/InstagramAccount.js';
import InstagramInsight from '../models/InstagramInsight.js';
import InstagramPost from '../models/InstagramPost.js';
import axios from 'axios';

// @desc    Connect Instagram Account from FB Login OAuth redirect
// @route   POST /api/instagram/connect
// @access  Public
export const connectInstagramAccount = async (req, res) => {
  try {
    const { companyId, facebookPageId, instagramBusinessAccountId, pageAccessToken, name } = req.body;

    if (!companyId || !facebookPageId || !instagramBusinessAccountId || !pageAccessToken) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    let account = await InstagramAccount.findOne({ instagramBusinessAccountId });

    if (account) {
      // Update token
      account.pageAccessToken = pageAccessToken;
      account.name = name || account.name;
      await account.save();
    } else {
      // Create new
      account = await InstagramAccount.create({
        companyId,
        facebookPageId,
        instagramBusinessAccountId,
        pageAccessToken,
        name
      });
    }

    res.status(200).json({ success: true, data: account });
  } catch (error) {
    console.error('Error connecting account:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Fetch insights for an account
// @route   GET /api/instagram/:accountId/insights
// @access  Public
export const getAccountInsights = async (req, res) => {
  try {
    const { accountId } = req.params;
    const insights = await InstagramInsight.find({ accountId }).sort({ date: -1 }).limit(30);
    res.status(200).json({ success: true, data: insights });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Fetch posts for an account
// @route   GET /api/instagram/:accountId/posts
// @access  Public
export const getAccountPosts = async (req, res) => {
  try {
    const { accountId } = req.params;
    const posts = await InstagramPost.find({ accountId }).sort({ timestamp: -1 });
    res.status(200).json({ success: true, data: posts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
