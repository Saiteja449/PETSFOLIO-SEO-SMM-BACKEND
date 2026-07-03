import express from 'express';
import { connectInstagramAccount, getAccountInsights, getAccountPosts } from '../controllers/instagramController.js';

const router = express.Router();

router.post('/connect', connectInstagramAccount);
router.get('/:accountId/insights', getAccountInsights);
router.get('/:accountId/posts', getAccountPosts);

export default router;
