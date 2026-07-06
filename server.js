import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import instagramRoutes from './routes/instagramRoutes.js';
import youtubeRoutes from './routes/youtubeRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import companyRoutes from './routes/companyRoutes.js';

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

// Test Route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Connect to DB
connectDB();

// Only listen if running locally (not on Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
