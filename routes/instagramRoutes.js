import express from 'express';
import { connectInstagramAccount, getAccountInsights, getAccountPosts, disconnectInstagramAccount, getCompanyInstagramInsights, getCompanyInstagramPosts } from '../controllers/instagramController.js';

const router = express.Router();

router.post('/connect', connectInstagramAccount);
router.get('/:accountId/insights', getAccountInsights);
router.get('/:accountId/posts', getAccountPosts);
router.get('/company/:companyId/posts', getCompanyInstagramPosts);
router.delete('/connect/:companyId', disconnectInstagramAccount);
router.get('/company/:companyId/insights', getCompanyInstagramInsights);

export default router;
