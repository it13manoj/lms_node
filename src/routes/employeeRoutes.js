const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
    getEmployees,
    getEmployee,
    updateEmployee,
    deleteEmployee,
    restoreEmployee,
    permanentDeleteEmployee,
    getEmployeeStats,
    getDeletedEmployees,
    getEmployeesDropdown
} = require('../controllers/employeeController');
const { 
    protect, 
    authorize, 
    isAdminOrHR, 
    isAdminOrHRorManager,
    canAccessEmployeeData 
} = require('../middleware/auth');

// Routes with role-based access

// Get all employees - Admin, HR, Manager
router.get('/', protect, authorize('admin', 'hr', 'manager'), getEmployees);

// Get deleted employees - Admin, HR only
router.get('/deleted', protect, authorize('admin', 'hr'), getDeletedEmployees);

// Get employees dropdown - All authenticated users
router.get('/dropdown', protect, getEmployeesDropdown);

// Get employee stats - Admin, HR only
router.get('/stats', protect, authorize('admin', 'hr'), getEmployeeStats);

// Get single employee - All authenticated users (with restrictions)
router.get('/:id', protect, canAccessEmployeeData, getEmployee);

// Update employee - Admin, HR only
router.put('/:id', protect, authorize('admin', 'hr'), [
    body('email').optional().isEmail().withMessage('Please provide a valid email')
], updateEmployee);

// Soft delete employee - Admin only
router.delete('/:id', protect, authorize('admin'), deleteEmployee);

// Restore soft deleted employee - Admin, HR only
router.post('/:id/restore', protect, authorize('admin', 'hr'), restoreEmployee);

// Permanent delete employee - Admin only
router.delete('/:id/permanent', protect, authorize('admin'), permanentDeleteEmployee);

module.exports = router;