import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import instagramRoutes from './routes/instagramRoutes.js';
import youtubeRoutes from './routes/youtubeRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import targetRoutes from './routes/targetRoutes.js';
import smmTaskRoutes from './routes/smmTaskRoutes.js';
import seoTaskRoutes from './routes/seoTaskRoutes.js';
import contentTaskRoutes from './routes/contentTaskRoutes.js';
import salesTaskRoutes from './routes/salesTaskRoutes.js';
import creativeTaskRoutes from './routes/creativeTaskRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import seoAnalyticsRoutes from './routes/seoAnalyticsRoutes.js';
import holidayRoutes from './routes/holidayRoutes.js';
import biRoutes from './routes/biRoutes.js';
import { setupMonthlyTaskGenerator } from './jobs/monthlyTaskGenerator.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/instagram', instagramRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/google/analytics', analyticsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/smm-tasks', smmTaskRoutes);
app.use('/api/seo-tasks', seoTaskRoutes);
app.use('/api/content-tasks', contentTaskRoutes);
app.use('/api/sales-tasks', salesTaskRoutes);
app.use('/api/creative-tasks', creativeTaskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/seo-analytics', seoAnalyticsRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/bi', biRoutes);

// Test Route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Connect to DB
await connectDB();

// Initialize Cron Jobs
setupMonthlyTaskGenerator();

// Only listen if running locally (not on Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
