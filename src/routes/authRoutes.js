const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { 
    login, 
    register, 
    getMe,
    getUserByEmail,
    updatePassword,
    resetPassword,
    changePassword,
    verifyPassword
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.post('/login', [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], login);

// Protected routes - all users
router.get('/me', protect, getMe);

// Update password - using put
router.put('/update-password', protect, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword').notEmpty().withMessage('Please confirm your password')
], updatePassword);

// Change password - using put
router.put('/change-password', protect, [
    body('oldPassword').notEmpty().withMessage('Old password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], changePassword);

// Verify password - using post
router.post('/verify-password', protect, [
    body('password').notEmpty().withMessage('Password is required')
], verifyPassword);

// Admin & HR only routes
router.post('/register', protect, authorize('admin', 'hr'), [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('employeeData.first_name').notEmpty().withMessage('First name is required'),
    body('employeeData.last_name').notEmpty().withMessage('Last name is required')
], register);

// Reset password - using post
router.post('/reset-password', protect, authorize('admin', 'hr'), [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], resetPassword);

// Admin only routes
router.get('/user/:email', protect, authorize('admin'), getUserByEmail);

module.exports = router;