import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Company from '../models/Company.js';

export const notifyAdminsOfApiError = async (apiName, errorMessage, companyId = null) => {
  try {
    const managers = await User.find({ role: 'manager' });
    if (!managers || managers.length === 0) return;

    // To prevent spamming, we could check if a similar recent notification exists,
    // but for now we'll just insert it.
    
    // Ensure error message is a string and truncate if too long
    let safeMessage = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
    if (safeMessage.length > 200) {
      safeMessage = safeMessage.substring(0, 197) + '...';
    }

    let companyObjectId = null;
    if (companyId) {
      const company = await Company.findOne({ id: companyId });
      if (company) {
        companyObjectId = company._id;
      }
    }

    const notifications = managers.map((manager) => {
      const notif = {
        title: `${apiName} Connection Error`,
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
