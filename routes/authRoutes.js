import express from 'express';
import {
  loginUser,
  setupAdmin,
  createEmployee,
  getEmployees,
  deleteEmployee
} from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', loginUser);
router.post('/setup-admin', setupAdmin);

router.route('/employees')
  .post(protect, admin, createEmployee)
  .get(protect, admin, getEmployees);

router.route('/employees/:id')
  .delete(protect, admin, deleteEmployee);

export default router;
