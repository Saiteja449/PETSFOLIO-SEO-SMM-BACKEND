import express from 'express';
import { connectYoutubeAccount, getAccountInsights, getCompanyYoutubeInsights, disconnectYoutubeAccount, getCompanyYoutubePosts } from '../controllers/youtubeController.js';

const router = express.Router();

router.post('/connect', connectYoutubeAccount);
router.get('/:accountId/insights', getAccountInsights);
router.get('/company/:companyId/insights', getCompanyYoutubeInsights);
router.get('/company/:companyId/posts', getCompanyYoutubePosts);
router.delete('/connect/:companyId', disconnectYoutubeAccount);

export default router;
