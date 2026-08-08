const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { Op } = require('sequelize');
const moment = require('moment');

// @desc    Check in
// @route   POST /api/attendance/check-in
// @access  Private
const checkIn = async (req, res) => {
    try {
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const today = moment().format('YYYY-MM-DD');
        const existingAttendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        if (existingAttendance && existingAttendance.check_in) {
            return res.status(400).json({ message: 'Already checked in today' });
        }

        const attendance = await Attendance.create({
            employee_id: employee.id,
            date: today,
            check_in: moment().format('HH:mm:ss'),
            status: 'present'
        });

        res.json({
            success: true,
            message: 'Checked in successfully',
            data: attendance
        });
    } catch (error) {
        console.error('Check in error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Check out
// @route   POST /api/attendance/check-out
// @access  Private
const checkOut = async (req, res) => {
    try {
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const today = moment().format('YYYY-MM-DD');
        const attendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        if (!attendance) {
            return res.status(404).json({ message: 'No check-in found for today' });
        }

        if (attendance.check_out) {
            return res.status(400).json({ message: 'Already checked out' });
        }

        const checkOutTime = moment().format('HH:mm:ss');
        const checkInTime = moment(attendance.check_in, 'HH:mm:ss');
        const checkOutMoment = moment(checkOutTime, 'HH:mm:ss');
        const workingHours = checkOutMoment.diff(checkInTime, 'hours', true);

        await attendance.update({
            check_out: checkOutTime,
            working_hours: parseFloat(workingHours.toFixed(2))
        });

        res.json({
            success: true,
            message: 'Checked out successfully',
            data: attendance
        });
    } catch (error) {
        console.error('Check out error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get attendance stats
// @route   GET /api/attendance/stats
// @access  Private
const getAttendanceStats = async (req, res) => {
    try {
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const today = moment().format('YYYY-MM-DD');
        const todayAttendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        const monthStart = moment().startOf('month').format('YYYY-MM-DD');
        const monthEnd = moment().endOf('month').format('YYYY-MM-DD');
        const monthlyAttendance = await Attendance.findAll({
            where: {
                employee_id: employee.id,
                date: {
                    [Op.between]: [monthStart, monthEnd]
                }
            }
        });

        const monthlyStats = {
            present: 0,
            absent: 0,
            late: 0,
            'half-day': 0
        };

        monthlyAttendance.forEach(record => {
            if (monthlyStats[record.status] !== undefined) {
                monthlyStats[record.status]++;
            }
        });

        const todayStatus = todayAttendance ? 
            (todayAttendance.check_out ? 'checked-out' : 'checked-in') : 
            'not-checked-in';

        res.json({
            success: true,
            data: {
                todayStatus,
                checkInTime: todayAttendance?.check_in || null,
                checkOutTime: todayAttendance?.check_out || null,
                monthlyStats
            }
        });
    } catch (error) {
        console.error('Get attendance stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { checkIn, checkOut, getAttendanceStats };