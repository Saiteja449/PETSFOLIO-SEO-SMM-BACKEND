import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Company from '../models/Company.js';

export const notifyAdminsOfApiError = async (apiName, errorMessage, companyId = null) => {
  try {
    const managers = await User.find({ role: 'manager' });
    if (!managers || managers.length === 0) return;

    let companyObjectId = null;
    if (companyId) {
      const company = await Company.findOne({ id: companyId });
      if (company) {
        companyObjectId = company._id;
      }
    }

    const title = `${apiName} Connection Error`;

    // Check if a similar notification was created in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const query = {
      title,
      createdAt: { $gte: twentyFourHoursAgo }
    };
    if (companyObjectId) {
      query.companyId = companyObjectId;
    }

    const recentNotification = await Notification.findOne(query);

    if (recentNotification) {
      // Notification already exists within the last 24 hours, don't spam
      return;
    }

    // Ensure error message is a string and truncate if too long
    let safeMessage = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
    if (safeMessage.length > 200) {
      safeMessage = safeMessage.substring(0, 197) + '...';
    }

    const notifications = managers.map((manager) => {
      const notif = {
        title,
        message: `Error connecting to ${apiName}: ${safeMessage}`,
        category: 'system',
        severity: 'danger',
        userId: manager._id,
      };
      if (companyObjectId) notif.companyId = companyObjectId;
      return notif;
    });

    await Notification.insertMany(notifications);
  } catch (error) {
    console.error(`Failed to create API error notification for ${apiName}:`, error);
  }
};
