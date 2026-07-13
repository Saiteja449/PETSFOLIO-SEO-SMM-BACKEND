import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Company from '../models/Company.js';
import { notifyAdminsOfApiError } from '../utils/notificationHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the Service Account JSON
const keyFilePath = path.join(__dirname, '..', 'youtube-dashboard-501311-17fccbb556c9.json');

let searchConsoleClient = null;

// Initialize clients if credentials exist
if (fs.existsSync(keyFilePath)) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    
    searchConsoleClient = google.webmasters({
      version: 'v3',
      auth: auth,
    });
    console.log("SEO Analytics: Google APIs initialized successfully");
  } catch (error) {
    console.error("SEO Analytics: Error initializing Google APIs", error);
  }
} else {
  console.warn("SEO Analytics: Google credentials file not found at", keyFilePath);
}

// @desc    Get website search performance from GSC
// @route   GET /api/seo-analytics/search?companyId=...
// @access  Private
export const getPageSearchPerformance = async (req, res) => {
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'companyId is required' });
    }

    if (!searchConsoleClient) {
      return res.status(503).json({ success: false, message: 'Google Search Console client not configured' });
    }

    const company = await Company.findOne({ id: companyId });
    if (!company || !company.website) {
      return res.status(404).json({ success: false, message: 'Company not found or Website URL not set' });
    }

    // Ensure URL has trailing slash for GSC property matching if it's a domain property
    // Sometimes GSC properties are "sc-domain:infasta.com" but for URL prefixes it's "https://infasta.com/"
    let siteUrl = company.website;
    if (!siteUrl.startsWith('sc-domain:') && !siteUrl.endsWith('/')) {
      siteUrl = siteUrl + '/';
    }

    // Get dates for last 30 days
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDateObj = new Date();
    startDateObj.setDate(today.getDate() - 30);
    const startDate = startDateObj.toISOString().split('T')[0];

    const response = await searchConsoleClient.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDate,
        endDate: endDate,
        dimensions: ['page'],
        rowLimit: 100, // Get top 100 pages
      },
    });

    let totalClicks = 0;
    let totalImpressions = 0;
    let sumPosition = 0;
    let sumCtr = 0;
    
    let pages = [];

    if (response.data.rows && response.data.rows.length > 0) {
      pages = response.data.rows.map(row => {
        totalClicks += row.clicks || 0;
        totalImpressions += row.impressions || 0;
        sumPosition += row.position || 0;
        sumCtr += row.ctr || 0;

        return {
          pagePath: row.keys[0].replace(siteUrl, '/'),
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: ((row.ctr || 0) * 100).toFixed(2),
          position: (row.position || 0).toFixed(1),
        };
      });
    }

    const rowCount = pages.length || 1;
    
    res.status(200).json({
      success: true,
      data: {
        siteUrl,
        overall: {
          clicks: totalClicks,
          impressions: totalImpressions,
          ctr: ((sumCtr / rowCount) * 100).toFixed(2),
          position: (sumPosition / rowCount).toFixed(1),
        },
        pages: pages
      },
    });
  } catch (error) {
    console.error('Error fetching GSC data:', error.message);
    const details = error.errors ? error.errors : (error.response?.data || error.message);
    await notifyAdminsOfApiError('Google Search Console', error.message, req.query.companyId);
    res.status(500).json({ success: false, message: 'Error fetching search performance data', details });
  }
};
