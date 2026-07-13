import GoogleAccount from '../models/GoogleAccount.js';
import GaProperty from '../models/GaProperty.js';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { notifyAdminsOfApiError } from '../utils/notificationHelper.js';

// Helper to get OAuth client with token
const getOAuthClient = (account) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiryDate,
  });
  return oauth2Client;
};

// @desc    Get Available GA4 Properties
// @route   GET /api/google/analytics/properties
// @access  Public
export const getProperties = async (req, res) => {
  try {
    const { companyId } = req.query; // Or get from user
    if (!companyId) return res.status(400).json({ message: 'companyId is required' });

    const account = await GoogleAccount.findOne({ companyId });
    if (!account) return res.status(404).json({ success: false, message: 'Google account not connected.' });

    const authClient = getOAuthClient(account);
    const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: authClient });

    // Fetch account summaries which contain properties
    const response = await analyticsAdmin.accountSummaries.list();
    const accountSummaries = response.data.accountSummaries || [];

    const properties = [];
    accountSummaries.forEach(summary => {
      const accProperties = summary.propertySummaries || [];
      accProperties.forEach(prop => {
        properties.push({
          propertyId: prop.property.replace('properties/', ''),
          displayName: prop.displayName
        });
      });
    });

    res.status(200).json({ success: true, data: properties });
  } catch (error) {
    console.error('Error fetching GA4 properties:', error);
    res.status(500).json({ success: false, message: 'Error fetching properties', error: error.message });
  }
};

