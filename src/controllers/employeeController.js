const Employee = require('../models/Employee');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

// @desc    Get all employees (excluding soft deleted)
// @route   GET /api/employees
// @access  Private (Admin/HR)
const getEmployees = async (req, res) => {
    try {
        const { department, search, page = 1, limit = 10, includeDeleted = false } = req.query;
        const offset = (page - 1) * limit;
        
        const where = {};
        if (department) where.department = department;
        if (search) {
            where[Op.or] = [
                { first_name: { [Op.like]: `%${search}%` } },
                { last_name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { employee_id: { [Op.like]: `%${search}%` } }
            ];
        }

        // If includeDeleted is true, include soft deleted records
        const options = {
            where,
            include: [{
                model: User,
                attributes: ['id', 'email', 'role', 'status'],
                paranoid: includeDeleted === 'true' ? false : true
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            paranoid: includeDeleted !== 'true'
        };

        const { count, rows } = await Employee.findAndCountAll(options);

        res.json({
            success: true,
            data: rows,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private
const getEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByPk(req.params.id, {
            include: [{
                model: User,
                attributes: ['id', 'email', 'role', 'status'],
                paranoid: false // Allow viewing even if soft deleted
            }],
            paranoid: false // Allow viewing even if soft deleted
        });

        if (!employee) {
            return res.status(404).json({ 
                success: false,
                message: 'Employee not found' 
            });
        }

        // Check access rights
        const userRole = req.user.role;
        if (userRole !== 'admin' && userRole !== 'hr') {
            const currentEmployee = await Employee.findOne({
                where: { user_id: req.user.id }
            });
            if (!currentEmployee || currentEmployee.id !== parseInt(req.params.id)) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Access denied. You can only view your own profile.' 
                });
            }
        }

        res.json({
            success: true,
            data: employee
        });
    } catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private (Admin/HR)
const updateEmployee = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false,
                errors: errors.array() 
            });
        }

        const employee = await Employee.findByPk(req.params.id, {
            paranoid: false // Allow updating even if soft deleted
        });
        
        if (!employee) {
            return res.status(404).json({ 
                success: false,
                message: 'Employee not found' 
            });
        }

        const { 
            first_name, last_name, email, phone, department, 
            position, salary, address, emergency_contact, bank_account 
        } = req.body;

        // Update employee
        await employee.update({
            first_name: first_name || employee.first_name,
            last_name: last_name || employee.last_name,
            email: email || employee.email,
            phone: phone || employee.phone,
            department: department || employee.department,
            position: position || employee.position,
            salary: salary || employee.salary,
            address: address || employee.address,
            emergency_contact: emergency_contact || employee.emergency_contact,
            bank_account: bank_account || employee.bank_account
        });

        // Update user email if changed
        if (email && email !== employee.email) {
            await User.update(
                { email },
                { where: { id: employee.user_id } }
            );
        }

        res.json({
            success: true,
            message: 'Employee updated successfully',
            data: employee
        });
    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Soft delete employee
