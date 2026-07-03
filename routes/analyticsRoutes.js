import express from 'express';
import {
  getProperties,
  saveProperty,
  getOverview,
  getTraffic,
  getPages,
  getAudience,
  getEvents,
  getRealtime
} from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/properties', getProperties);
router.post('/properties', saveProperty);
router.get('/overview', getOverview);
router.get('/traffic', getTraffic);
router.get('/pages', getPages);
router.get('/audience', getAudience);
router.get('/events', getEvents);
router.get('/realtime', getRealtime);

export default router;
