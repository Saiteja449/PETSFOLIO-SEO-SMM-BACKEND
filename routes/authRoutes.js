import express from 'express';
import {
  loginUser,
  logoutUser,
  setupAdmin,
  createEmployee,
  getEmployees,
  deleteEmployee,
  updateEmployeePassword,
  changePassword,
  updateEmployee,
  createIntern,
  getMyInterns,
  updateMyIntern,
  deleteMyIntern,
  updateMyInternPassword,
  reassignAndDeleteIntern,
  toggleBlockUser,
} from '../controllers/authController.js';
import { protect, admin, employee, employeeOrIntern } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.post('/setup-admin', setupAdmin);
router.put('/change-password', protect, changePassword);

router.route('/employees')
  .post(protect, admin, createEmployee)
  .get(protect, admin, getEmployees);

router.route('/employees/:id')
  .put(protect, admin, updateEmployee)
  .delete(protect, admin, deleteEmployee);

router.route('/employees/:id/password')
  .put(protect, admin, updateEmployeePassword);

router.route('/employees/:id/toggle-block')
  .put(protect, admin, toggleBlockUser);

// Generic User Toggle Block
router.route('/users/:id/toggle-block')
  .put(protect, employeeOrIntern, toggleBlockUser);

// Employee Intern Management
router.route('/my-interns')
  .post(protect, employee, createIntern)
  .get(protect, employeeOrIntern, getMyInterns);

router.route('/my-interns/:id')
  .put(protect, employee, updateMyIntern)
  .delete(protect, employee, deleteMyIntern);

router.route('/my-interns/:id/toggle-block')
  .put(protect, employeeOrIntern, toggleBlockUser);

router.route('/my-interns/:id/reassign-and-delete')
  .post(protect, employee, reassignAndDeleteIntern);

router.route('/my-interns/:id/password')
  .put(protect, employee, updateMyInternPassword);

export default router;
