import express from 'express';
import { connectYoutubeAccount, getAccountInsights } from '../controllers/youtubeController.js';

const router = express.Router();

router.post('/connect', connectYoutubeAccount);
router.get('/:accountId/insights', getAccountInsights);

export default router;
