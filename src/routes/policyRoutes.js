const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy
} = require('../controllers/policyController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getPolicies);
router.get('/all', protect, getPolicies);
router.get('/list', protect, getPolicies);
router.get('/:id', protect, getPolicy);

router.post('/', protect, authorize('admin', 'hr'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('policy_type').isIn(['hr', 'company', 'employee', 'manager', 'sales', 'team']).withMessage('Invalid policy type'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
], createPolicy);

router.put('/:id', protect, authorize('admin', 'hr'), [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('policy_type').optional().isIn(['hr', 'company', 'employee', 'manager', 'sales', 'team']).withMessage('Invalid policy type'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
], updatePolicy);

router.delete('/:id', protect, authorize('admin', 'hr'), deletePolicy);

module.exports = router;
