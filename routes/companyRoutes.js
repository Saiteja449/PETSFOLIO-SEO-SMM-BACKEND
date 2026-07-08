import express from 'express';
import {
  getCompanies,
  createCompany,
  deleteCompany,
  getCompanyIntegrations
} from '../controllers/companyController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getCompanies)
  .post(protect, admin, createCompany);

router.route('/:id')
  .delete(protect, admin, deleteCompany);

router.get('/:id/integrations', protect, getCompanyIntegrations);

export default router;
