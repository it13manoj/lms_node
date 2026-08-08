const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
    requestLeave,
    getLeaveBalance,
    getLeaveHistory,
    cancelLeave,
    getLeaves,
    getLeaveCalendar,
    updateLeaveStatus
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');

// Get all leaves with filters
router.get('/', protect, getLeaves);
router.get('/list', protect, getLeaves);
router.get('/calendar', protect, getLeaveCalendar);
router.get('/balance', protect, getLeaveBalance);
router.get('/history', protect, getLeaveHistory);

// Create leave request
router.post('/request', protect, [
    body('leave_type').isIn(['annual', 'sick', 'casual', 'maternity', 'paternity', 'other']),
    body('start_date').isDate(),
    body('end_date').isDate(),
    body('reason').notEmpty().isLength({ min: 10 })
], requestLeave);

// Update leave status (approve/reject)
router.put('/:id', protect, authorize('admin', 'hr'), [
    body('status').isIn(['approved', 'rejected'])
], updateLeaveStatus);

// Cancel leave
router.put('/:id/cancel', protect, [
    body('reason').notEmpty().isLength({ min: 10 })
], cancelLeave);

module.exports = router;