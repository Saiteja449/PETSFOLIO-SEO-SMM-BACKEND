import crypto from "crypto";
import TrackedLink from "../models/TrackedLink.js";
import LinkClick from "../models/LinkClick.js";

// Helper to parse device and browser from User-Agent
function parseUserAgent(ua = "") {
  let deviceType = "desktop";
  if (/mobile|android|touch|webos|hpwos/i.test(ua)) {
    deviceType = "mobile";
  } else if (/ipad|tablet/i.test(ua)) {
    deviceType = "tablet";
  }

  let browser = "Other";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";

  return { deviceType, browser };
}

// 1. Create a Tracked Marketing Link
export async function createTrackedLink(req, res) {
  try {
    const { title, destinationUrl, platform, campaign, companyId, customCode } = req.body;

    if (!title || !destinationUrl) {
      return res.status(400).json({ success: false, message: "Title and destinationUrl are required" });
    }

    let shortCode = customCode ? customCode.trim().toLowerCase() : "";
    if (shortCode) {
      const existing = await TrackedLink.findOne({ shortCode });
      if (existing) {
        return res.status(400).json({ success: false, message: "Short code already in use" });
      }
    } else {
      shortCode = crypto.randomBytes(3).toString("hex");
    }

    const trackedLink = new TrackedLink({
      title,
      destinationUrl,
      shortCode,
      platform: platform ? platform.toLowerCase() : "other",
      campaign: campaign || "general",
      companyId: companyId || "",
      createdBy: req.user?._id || null,
    });

    await trackedLink.save();
    res.status(201).json({ success: true, data: trackedLink });
  } catch (err) {
    console.error("Error creating tracked link:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 2. Get All Tracked Links
export async function getTrackedLinks(req, res) {
  try {
    const { companyId, platform } = req.query;
    const filter = { isActive: true };
    if (companyId && companyId !== "all") filter.companyId = companyId;
    if (platform && platform !== "all") filter.platform = platform.toLowerCase();

    const links = await TrackedLink.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: links.length, data: links });
  } catch (err) {
    console.error("Error fetching tracked links:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 3. Delete / Deactivate a Link
export async function deleteTrackedLink(req, res) {
  try {
    await TrackedLink.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Link deleted successfully" });
  } catch (err) {
    console.error("Error deleting link:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 4. Public Redirector Endpoint (GET /api/links/r/:code)
export async function redirectTrackedLink(req, res) {
  try {
    const { code } = req.params;
    const link = await TrackedLink.findOne({ shortCode: code, isActive: true });

    if (!link) {
      return res.status(404).send("Link not found or deactivated.");
    }

    // Capture click asynchronously
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const ipHash = crypto.createHash("sha256").update(ip + (process.env.JWT_SECRET || "salt")).digest("hex");
    const ua = req.headers["user-agent"] || "";
    const referrer = req.headers["referer"] || "";
    const { deviceType, browser } = parseUserAgent(ua);

    // Record click
    setImmediate(async () => {
      try {
        const isRepeat = await LinkClick.exists({ linkId: link._id, ipHash });
        await LinkClick.create({
          linkId: link._id,
          shortCode: link.shortCode,
          platform: link.platform,
          ipHash,
          deviceType,
          browser,
          referrer,
        });

        const update = { $inc: { clicksCount: 1 } };
        if (!isRepeat) {
          update.$inc.uniqueClicksCount = 1;
        }
        await TrackedLink.updateOne({ _id: link._id }, update);
      } catch (logErr) {
        console.error("Error recording link click:", logErr);
      }
    });

    // 302 Redirect to destination
    return res.redirect(302, link.destinationUrl);
  } catch (err) {
    console.error("Error redirecting link:", err);
    return res.status(500).send("Redirect failed");
  }
}

// 5. Aggregate Link Tracking Analytics
export async function getLinkAnalytics(req, res) {
  try {
    const { startDate, endDate, companyId } = req.query;

    const linkFilter = { isActive: true };
    if (companyId && companyId !== "all") linkFilter.companyId = companyId;

    const links = await TrackedLink.find(linkFilter).lean();
    const linkIds = links.map((l) => l._id);

    const clickFilter = { linkId: { $in: linkIds } };
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      clickFilter.createdAt = { $gte: start, $lte: end };
    }

    const clicks = await LinkClick.find(clickFilter).lean();

    const totalClicks = clicks.length;
    const uniqueIps = new Set(clicks.map((c) => c.ipHash));
    const uniqueClicks = uniqueIps.size;
    const repeatClicks = Math.max(0, totalClicks - uniqueClicks);

    // Platform Breakdown
    const platforms = ["whatsapp", "instagram", "facebook", "linkedin", "email", "ads", "website", "other"];
    const platformStats = platforms.map((p) => {
      const pClicks = clicks.filter((c) => (c.platform || "other").toLowerCase() === p);
      const pUniques = new Set(pClicks.map((c) => c.ipHash)).size;
      return {
        platform: p.charAt(0).toUpperCase() + p.slice(1),
        totalClicks: pClicks.length,
        uniqueVisitors: pUniques,
      };
    }).sort((a, b) => b.totalClicks - a.totalClicks);

    // Device breakdown
    const devices = { mobile: 0, desktop: 0, tablet: 0 };
    clicks.forEach((c) => {
      const d = c.deviceType || "desktop";
      devices[d] = (devices[d] || 0) + 1;
    });

    // Browser breakdown
    const browsers = {};
    clicks.forEach((c) => {
      const b = c.browser || "Other";
      browsers[b] = (browsers[b] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalLinks: links.length,
        totalClicks,
        uniqueClicks,
        repeatClicks,
        topPlatform: platformStats[0]?.totalClicks > 0 ? platformStats[0].platform : "None",
        platformStats,
        devices,
        browsers,
      },
    });
  } catch (err) {
    console.error("Error in getLinkAnalytics:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
