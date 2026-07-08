import cron from 'node-cron';
import TrackedVideo from '../models/TrackedVideo.js';
import EmployeeTarget from '../models/EmployeeTarget.js';

// Setup Poller
export const setupAnalyticsPoller = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running Analytics Poller Cron Job...');
    try {
      // Logic for polling:
      // 1. Fetch all companies that have connected YouTube/Meta accounts.
      // 2. Use YouTube Data API to fetch latest videos for the channel.
      // 3. Use Meta Graph API to fetch latest posts for the business account.
      // 4. Update or insert into TrackedVideo collection.
      
      console.log('Fetching latest videos from Meta and YouTube APIs...');
      
      // Note: Full implementation would require iterating over GoogleAccount/InstagramAccount 
      // and making actual axios/googleapis calls here.
      // For now, this is a placeholder where the data fetch would happen.
      
      // Update targets based on claimed videos
      const activeTargets = await EmployeeTarget.find({ status: 'In Progress' });
      for (const target of activeTargets) {
        // Recalculate currentValue based on TrackedVideos claimed by the employee
        const claimedVideos = await TrackedVideo.find({ 
          employeeId: target.employeeId, 
          isClaimed: true, 
          platform: target.platform === 'Both' ? { $in: ['Meta', 'YouTube'] } : target.platform,
          publishedAt: { $gte: target.startDate, $lte: target.endDate }
        });

        let newCurrentValue = 0;
        if (target.metric === 'PostCount') {
          newCurrentValue = claimedVideos.length;
        } else if (target.metric === 'TotalViews') {
          newCurrentValue = claimedVideos.reduce((sum, v) => sum + v.views, 0);
        } else if (target.metric === 'TotalLikes') {
          newCurrentValue = claimedVideos.reduce((sum, v) => sum + v.likes, 0);
        } else if (target.metric === 'TotalComments') {
          newCurrentValue = claimedVideos.reduce((sum, v) => sum + v.comments, 0);
        }

        if (newCurrentValue !== target.currentValue) {
          target.currentValue = newCurrentValue;
          if (target.currentValue >= target.goalValue) {
            target.status = 'Completed';
          }
          await target.save();
          console.log(`Updated target for employee ${target.employeeId} - New Value: ${target.currentValue}`);
        }
      }

      console.log('Analytics Poller Job Completed.');
    } catch (error) {
      console.error('Error in Analytics Poller Cron Job:', error);
    }
  });
};
