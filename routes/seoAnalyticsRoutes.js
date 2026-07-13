import express from 'express';
import { getPageSearchPerformance } from '../controllers/seoAnalyticsController.js';

const router = express.Router();

router.get('/search', getPageSearchPerformance);

export default router;