// @desc    Save selected GA4 property
// @route   POST /api/google/analytics/properties
// @access  Public
export const saveProperty = async (req, res) => {
  try {
    const { companyId, propertyId, propertyName } = req.body;
    
    if (!companyId || !propertyId || !propertyName) {
      return res.status(400).json({ message: 'companyId, propertyId, and propertyName required' });
    }

    const account = await GoogleAccount.findOne({ companyId });
    if (!account) return res.status(404).json({ message: 'Google account not found.' });

    let property = await GaProperty.findOne({ companyId });
    if (property) {
      property.propertyId = propertyId;
      property.propertyName = propertyName;
      await property.save();
    } else {
      property = new GaProperty({
        accountId: account._id,
        companyId,
        propertyId,
        propertyName
      });
      await property.save();
    }

    res.status(200).json({ success: true, message: 'Property saved successfully', property });
  } catch (error) {
    console.error('Error saving GA4 property:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Shared helper to fetch data using Google Analytics Data API v1
const fetchAnalyticsData = async (companyId, dateRange, dimensions, metrics) => {
  const account = await GoogleAccount.findOne({ companyId });
  if (!account) throw new Error('Google account not connected');
  
  const property = await GaProperty.findOne({ companyId });
  if (!property) throw new Error('GA4 Property not selected');

  const authClient = getOAuthClient(account);
  // Get access token for BetaAnalyticsDataClient
  const { token } = await authClient.getAccessToken();

  const analyticsDataClient = new BetaAnalyticsDataClient({
    authClient: authClient
  });

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${property.propertyId}`,
      dateRanges: [dateRange || { startDate: '30daysAgo', endDate: 'today' }],
      dimensions: dimensions.map(name => ({ name })),
      metrics: metrics.map(name => ({ name }))
    });
    return response;
  } catch (error) {
    await notifyAdminsOfApiError('Google Analytics', error.message, companyId);
    throw error;
  }
};

// @desc    Get Analytics Overview
// @route   GET /api/google/analytics/overview
// @access  Public
export const getOverview = async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;
    if (!companyId) return res.status(400).json({ message: 'companyId is required' });

    const dateRange = { 
      startDate: startDate || '30daysAgo', 
      endDate: endDate || 'today' 
    };

    const metrics = [
      'activeUsers', 'newUsers', 'sessions', 'screenPageViews',
      'engagementRate', 'bounceRate', 'averageSessionDuration', 'conversions'
    ];

    const response = await fetchAnalyticsData(companyId, dateRange, ['date'], metrics);
    
    // Process response for overview cards
    let totals = {};
    metrics.forEach((m, idx) => totals[m] = 0);
    
    // Simple sum for demo (averages need correct math but this is for structure)
    if (response.rows && response.rows.length > 0) {
      // In real scenario, totals are in response.totals
      if (response.totals && response.totals.length > 0) {
        response.totals[0].metricValues.forEach((val, idx) => {
           totals[metrics[idx]] = val.value;
        });
      }
    }

    res.status(200).json({ success: true, totals, trend: response.rows });
  } catch (error) {
    console.error('Error fetching GA4 overview:', error);
    res.status(500).json({ success: false, message: 'Error fetching overview', error: error.message });
  }
};

// @desc    Get Traffic Sources
// @route   GET /api/google/analytics/traffic
export const getTraffic = async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;
    if (!companyId) return res.status(400).json({ message: 'companyId is required' });
    const dateRange = { startDate: startDate || '30daysAgo', endDate: endDate || 'today' };
    
    const response = await fetchAnalyticsData(
      companyId, 
      dateRange, 
      ['sessionDefaultChannelGroup'], 
      ['activeUsers', 'sessions', 'conversions', 'engagementRate']
    );

    res.status(200).json({ success: true, data: response.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching traffic', error: error.message });
  }
};

// @desc    Get Top Pages
// @route   GET /api/google/analytics/pages
export const getPages = async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;
    if (!companyId) return res.status(400).json({ message: 'companyId is required' });
    const dateRange = { startDate: startDate || '30daysAgo', endDate: endDate || 'today' };

    const response = await fetchAnalyticsData(
      companyId, 
      dateRange, 
      ['pagePath'], 
      ['screenPageViews', 'activeUsers', 'averageSessionDuration', 'bounceRate']
    );

    res.status(200).json({ success: true, data: response.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching pages', error: error.message });
  }
};

// @desc    Get Audience Demographics
// @route   GET /api/google/analytics/audience
export const getAudience = async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;
    if (!companyId) return res.status(400).json({ message: 'companyId is required' });
    const dateRange = { startDate: startDate || '30daysAgo', endDate: endDate || 'today' };

    const response = await fetchAnalyticsData(
      companyId, 
      dateRange, 
      ['country', 'deviceCategory', 'browser'], 
      ['activeUsers']
    );

    res.status(200).json({ success: true, data: response.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching audience', error: error.message });
  }
};

// @desc    Get Events
// @route   GET /api/google/analytics/events
export const getEvents = async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;
    if (!companyId) return res.status(400).json({ message: 'companyId is required' });
    const dateRange = { startDate: startDate || '30daysAgo', endDate: endDate || 'today' };

    const response = await fetchAnalyticsData(
      companyId, 
      dateRange, 
      ['eventName'], 
      ['eventCount', 'activeUsers']
    );

    res.status(200).json({ success: true, data: response.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching events', error: error.message });
  }
};

// @desc    Get Realtime Active Users
// @route   GET /api/google/analytics/realtime
export const getRealtime = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ message: 'companyId is required' });
    
    const account = await GoogleAccount.findOne({ companyId });
    if (!account) return res.status(404).json({ message: 'Google account not connected' });
    
    const property = await GaProperty.findOne({ companyId });
    if (!property) return res.status(404).json({ message: 'GA4 Property not selected' });

    const authClient = getOAuthClient(account);
    const analyticsDataClient = new BetaAnalyticsDataClient({ authClient });

    const [response] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${property.propertyId}`,
      dimensions: [{ name: 'country' }, { name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }]
    });

    res.status(200).json({ success: true, data: response.rows });
  } catch (error) {
    console.error('Error fetching realtime:', error);
    await notifyAdminsOfApiError('Google Analytics (Realtime)', error.message, req.query.companyId);
    res.status(500).json({ success: false, message: 'Error fetching realtime', error: error.message });
  }
};
