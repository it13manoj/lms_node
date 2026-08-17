const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

// @desc    Request leave
// @route   POST /api/leave/request
// @access  Private
const requestLeave = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const { leave_type, start_date, end_date, reason } = req.body;
        
        // Calculate total days
        const start = new Date(start_date);
        const end = new Date(end_date);
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        const leave = await Leave.create({
            employee_id: employee.id,
            leave_type,
            start_date,
            end_date,
            total_days: totalDays,
            reason,
            status: 'pending'
        });

        res.status(201).json({
            success: true,
            message: 'Leave request submitted successfully',
            data: leave
        });
    } catch (error) {
        console.error('Request leave error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get leave balance
// @route   GET /api/leave/balance
// @access  Private
const getLeaveBalance = async (req, res) => {
    try {
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Calculate leave balances
        const currentYear = new Date().getFullYear();
        const leaves = await Leave.findAll({
            where: {
                employee_id: employee.id,
                status: 'approved',
                [Op.and]: [
                    { start_date: { [Op.gte]: `${currentYear}-01-01` } },
                    { end_date: { [Op.lte]: `${currentYear}-12-31` } }
                ]
            }
        });

        const usedLeaves = leaves.reduce((total, leave) => total + leave.total_days, 0);

        const balance = {
            annual: { total: 20, used: 0, remaining: 20 },
            sick: { total: 10, used: 0, remaining: 10 },
            casual: { total: 5, used: 0, remaining: 5 },
            used: usedLeaves
        };

        // Calculate used per type
        leaves.forEach(leave => {
            if (balance[leave.leave_type]) {
                balance[leave.leave_type].used += leave.total_days;
                balance[leave.leave_type].remaining = balance[leave.leave_type].total - balance[leave.leave_type].used;
            }
        });

        res.json({
            success: true,
            data: balance
        });
    } catch (error) {
        console.error('Get leave balance error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get leave history
// @route   GET /api/leave/history
// @access  Private
const getLeaveHistory = async (req, res) => {
    try {
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const leaves = await Leave.findAll({
            where: { employee_id: employee.id },
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: leaves
        });
    } catch (error) {
        console.error('Get leave history error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add this function to your existing leaveController.js

// @desc    Cancel leave request
// @route   PUT /api/leave/:id/cancel
// @access  Private
const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ 
        message: 'Please provide a detailed reason for cancellation (minimum 10 characters)' 
      });
    }

    const leave = await Leave.findByPk(id, {
      include: [{
        model: Employee,
        include: [{
          model: User,
          attributes: ['id', 'role']
        }]
      }]
    });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Check if leave can be cancelled
    if (leave.status !== 'pending') {
      return res.status(400).json({ 
        message: `Cannot cancel leave request with status: ${leave.status}` 
      });
    }

    // Check if user is authorized to cancel this leave
    const user = req.user;
    const isRequester = leave.Employee.user_id === user.id;
    const isAdminOrHR = user.role === 'admin' || user.role === 'hr';

    if (!isRequester && !isAdminOrHR) {
      return res.status(403).json({ 
        message: 'You are not authorized to cancel this leave request' 
      });
    }

    // Check if leave start date is too close (e.g., within 24 hours)
    const startDate = new Date(leave.start_date);
    const now = new Date();
    const hoursUntilStart = (startDate - now) / (1000 * 60 * 60);
    
    if (hoursUntilStart < 24 && !isAdminOrHR) {
      return res.status(400).json({ 
        message: 'Cannot cancel leave request within 24 hours of start date. Please contact HR.' 
      });
    }

    // Update leave status
    await leave.update({
      status: 'cancelled',
      cancellation_reason: reason,
      cancelled_by: user.id,
      cancelled_at: new Date()
    });

    // Log cancellation (you can implement a logs table if needed)
    console.log(`Leave request ${id} cancelled by user ${user.id}. Reason: ${reason}`);

    res.json({
      success: true,
      message: 'Leave request cancelled successfully',
      data: leave
    });
  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get leaves with filters (for cancel view)
// @route   GET /api/leave
// @access  Private
const getLeaves = async (req, res) => {
  try {
    const { status, leave_type, dateFrom, dateTo, search } = req.query;
    
    const where = {};
    
    // If user is not admin/hr, only show their own leaves
    if (req.user.role !== 'admin' && req.user.role !== 'hr') {
      const employee = await Employee.findOne({
        where: { user_id: req.user.id }
      });
      if (employee) {
        where.employee_id = employee.id;
      }
    }

    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (leave_type) {
      where.leave_type = leave_type;
    }
    
    if (dateFrom) {
      where.start_date = { [Op.gte]: dateFrom };
    }
    
    if (dateTo) {
      where.end_date = { [Op.lte]: dateTo };
    }

    // Search functionality
    let employeeWhere = {};
    if (search) {
      employeeWhere = {
        [Op.or]: [
          { first_name: { [Op.like]: `%${search}%` } },
          { last_name: { [Op.like]: `%${search}%` } },
          { employee_id: { [Op.like]: `%${search}%` } }
        ]
      };
    }

    const leaves = await Leave.findAll({
      where,
      include: [{
        model: Employee,
        where: employeeWhere,
        attributes: ['id', 'first_name', 'last_name', 'employee_id']
      }],
      order: [['created_at', 'DESC']]
    });

    // Format response
    const formattedLeaves = leaves.map(leave => ({
      ...leave.toJSON(),
      employee_name: leave.Employee ? 
        `${leave.Employee.first_name} ${leave.Employee.last_name}` : 
        'Unknown Employee'
    }));

    res.json({
      success: true,
      data: formattedLeaves
    });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
// Add these new functions

// @desc    Get leaves for calendar view
// @route   GET /api/leave/calendar
// @access  Private
const getLeaveCalendar = async (req, res) => {
    try {
        const { month, year } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const where = {
            [Op.or]: [
                {
                    start_date: {
                        [Op.between]: [startDate, endDate]
                    }
                },
                {
                    end_date: {
                        [Op.between]: [startDate, endDate]
                    }
                }
            ]
        };

        // If not admin/hr, only show own leaves
        if (req.user.role !== 'admin' && req.user.role !== 'hr') {
            const employee = await Employee.findOne({
                where: { user_id: req.user.id }
            });
            if (employee) {
                where.employee_id = employee.id;
            }
        }

        const leaves = await Leave.findAll({
            where,
            include: [{
                model: Employee,
                attributes: ['id', 'first_name', 'last_name', 'employee_id']
            }],
            order: [['start_date', 'ASC']]
        });

        const formattedLeaves = leaves.map(leave => ({
            ...leave.toJSON(),
            employee_name: leave.Employee ? 
                `${leave.Employee.first_name} ${leave.Employee.last_name}` : 
                'Unknown Employee'
        }));

        res.json({
            success: true,
            data: formattedLeaves
        });
    } catch (error) {
        console.error('Get leave calendar error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update leave status (approve/reject)
// @route   PUT /api/leave/:id
// @access  Private (Admin/HR only)
const updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        const leave = await Leave.findByPk(id);
        if (!leave) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        if (leave.status !== 'pending') {
            return res.status(400).json({ 
                message: `Cannot update leave request with status: ${leave.status}` 
            });
        }

        await leave.update({
            status,
            approved_by: req.user.id,
            approved_at: new Date(),
            ...(status === 'rejected' && { rejection_reason: reason })
        });

        // Send notification (implement email notification if needed)
        // await sendLeaveStatusNotification(leave, status);

        res.json({
            success: true,
            message: `Leave request ${status}`,
            data: leave
        });
    } catch (error) {
        console.error('Update leave status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
module.exports = {
  requestLeave,
  getLeaveBalance,
  getLeaveHistory,
  cancelLeave,
  getLeaves,
  getLeaveCalendar,
  updateLeaveStatus
};

