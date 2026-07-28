import express from 'express';
import {
  loginUser,
  logoutUser,
  setupAdmin,
  createEmployee,
  getEmployees,
  deleteEmployee,
  updateEmployeePassword,
  changePassword
} from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.post('/setup-admin', setupAdmin);
router.put('/change-password', protect, changePassword);

router.route('/employees')
  .post(protect, admin, createEmployee)
  .get(protect, admin, getEmployees);

router.route('/employees/:id')
  .delete(protect, admin, deleteEmployee);

router.route('/employees/:id/password')
  .put(protect, admin, updateEmployeePassword);

export default router;
