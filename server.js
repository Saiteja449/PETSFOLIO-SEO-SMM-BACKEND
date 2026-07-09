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
import notificationRoutes from './routes/notificationRoutes.js';
import { setupAnalyticsPoller } from './jobs/analyticsPoller.js';

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
app.use('/api/notifications', notificationRoutes);

// Test Route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Connect to DB
connectDB();

// Initialize Cron Jobs
setupAnalyticsPoller();

// Only listen if running locally (not on Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
