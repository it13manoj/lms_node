const express = require('express');
const router = express.Router();
const {
  getSalarySlip,
  generateSalary,
  paySalary,
  approveSalary,
  getSalaryHistory,
  getSalaries
} = require('../controllers/salaryController');
const { protect, authorize } = require('../middleware/auth');

// Get dynamic Salary Slip (with attendance & 1 paid leave deduction)
// Accessible by Admin/HR for any employee, or by regular Employee for their own slip
router.get('/slip', protect, getSalarySlip);

// Fallback: alias / for slip or list based on query
router.get('/details', protect, getSalarySlip);

// Generate / save / finalize salary slip in database
router.post('/generate', protect, authorize('admin', 'hr'), generateSalary);

// Approve salary slip (Admin / HR)
router.post('/approve/:id', protect, authorize('admin', 'hr'), approveSalary);

// Mark salary as paid
router.post('/pay/:id', protect, authorize('admin', 'hr'), paySalary);

// Salary History
router.get('/history', protect, getSalaryHistory);

// List all salaries (Admin/HR/Manager overview)
router.get('/', protect, authorize('admin', 'hr', 'manager'), getSalaries);

module.exports = router;
