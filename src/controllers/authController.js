const User = require('../models/User');
const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { generateEmployeeIdFromUser } = require('../utils/employeeIdGenerator');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        
        const user = await User.findOne({ 
            where: { email },
            include: [{
                model: Employee,
                attributes: ['id', 'first_name', 'last_name', 'employee_id', 'department', 'position']
            }]
        });
        //   user.password = password;
        // await user.save();
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.status === 'inactive') {
            return res.status(401).json({ message: 'Account is deactivated' });
        }
        
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user.id);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                employee: user.Employee
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Private (Admin/HR)
const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, role, employeeData } = req.body;
        
        // Check if user exists
        const userExists = await User.findOne({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const transaction = await sequelize.transaction();

        try {
            // Create user
            const user = await User.create({
                email,
                password,
                role: role || 'employee',
                status: 'active'
            }, { transaction });

            // Generate Employee ID with user_id
            const employeeId = generateEmployeeIdFromUser(user.id);

            // Create employee profile
            const employee = await Employee.create({
                user_id: user.id,
                employee_id: employeeId,
                first_name: employeeData.first_name,
                last_name: employeeData.last_name,
                email: employeeData.email,
                phone: employeeData.phone || null,
                department: employeeData.department || null,
                position: employeeData.position || null,
                joining_date: employeeData.joining_date || new Date(),
                salary: employeeData.salary || null,
                address: employeeData.address || null,
                emergency_contact: employeeData.emergency_contact || null,
                bank_account: employeeData.bank_account || null
            }, { transaction });

            await transaction.commit();

            res.status(201).json({
                success: true,
                message: 'Employee registered successfully',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role
                    },
                    employee: {
                        id: employee.id,
                        employee_id: employee.employee_id,
                        first_name: employee.first_name,
                        last_name: employee.last_name,
                        email: employee.email,
                        joining_date: employee.joining_date
                    }
                }
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] },
            include: [{
                model: Employee
            }]
        });
        
        res.json(user);
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get user by email
// @route   GET /api/auth/user/:email
// @access  Private (Admin only)
const getUserByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        
        if (req.user.role !== 'admin' && req.user.email !== email) {
            return res.status(403).json({ 
                message: 'You can only view your own user information' 
            });
        }

        const user = await User.findOne({
            where: { email },
            attributes: { exclude: ['password'] },
            include: [{
                model: Employee,
                attributes: ['id', 'first_name', 'last_name', 'employee_id', 'department', 'position']
            }]
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
const updatePassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ 
                message: 'Please provide current password, new password, and confirmation' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                message: 'New password must be at least 6 characters long' 
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ 
                message: 'New password and confirmation do not match' 
            });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reset password (Admin/HR only)
// @route   POST /api/auth/reset-password
// @access  Private (Admin/HR)
const resetPassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, newPassword } = req.body;

        if (req.user.role !== 'admin' && req.user.role !== 'hr') {
            return res.status(403).json({ 
                message: 'Only admin and HR can reset passwords' 
            });
        }

        if (!email || !newPassword) {
            return res.status(400).json({ 
                message: 'Please provide email and new password' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                message: 'New password must be at least 6 characters long' 
            });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: `Password reset successfully for ${email}`
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Change password (self-service)
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ 
                message: 'Please provide old and new password' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                message: 'New password must be at least 6 characters long' 
            });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await user.matchPassword(oldPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Old password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Verify password
// @route   POST /api/auth/verify-password
// @access  Private
const verifyPassword = async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ message: 'Please provide password' });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await user.matchPassword(password);

        res.json({
            success: true,
            valid: isMatch,
            message: isMatch ? 'Password is correct' : 'Password is incorrect'
        });
    } catch (error) {
        console.error('Verify password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Make sure all functions are exported
module.exports = { 
    login, 
    register, 
    getMe,
    getUserByEmail,
    updatePassword,
    resetPassword,
    changePassword,
    verifyPassword
};