// @route   DELETE /api/employees/:id
// @access  Private (Admin)
const deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByPk(req.params.id);
        if (!employee) {
            return res.status(404).json({ 
                success: false,
                message: 'Employee not found' 
            });
        }

        const user = await User.findByPk(employee.user_id);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Start transaction
        const transaction = await sequelize.transaction();

        try {
            // Soft delete employee
            await employee.destroy({ transaction });
            
            // Soft delete user (this will trigger paranoid delete)
            await user.destroy({ transaction });

            await transaction.commit();

            res.json({
                success: true,
                message: 'Employee deleted successfully (soft delete)',
                data: {
                    employee_id: employee.id,
                    user_id: user.id,
                    deleted_at: new Date()
                }
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Restore soft deleted employee
// @route   POST /api/employees/:id/restore
// @access  Private (Admin)
const restoreEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByPk(req.params.id, {
            paranoid: false // Include soft deleted
        });
        
        if (!employee) {
            return res.status(404).json({ 
                success: false,
                message: 'Employee not found' 
            });
        }

        if (!employee.deleted_at) {
            return res.status(400).json({ 
                success: false,
                message: 'Employee is not deleted' 
            });
        }

        const user = await User.findByPk(employee.user_id, {
            paranoid: false // Include soft deleted
        });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Start transaction
        const transaction = await sequelize.transaction();

        try {
            // Restore employee
            await employee.restore({ transaction });
            
            // Restore user
            await user.restore({ transaction });

            await transaction.commit();

            res.json({
                success: true,
                message: 'Employee restored successfully',
                data: employee
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Restore employee error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Permanent delete employee (hard delete)
// @route   DELETE /api/employees/:id/permanent
// @access  Private (Admin only)
const permanentDeleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByPk(req.params.id, {
            paranoid: false // Include soft deleted
        });
        
        if (!employee) {
            return res.status(404).json({ 
                success: false,
                message: 'Employee not found' 
            });
        }

        const user = await User.findByPk(employee.user_id, {
            paranoid: false // Include soft deleted
        });

        // Start transaction
        const transaction = await sequelize.transaction();

        try {
            // Hard delete employee
            await employee.destroy({ 
                force: true, // Permanent delete
                transaction 
            });
            
            // Hard delete user
            await user.destroy({ 
                force: true, // Permanent delete
                transaction 
            });

            await transaction.commit();

            res.json({
                success: true,
                message: 'Employee permanently deleted'
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Permanent delete employee error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Get employee statistics
// @route   GET /api/employees/stats
// @access  Private (Admin/HR)
const getEmployeeStats = async (req, res) => {
    try {
        // Count active employees (not soft deleted)
        const totalEmployees = await Employee.count();
        
        // Count deleted employees
        const deletedEmployees = await Employee.count({
            paranoid: false,
            where: {
                deleted_at: { [Op.ne]: null }
            }
        });

        // Department stats for active employees
        const departmentStats = await Employee.findAll({
            attributes: [
                'department',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['department']
        });

        const activeUsers = await User.count({
            where: { status: 'active' }
        });

        // Department distribution
        const departmentDistribution = departmentStats.map(item => ({
            department: item.department || 'Unassigned',
            count: parseInt(item.dataValues.count)
        }));

        res.json({
            success: true,
            data: {
                totalEmployees,
                deletedEmployees,
                activeEmployees: totalEmployees - deletedEmployees,
                activeUsers,
                departmentStats: departmentDistribution
            }
        });
    } catch (error) {
        console.error('Get employee stats error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Get deleted employees
// @route   GET /api/employees/deleted
// @access  Private (Admin/HR)
const getDeletedEmployees = async (req, res) => {
    try {
        const employees = await Employee.findAll({
            paranoid: false,
            where: {
                deleted_at: { [Op.ne]: null }
            },
            include: [{
                model: User,
                attributes: ['id', 'email', 'role', 'status'],
                paranoid: false
            }],
            order: [['deleted_at', 'DESC']]
        });

        res.json({
            success: true,
            data: employees
        });
    } catch (error) {
        console.error('Get deleted employees error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Get employees dropdown (for selects)
// @route   GET /api/employees/dropdown
// @access  Private
const getEmployeesDropdown = async (req, res) => {
    try {
        const employees = await Employee.findAll({
            attributes: ['id', 'first_name', 'last_name', 'employee_id', 'email', 'department'],
            include: [{
                model: User,
                attributes: ['status'],
                where: { status: 'active' }
            }],
            order: [['first_name', 'ASC']]
        });

        res.json({
            success: true,
            data: employees
        });
    } catch (error) {
        console.error('Get employees dropdown error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Get leave history for a specific employee
// @route   GET /api/employees/:id/leaves
// @access  Private
const getEmployeeLeaves = async (req, res) => {
    try {
        const { id } = req.params;
        const Leave = require('../models/Leave');
        const leaves = await Leave.findAll({
            where: { employee_id: id },
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: leaves
        });
    } catch (error) {
        console.error('Get employee leaves error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error', 
            error: error.message 
        });
    }
};

// @desc    Get attendance history for a specific employee
// @route   GET /api/employees/:id/attendance
// @access  Private
const getEmployeeAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const Attendance = require('../models/Attendance');
        const employee = await Employee.findByPk(id);

        const where = {};
        if (employee) {
            where[Op.or] = [
                { employee_id: employee.id },
                { job_no: employee.employee_id },
                { employee_name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() }
            ];
        } else {
            where.employee_id = id;
        }

        const attendance = await Attendance.findAll({
            where,
            order: [['date', 'DESC']],
            limit: 60
        });

        res.json({
            success: true,
            data: attendance
        });
    } catch (error) {
        console.error('Get employee attendance error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error', 
            error: error.message 
        });
    }
};

module.exports = { 
    getEmployees, 
    getEmployee, 
    updateEmployee, 
    deleteEmployee,
    restoreEmployee,
    permanentDeleteEmployee,
    getEmployeeStats,
    getDeletedEmployees,
    getEmployeesDropdown,
    getEmployeeLeaves,
    getEmployeeAttendance
};