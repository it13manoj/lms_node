const Salary = require('../models/Salary');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const { Op } = require('sequelize');
const moment = require('moment');

// Helper to convert numbers to Indian / International words
const numberToWords = (num) => {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
  
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    let str = '';
    if (n >= 10000000) {
      str += inWords(Math.floor(n / 10000000)) + 'Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += inWords(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += inWords(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += inWords(Math.floor(n / 100)) + 'Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += 'and ';
      if (n < 20) {
        str += a[n];
      } else {
        str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
      }
    }
    return str;
  };

  const wholeNumber = Math.floor(num);
  const decimals = Math.round((num - wholeNumber) * 100);

  let result = inWords(wholeNumber).trim() + ' Rupees';
  if (decimals > 0) {
    result += ' and ' + inWords(decimals).trim() + ' Paise';
  }
  return result + ' Only';
};

/**
 * Helper to calculate dynamic salary and attendance deductions for an employee in a given month.
 * Rule:
 * 1. Base salary comes dynamically from Employee profile (employee.salary).
 * 2. 1 Paid Leave is provided per month.
 * 3. Any absent days beyond 1 paid leave are deducted day-wise:
 *    deduction = unpaid_absent_days * (base_salary / total_days_in_month)
 */
const calculateEmployeeMonthlySalary = async (employee, year, month) => {
  const baseSalary = parseFloat(employee.salary || 0);

  // Month date range
  const startDate = moment([year, month - 1, 1]);
  const endDate = moment([year, month - 1]).endOf('month');
  const totalDaysInMonth = endDate.date();
  const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthYearDate = `${monthYearStr}-01`;

  // 1. Fetch attendance punches for this employee in this month
  const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
  const cleanJob = (employee.employee_id || '').trim().toLowerCase();

  const punches = await Attendance.findAll({
    where: {
      date: {
        [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
      },
      [Op.or]: [
        { employee_id: employee.id },
        { job_no: employee.employee_id },
        { employee_name: fullName }
      ]
    }
  });

  const punchByDate = new Map();
  punches.forEach(p => {
    if (p.date) punchByDate.set(p.date, p);
  });

  // 2. Fetch official holidays in this month
  let holidays = [];
  try {
    holidays = await Holiday.findAll({
      where: {
        holiday_date: {
          [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
        }
      }
    });
  } catch (err) {}

  const holidayByDate = new Map();
  holidays.forEach(h => {
    if (h.holiday_date) holidayByDate.set(h.holiday_date, h);
  });

  // 3. Day by day audit of the month
  let cur = moment(startDate);
  let presentDays = 0;
  let absentDays = 0;
  let weekendDays = 0;
  let holidayDays = 0;
  let lateDays = 0;
  let earlyLeaveDays = 0;
  let totalWorkingHours = 0;

  const dayLogs = [];

  while (cur.isSameOrBefore(endDate)) {
    const dateStr = cur.format('YYYY-MM-DD');
    const isSunday = cur.day() === 0;
    const punch = punchByDate.get(dateStr);
    const holiday = holidayByDate.get(dateStr);

    if (punch) {
      presentDays++;
      const wHours = parseFloat(punch.working_hours || 0);
      totalWorkingHours += wHours;
      if (punch.late_minutes > 0) lateDays++;
      if (punch.early_leave_minutes > 0) earlyLeaveDays++;

      dayLogs.push({
        date: dateStr,
        day: cur.format('ddd'),
        status: 'present',
        check_in: punch.check_in,
        check_out: punch.check_out,
        working_hours: wHours,
        remarks: punch.remarks || 'Present'
      });
    } else if (holiday) {
      holidayDays++;
      dayLogs.push({
        date: dateStr,
        day: cur.format('ddd'),
        status: 'holiday',
        holiday_name: holiday.holiday_name,
        remarks: `Holiday: ${holiday.holiday_name}`
      });
    } else if (isSunday) {
      weekendDays++;
      dayLogs.push({
        date: dateStr,
        day: cur.format('ddd'),
        status: 'weekend',
        remarks: 'Weekly Off'
      });
    } else {
      absentDays++;
      dayLogs.push({
        date: dateStr,
        day: cur.format('ddd'),
        status: 'absent',
        remarks: 'Absent (No Punch)'
      });
    }

    cur.add(1, 'day');
  }

  const workingDaysInMonth = totalDaysInMonth - weekendDays - holidayDays;

  // 4. Paid Leave Policy (1 Paid Leave Only provided)
  // Rule:
  // - All Sundays (Weekly Off) are fully paid days ("Sunday have make salary")
  // - All Official Holidays are fully paid days
  // - 1 Absent day is covered by company paid leave with ZERO deduction
  // - Only working absent days exceeding 1 paid leave are deducted as Loss of Pay (LOP)
  const paidLeavesAllowed = 1;
  const paidLeavesUsed = absentDays > 0 ? Math.min(paidLeavesAllowed, absentDays) : 0;
  const unpaidAbsentDays = Math.max(0, absentDays - paidLeavesUsed);

  // Total Paid Days in month = Present Days + Sundays + Holidays + 1 Paid Leave
  const totalPaidDays = presentDays + weekendDays + holidayDays + paidLeavesUsed;

  // 5. Per Day Salary & Absent Deduction calculation
  const perDaySalary = totalDaysInMonth > 0 ? Number((baseSalary / totalDaysInMonth).toFixed(2)) : 0;
  
  // Exact day-wise deduction for unexcused working absent days beyond 1 paid leave
  const absentDeduction = totalDaysInMonth > 0 
    ? Number(((unpaidAbsentDays * baseSalary) / totalDaysInMonth).toFixed(2))
    : 0;

  const sundaySalary = totalDaysInMonth > 0
    ? Number(((weekendDays * baseSalary) / totalDaysInMonth).toFixed(2))
    : 0;
  const paidLeaveSalary = totalDaysInMonth > 0
    ? Number(((paidLeavesUsed * baseSalary) / totalDaysInMonth).toFixed(2))
    : 0;

  // 6. Earnings Breakdown (Standard Payroll Structure)
  const basicSalary = Number((baseSalary * 0.50).toFixed(2));
  const hra = Number((baseSalary * 0.30).toFixed(2));
  const conveyance = Number((baseSalary * 0.10).toFixed(2));
  const specialAllowance = Number((baseSalary - basicSalary - hra - conveyance).toFixed(2));
  const totalEarnings = baseSalary;

  // Net payable calculation (Base salary minus unpaid absent deduction)
  const netSalary = Math.max(0, Number((totalEarnings - absentDeduction).toFixed(2)));

  return {
    monthYearStr,
    monthYearDate,
    monthName: moment([year, month - 1, 1]).format('MMMM YYYY'),
    year: parseInt(year, 10),
    month: parseInt(month, 10),
    attendance: {
      totalDays: totalDaysInMonth,
      workingDays: workingDaysInMonth,
      weekendDays,
      sundayDays: weekendDays,
      holidayDays,
      presentDays,
      absentDays,
      lateDays,
      earlyLeaveDays,
      paidLeavesAllowed,
      paidLeavesUsed,
      unpaidAbsentDays,
      totalPaidDays,
      totalWorkingHours: Number(totalWorkingHours.toFixed(2))
    },
    salary: {
      baseSalary,
      perDaySalary,
      absentDeduction,
      sundaySalary,
      paidLeaveSalary,
      totalPaidDays,
      earnings: {
        basicSalary,
        hra,
        conveyance,
        specialAllowance,
        totalEarnings
      },
      deductions: {
        absentDeduction,
        otherDeductions: 0,
        totalDeductions: absentDeduction
      },
      bonus: 0,
      netSalary,
      netSalaryInWords: numberToWords(netSalary)
    },
    dayLogs
  };
};

// @desc    Get dynamic salary slip for an employee (calculates attendance & 1 paid leave deduction)
// @route   GET /api/salary/slip
// @access  Private
const getSalarySlip = async (req, res) => {
  try {
    let { employeeId, month, year, monthYear } = req.query;

    // Determine target employee based on role
    const isManagerial = ['admin', 'hr', 'manager'].includes(req.user?.role);
    let targetEmployee = null;

    if (!isManagerial && req.user) {
      targetEmployee = await Employee.findOne({
        where: { user_id: req.user.id }
      });
      if (!targetEmployee) {
        return res.status(404).json({ success: false, message: 'Employee profile not found' });
      }
    } else {
      if (employeeId) {
        targetEmployee = await Employee.findOne({
          where: {
            [Op.or]: [
              { id: employeeId },
              { employee_id: employeeId }
            ]
          }
        });
      } else {
        // If manager has an employee profile, default to own profile, otherwise first active employee
        if (req.user) {
          targetEmployee = await Employee.findOne({ where: { user_id: req.user.id } });
        }
        if (!targetEmployee) {
          targetEmployee = await Employee.findOne({ order: [['id', 'ASC']] });
        }
      }

      if (!targetEmployee) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }
    }

    // Determine target year & month
    let targetYear, targetMonth;
    if (monthYear) {
      const parts = monthYear.split('-');
      targetYear = parseInt(parts[0], 10);
      targetMonth = parseInt(parts[1], 10);
    } else if (year && month) {
      targetYear = parseInt(year, 10);
      targetMonth = parseInt(month, 10);
    } else {
      // Find latest month with attendance records for this employee or latest overall
      const latestAtt = await Attendance.findOne({
        where: {
          [Op.or]: [
            { employee_id: targetEmployee.id },
            { job_no: targetEmployee.employee_id }
          ]
        },
        order: [['date', 'DESC']]
      });
      if (latestAtt && latestAtt.date) {
        targetYear = year ? parseInt(year, 10) : parseInt(latestAtt.date.substring(0, 4), 10);
        targetMonth = month ? parseInt(month, 10) : parseInt(latestAtt.date.substring(5, 7), 10);
      } else {
        const now = new Date();
        targetYear = year ? parseInt(year, 10) : now.getFullYear();
        targetMonth = month ? parseInt(month, 10) : (now.getMonth() + 1);
      }
    }

    // Calculate dynamic salary and attendance deduction
    const calculation = await calculateEmployeeMonthlySalary(targetEmployee, targetYear, targetMonth);

    // Check if there is an existing finalized record in Salary table
    const savedRecord = await Salary.findOne({
      where: {
        employee_id: targetEmployee.id,
        month_year: calculation.monthYearDate
      }
    });

    // If a saved record exists, override status, payment date, custom bonus, etc.
    let finalSalaryData = { ...calculation.salary };
    let status = 'pending';
    let paymentDate = null;
    let paymentMethod = 'Bank Transfer';
    let salaryRecordId = null;
    let notes = '';

    if (savedRecord) {
      salaryRecordId = savedRecord.id;
      status = savedRecord.status || 'pending';
      paymentDate = savedRecord.payment_date || null;
      paymentMethod = savedRecord.payment_method || 'Bank Transfer';
      notes = savedRecord.notes || '';

      const bonus = parseFloat(savedRecord.bonus || 0);
      const otherDeductions = Math.max(0, parseFloat(savedRecord.deductions || 0) - calculation.salary.absentDeduction);

      finalSalaryData.bonus = bonus;
      finalSalaryData.deductions.otherDeductions = Number(otherDeductions.toFixed(2));
      finalSalaryData.deductions.totalDeductions = Number((calculation.salary.absentDeduction + otherDeductions).toFixed(2));
      finalSalaryData.earnings.totalEarnings = Number((calculation.salary.baseSalary + bonus).toFixed(2));
      finalSalaryData.netSalary = Math.max(0, Number((finalSalaryData.earnings.totalEarnings - finalSalaryData.deductions.totalDeductions).toFixed(2)));
      finalSalaryData.netSalaryInWords = numberToWords(finalSalaryData.netSalary);
    }

    // Fetch all active employees for quick switching dropdown (Admins/HR only)
    let employeesList = [];
    if (isManagerial) {
      employeesList = await Employee.findAll({
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'position', 'salary'],
        order: [['first_name', 'ASC']]
      });
    }

    res.json({
      success: true,
      data: {
        salaryRecordId,
        monthYearStr: calculation.monthYearStr,
        monthYearDate: calculation.monthYearDate,
        monthName: calculation.monthName,
        year: calculation.year,
        month: calculation.month,
        status,
        paymentDate,
        paymentMethod,
        notes,
        employee: {
          id: targetEmployee.id,
          employee_id: targetEmployee.employee_id,
          name: `${targetEmployee.first_name || ''} ${targetEmployee.last_name || ''}`.trim(),
          first_name: targetEmployee.first_name,
          last_name: targetEmployee.last_name,
          email: targetEmployee.email,
          phone: targetEmployee.phone || 'N/A',
          department: targetEmployee.department || 'General',
          position: targetEmployee.position || 'Staff',
          joining_date: targetEmployee.joining_date ? moment(targetEmployee.joining_date).format('DD MMM YYYY') : 'N/A',
          profile_salary: parseFloat(targetEmployee.salary || 0)
        },
        attendance: calculation.attendance,
        salary: finalSalaryData,
        employeesList
      }
    });
  } catch (error) {
    console.error('Error in getSalarySlip:', error);
    res.status(500).json({ success: false, message: 'Server error generating salary slip', error: error.message });
  }
};

