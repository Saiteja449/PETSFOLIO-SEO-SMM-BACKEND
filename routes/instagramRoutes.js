import express from 'express';
import {
  connectInstagramAccount,
  getAccountInsights,
  getAccountPosts,
  disconnectInstagramAccount,
  getCompanyInstagramInsights,
  getCompanyInstagramPosts,
  getCompanyFacebookInsights,
  getCompanyFacebookPosts,
  getCompanySocialTrends
} from '../controllers/instagramController.js';

const router = express.Router();

router.post('/connect', connectInstagramAccount);
router.get('/:accountId/insights', getAccountInsights);
router.get('/:accountId/posts', getAccountPosts);
router.get('/company/:companyId/posts', getCompanyInstagramPosts);
router.get('/company/:companyId/insights', getCompanyInstagramInsights);
router.get('/company/:companyId/fb-posts', getCompanyFacebookPosts);
router.get('/company/:companyId/fb-insights', getCompanyFacebookInsights);
router.get('/company/:companyId/social-trends', getCompanySocialTrends);
router.delete('/connect/:companyId', disconnectInstagramAccount);

export default router;
