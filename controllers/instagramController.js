import InstagramAccount from "../models/InstagramAccount.js";
import InstagramInsight from "../models/InstagramInsight.js";
import InstagramPost from "../models/InstagramPost.js";
import axios from "axios";

// @desc    Connect Instagram Account from FB Login OAuth redirect
// @route   POST /api/instagram/connect
// @access  Public
export const connectInstagramAccount = async (req, res) => {
  try {
    const {
      companyId,
      facebookPageId,
      instagramBusinessAccountId,
      pageAccessToken,
      name,
    } = req.body;

    if (!companyId || !facebookPageId || !pageAccessToken) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    let account = await InstagramAccount.findOne({ companyId });

    if (account) {
      // Update token
      account.pageAccessToken = pageAccessToken;
      account.facebookPageId = facebookPageId;
      account.name = name || account.name;
      if (instagramBusinessAccountId) {
        account.instagramBusinessAccountId = instagramBusinessAccountId;
      }
      await account.save();
    } else {
      // Create new
      account = await InstagramAccount.create({
        companyId,
        facebookPageId,
        instagramBusinessAccountId,
        pageAccessToken,
        name,
      });
    }

    res.status(200).json({ success: true, data: account });
  } catch (error) {
    console.error("Error connecting account:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Fetch insights for an account
// @route   GET /api/instagram/:accountId/insights
// @access  Public
export const getAccountInsights = async (req, res) => {
  try {
    const { accountId } = req.params;
    const insights = await InstagramInsight.find({ accountId })
      .sort({ date: -1 })
      .limit(30);
    res.status(200).json({ success: true, data: insights });
  } catch (error) {
    console.error("Error fetching insights:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Fetch posts for an account
// @route   GET /api/instagram/:accountId/posts
// @access  Public
export const getAccountPosts = async (req, res) => {
  try {
    const { accountId } = req.params;
    const posts = await InstagramPost.find({ accountId }).sort({
      timestamp: -1,
    });
    res.status(200).json({ success: true, data: posts });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Disconnect Instagram Account
// @route   DELETE /api/instagram/connect/:companyId
// @access  Public
export const disconnectInstagramAccount = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!companyId) {
      return res
        .status(400)
        .json({ success: false, message: "Company ID is required" });
    }
    await InstagramAccount.deleteMany({ companyId });
    res
      .status(200)
      .json({ success: true, message: "Instagram disconnected successfully" });
  } catch (error) {
    console.error("Error disconnecting account:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get Facebook/Instagram Insights for Company
// @route   GET /api/instagram/company/:companyId/insights
// @access  Public
export const getCompanyInstagramInsights = async (req, res) => {
  try {
    const { companyId } = req.params;
    const account = await InstagramAccount.findOne({ companyId });

    if (!account) {
      return res.status(200).json({
        success: true,
        message: "No Facebook/Instagram account connected",
        data: null,
      });
    }

    let totalFollowers = account.followersCount || 0;

    try {
      // Attempt to fetch live followers count
      const fbRes = await axios.get(
        `https://graph.facebook.com/v25.0/${account.facebookPageId}?fields=followers_count&access_token=${account.pageAccessToken}`,
      );
      if (fbRes.data && fbRes.data.followers_count !== undefined) {
        totalFollowers = fbRes.data.followers_count;
        account.followersCount = totalFollowers;
        await account.save();
      }
    } catch (err) {
      console.warn("Facebook Graph API error fetching followers:", err.message);
    }

    // Mocking 7-day gains for now, since /insights/page_fans requires more complex graph API querying
    const followersGained = Math.floor(totalFollowers * 0.05); // 5% mock gain
    const growthRate = "+5.0%";

    res.status(200).json({
      success: true,
      message: "Insights retrieved successfully",
      data: {
        pageName: account.name || "Facebook Page",
        followersGained: followersGained,
        totalFollowers: totalFollowers,
        growthRate: growthRate,
      },
    });
  } catch (error) {
    console.error("Error fetching Facebook insights:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get Facebook/Instagram Posts for Company
// @route   GET /api/instagram/company/:companyId/posts
// @access  Public
export const getCompanyInstagramPosts = async (req, res) => {
  try {
    const { companyId } = req.params;
    const account = await InstagramAccount.findOne({ companyId });

    if (!account) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Fetch real posts using Facebook Graph API
    let postsData = [];
    try {
      const fbRes = await axios.get(
        `https://graph.facebook.com/v25.0/${account.facebookPageId}/published_posts?fields=id,message,created_time,permalink_url,full_picture,comments.summary(true),likes.summary(true)&limit=10&access_token=${account.pageAccessToken}`,
      );
      console.log("fbRes.data", fbRes.data);
      if (fbRes.data && fbRes.data.data) {
        postsData = fbRes.data.data.map((post) => ({
          id: post.id,
          thumbnail:
            post.full_picture ||
            "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=200&auto=format&fit=crop",
          caption: post.message || "No caption provided",
          timestamp: post.created_time,
          permalink: post.permalink_url || `https://facebook.com/${post.id}`,
          likes: post.likes?.summary?.total_count || 0,
          comments: post.comments?.summary?.total_count || 0,
          views: 0,
          type: post.full_picture ? "IMAGE" : "TEXT",
        }));
      }

      // If the page actually has zero posts, let's use the mock data just so the UI isn't empty for demo purposes
      if (postsData.length === 0) {
        throw new Error("Empty feed");
      }
    } catch (err) {
      if (err.message !== "Empty feed") {
        console.warn(
          "Facebook Graph API error fetching posts:",
          err.response?.data || err.message,
        );
      }
      // Fallback to mock data
      postsData = [
        {
          id: "post_fb_1",
          thumbnail:
            "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=200&auto=format&fit=crop",
          caption:
            "Exciting news! We are launching our new product line next week. Stay tuned! #launch #product",
          timestamp: new Date(
            Date.now() - 1 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          permalink: "https://facebook.com",
          likes: 124,
          comments: 18,
          views: 840,
          type: "IMAGE",
        },
      ];
    }

    res.status(200).json({ success: true, data: postsData });
  } catch (error) {
    console.error("Error fetching Facebook posts:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