// @desc    Generate or update finalized salary record for an employee in DB
// @route   POST /api/salary/generate
// @access  Private (Admin / HR)
const generateSalary = async (req, res) => {
  try {
    const { employee_id, year, month, month_year, bonus, other_deductions, payment_date, payment_method, status, notes } = req.body;

    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id is required' });
    }

    const employee = await Employee.findByPk(employee_id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    let targetYear, targetMonth;
    if (month_year) {
      const parts = month_year.split('-');
      targetYear = parseInt(parts[0], 10);
      targetMonth = parseInt(parts[1], 10);
    } else {
      const now = new Date();
      targetYear = year ? parseInt(year, 10) : now.getFullYear();
      targetMonth = month ? parseInt(month, 10) : (now.getMonth() + 1);
    }

    // Calculate dynamically from attendance & profile
    const calc = await calculateEmployeeMonthlySalary(employee, targetYear, targetMonth);

    const bonusAmount = parseFloat(bonus || 0);
    const extraDeductions = parseFloat(other_deductions || 0);
    const totalDeductions = Number((calc.salary.absentDeduction + extraDeductions).toFixed(2));
    const totalSalary = Number((calc.salary.baseSalary + bonusAmount).toFixed(2));
    const netSalary = Math.max(0, Number((totalSalary - totalDeductions).toFixed(2)));

    // Upsert into Salary table
    const [record, created] = await Salary.findOrCreate({
      where: {
        employee_id: employee.id,
        month_year: calc.monthYearDate
      },
      defaults: {
        employee_id: employee.id,
        month_year: calc.monthYearDate,
        basic_salary: calc.salary.earnings.basicSalary,
        allowances: Number((calc.salary.earnings.hra + calc.salary.earnings.conveyance + calc.salary.earnings.specialAllowance).toFixed(2)),
        deductions: totalDeductions,
        bonus: bonusAmount,
        total_salary: totalSalary,
        net_salary: netSalary,
        present_days: calc.attendance.presentDays,
        absent_days: calc.attendance.absentDays,
        paid_leaves: calc.attendance.paidLeavesUsed,
        unpaid_leaves: calc.attendance.unpaidAbsentDays,
        per_day_salary: calc.salary.perDaySalary,
        absent_deduction: calc.salary.absentDeduction,
        payment_date: payment_date || null,
        payment_method: payment_method || 'Bank Transfer',
        notes: notes || null,
        status: status || 'pending'
      }
    });

    if (!created) {
      await record.update({
        basic_salary: calc.salary.earnings.basicSalary,
        allowances: Number((calc.salary.earnings.hra + calc.salary.earnings.conveyance + calc.salary.earnings.specialAllowance).toFixed(2)),
        deductions: totalDeductions,
        bonus: bonusAmount,
        total_salary: totalSalary,
        net_salary: netSalary,
        present_days: calc.attendance.presentDays,
        absent_days: calc.attendance.absentDays,
        paid_leaves: calc.attendance.paidLeavesUsed,
        unpaid_leaves: calc.attendance.unpaidAbsentDays,
        per_day_salary: calc.salary.perDaySalary,
        absent_deduction: calc.salary.absentDeduction,
        payment_date: payment_date !== undefined ? payment_date : record.payment_date,
        payment_method: payment_method || record.payment_method,
        notes: notes !== undefined ? notes : record.notes,
        status: status || record.status
      });
    }

    res.json({
      success: true,
      message: created ? 'Salary slip generated successfully' : 'Salary slip updated successfully',
      data: record
    });
  } catch (error) {
    console.error('Error in generateSalary:', error);
    res.status(500).json({ success: false, message: 'Server error generating salary', error: error.message });
  }
};

