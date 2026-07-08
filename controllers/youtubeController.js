import YoutubeAccount from "../models/YoutubeAccount.js";
import YoutubeInsight from "../models/YoutubeInsight.js";
import GoogleAccount from "../models/GoogleAccount.js";
import { google } from "googleapis";

// Global client kept for other methods if needed, but we should instantiate per request
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// @desc    Connect Youtube Account
// @route   POST /api/youtube/connect
// @access  Public (for now)
export const connectYoutubeAccount = async (req, res) => {
  try {
    const { code, companyId, redirectUri } = req.body;

    if (!code || !companyId) {
      return res
        .status(400)
        .json({ message: "Code and companyId are required" });
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri || process.env.GOOGLE_REDIRECT_URI,
    );

    // Exchange authorization code for access token
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Fetch user profile using Google OAuth2 API
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userInfoRes = await oauth2.userinfo.get();
    const googleUserInfo = userInfoRes.data;

    // Check if Google Account already exists
    let googleAccount = await GoogleAccount.findOne({
      googleId: googleUserInfo.id,
      companyId,
    });

    if (googleAccount) {
      googleAccount.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        googleAccount.refreshToken = tokens.refresh_token;
      }
      googleAccount.expiryDate = tokens.expiry_date;
      await googleAccount.save();
    } else {
      googleAccount = new GoogleAccount({
        userId: "admin", // In a real system, pass this from req.user.id
        companyId,
        googleId: googleUserInfo.id,
        email: googleUserInfo.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || "",
        expiryDate: tokens.expiry_date,
      });
      await googleAccount.save();
    }

    // Fetch user channel information using YouTube Data API v3
    const youtube = google.youtube({
      version: "v3",
      auth: client,
    });

    const channelRes = await youtube.channels.list({
      part: "snippet,id",
      mine: true,
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      return res
        .status(404)
        .json({ message: "No YouTube channel found for this account." });
    }

    const channel = channelRes.data.items[0];

    // Check if account already exists
    let account = await YoutubeAccount.findOne({
      channelId: channel.id,
      companyId,
    });

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
        refreshToken: tokens.refresh_token || "",
      });
      await account.save();
    }

    res.status(200).json({
      message: "YouTube connected successfully",
      account,
    });
  } catch (error) {
    console.error("Error connecting YouTube:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
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
      return res.status(404).json({ message: "Account not found" });
    }

    // In a real scenario, use google.youtubeAnalytics API with account.accessToken
    // We will return dummy insights for dashboard testing
    const insights = await YoutubeInsight.find({ accountId })
      .sort({ date: -1 })
      .limit(7);

    if (insights.length === 0) {
      // Return some mock data if db is empty
      return res.status(200).json({
        message: "Insights retrieved successfully (mock)",
        data: [
          {
            date: new Date(),
            views: 1250,
            subscribersGained: 15,
            watchTimeHours: 42.5,
          },
        ],
      });
    }

    res.status(200).json({
      message: "Insights retrieved successfully",
      data: insights,
    });
  } catch (error) {
    console.error("Error fetching YouTube insights:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get YouTube Insights by Company ID
// @route   GET /api/youtube/company/:companyId/insights
// @access  Public
export const getCompanyYoutubeInsights = async (req, res) => {
  try {
    const { companyId } = req.params;
    const account = await YoutubeAccount.findOne({ companyId });

    if (!account) {
      return res.status(200).json({
        message: "No YouTube account connected",
        data: null,
      });
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    const youtube = google.youtube({ version: "v3", auth: client });

    // Get total subscribers
    const channelRes = await youtube.channels.list({
      part: "statistics,snippet",
      id: account.channelId,
    });

    let totalSubscribers = 0;
    let channelTitle = account.channelTitle || "YouTube Channel";

    if (channelRes.data.items && channelRes.data.items.length > 0) {
      const stats = channelRes.data.items[0].statistics;
      totalSubscribers = parseInt(stats.subscriberCount, 10) || 0;
      channelTitle = channelRes.data.items[0].snippet.title;
    }

    // Get Analytics for last 7 days
    const youtubeAnalytics = google.youtubeAnalytics({
      version: "v2",
      auth: client,
    });

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    const startDate = start.toISOString().split("T")[0];
    const endDate = end.toISOString().split("T")[0];

    let subscribersGained = 0;
    let subscribersLost = 0;

    try {
      const analyticsRes = await youtubeAnalytics.reports.query({
        ids: "channel==MINE",
        startDate: startDate,
        endDate: endDate,
        metrics: "subscribersGained,subscribersLost",
      });

      if (analyticsRes.data.rows && analyticsRes.data.rows.length > 0) {
        subscribersGained = analyticsRes.data.rows[0][0] || 0;
        subscribersLost = analyticsRes.data.rows[0][1] || 0;
      }
    } catch (analyticsError) {
      console.warn("YouTube Analytics API error:", analyticsError.message);
    }

    const netSubscribers = subscribersGained - subscribersLost;

    // Calculate Growth Rate
    let growthRate = "0%";
    if (totalSubscribers > 0) {
      const previousTotal = totalSubscribers - netSubscribers;
      if (previousTotal > 0) {
        const rate = (netSubscribers / previousTotal) * 100;
        growthRate = (rate > 0 ? "+" : "") + rate.toFixed(2) + "%";
      } else {
        growthRate = "+100%";
      }
    } else if (netSubscribers > 0) {
      growthRate = "+100%";
    }

    res.status(200).json({
      message: "Insights retrieved successfully",
      data: {
        channelTitle,
        subscribersGained: netSubscribers,
        totalSubscribers,
        growthRate,
      },
    });
  } catch (error) {
    console.error("Error fetching YouTube insights:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Disconnect Youtube Account
// @route   DELETE /api/youtube/connect/:companyId
// @access  Public
export const disconnectYoutubeAccount = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }
    await YoutubeAccount.deleteMany({ companyId });
    await GoogleAccount.deleteMany({ companyId });
    res
      .status(200)
      .json({ success: true, message: "Google disconnected successfully" });
  } catch (error) {
    console.error("Error disconnecting account:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get Youtube Posts for Company
// @route   GET /api/youtube/company/:companyId/posts
// @access  Public
export const getCompanyYoutubePosts = async (req, res) => {
  try {
    const { companyId } = req.params;
    const account = await YoutubeAccount.findOne({ companyId });

    if (!account) {
      return res.status(200).json({ success: true, data: [] });
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    const youtube = google.youtube({ version: "v3", auth: client });

    // Step 1: Get the 'uploads' playlist ID for the channel
    const channelRes = await youtube.channels.list({
      part: "contentDetails",
      id: account.channelId,
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const uploadsPlaylistId =
      channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

    // Step 2: Get the latest videos from the uploads playlist
    const playlistRes = await youtube.playlistItems.list({
      part: "snippet",
      playlistId: uploadsPlaylistId,
      maxResults: 10,
    });

    if (!playlistRes.data.items || playlistRes.data.items.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const videoIds = playlistRes.data.items.map(
      (item) => item.snippet.resourceId.videoId,
    );

    // Step 3: Get statistics for those videos
    const videosRes = await youtube.videos.list({
      part: "snippet,statistics",
      id: videoIds.join(","),
    });

    const posts = videosRes.data.items.map((video) => {
      const isShort = video.snippet.title.toLowerCase().includes("#shorts"); // Simple heuristic
      return {
        id: video.id,
        thumbnail:
          video.snippet.thumbnails?.high?.url ||
          video.snippet.thumbnails?.default?.url ||
          "https://via.placeholder.com/200x150",
        caption: video.snippet.title,
        timestamp: video.snippet.publishedAt,
        permalink: `https://www.youtube.com/watch?v=${video.id}`,
        likes: parseInt(video.statistics.likeCount || 0, 10),
        comments: parseInt(video.statistics.commentCount || 0, 10),
        views: parseInt(video.statistics.viewCount || 0, 10),
        type: isShort ? "SHORTS" : "VIDEO",
      };
    });

    res.status(200).json({ success: true, data: posts });
  } catch (error) {
    console.error("Error fetching Youtube posts:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