// @desc    Mark salary as paid
// @route   POST /api/salary/pay/:id
// @access  Private (Admin / HR)
const paySalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_date, payment_method } = req.body;

    const salary = await Salary.findByPk(id);
    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found' });
    }

    await salary.update({
      status: 'paid',
      payment_date: payment_date || moment().format('YYYY-MM-DD'),
      payment_method: payment_method || salary.payment_method || 'Bank Transfer'
    });

    res.json({
      success: true,
      message: 'Salary marked as paid successfully',
      data: salary
    });
  } catch (error) {
    console.error('Error marking salary paid:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Approve salary slip (unlocks employee download)
// @route   POST /api/salary/approve/:id
// @access  Private (Admin / HR)
const approveSalary = async (req, res) => {
  try {
    const { id } = req.params;

    const salary = await Salary.findByPk(id);
    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found' });
    }

    await salary.update({
      status: 'approved'
    });

    res.json({
      success: true,
      message: 'Salary slip approved successfully by Admin',
      data: salary
    });
  } catch (error) {
    console.error('Error approving salary:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get salary history
// @route   GET /api/salary/history
// @access  Private
const getSalaryHistory = async (req, res) => {
  try {
    const { year, employee_id } = req.query;
    const isManagerial = ['admin', 'hr', 'manager'].includes(req.user?.role);

    let targetEmpId = employee_id;
    if (!isManagerial && req.user) {
      const currentEmp = await Employee.findOne({ where: { user_id: req.user.id } });
      targetEmpId = currentEmp ? currentEmp.id : null;
    }

    const where = {};
    if (targetEmpId) where.employee_id = targetEmpId;

    if (year) {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      where.month_year = { [Op.between]: [startOfYear, endOfYear] };
    }

    const records = await Salary.findAll({
      where,
      include: [{
        model: Employee,
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'position']
      }],
      order: [['month_year', 'DESC']]
    });

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('Error fetching salary history:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    List all salaries for management
// @route   GET /api/salary
// @access  Private (Admin / HR)
const getSalaries = async (req, res) => {
  try {
    const { employee_id, status, month_year, search } = req.query;

    const where = {};
    if (employee_id) where.employee_id = employee_id;
    if (status) where.status = status;
    if (month_year) where.month_year = `${month_year}-01`;

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

    const salaries = await Salary.findAll({
      where,
      include: [{
        model: Employee,
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'position', 'salary'],
        where: Object.keys(employeeWhere).length ? employeeWhere : undefined
      }],
      order: [['month_year', 'DESC']]
    });

    res.json({
      success: true,
      data: salaries
    });
  } catch (error) {
    console.error('Error fetching salaries:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getSalarySlip,
  generateSalary,
  paySalary,
  approveSalary,
  getSalaryHistory,
  getSalaries,
  calculateEmployeeMonthlySalary
};
