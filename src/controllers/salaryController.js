const Salary = require('../models/Salary');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

const calculateGrossAndNet = (payload) => {
  const basic_salary = Number(payload.basic_salary || 0);
  const allowances = Number(payload.allowances || 0);
  const deductions = Number(payload.deductions || 0);
  const bonus = Number(payload.bonus || 0);

  const total_salary = basic_salary + allowances + bonus;
  const net_salary = total_salary - deductions;

  return {
    basic_salary,
    allowances,
    deductions,
    bonus,
    total_salary,
    net_salary
  };
};

const getSalaries = async (req, res) => {
  try {
    const { employee_id, status, month_year, search } = req.query;

    const where = {};
    if (employee_id) where.employee_id = employee_id;
    if (status) where.status = status;
    if (month_year) where.month_year = month_year;

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
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'position'],
        where: Object.keys(employeeWhere).length ? employeeWhere : undefined
      }],
      order: [['month_year', 'DESC'], ['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: salaries
    });
  } catch (error) {
    console.error('Error fetching salaries:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getSalary = async (req, res) => {
  try {
    const { id } = req.params;
    const salary = await Salary.findByPk(id, {
      include: [{
        model: Employee,
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'position']
      }]
    });

    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found' });
    }

    res.status(200).json({ success: true, data: salary });
  } catch (error) {
    console.error('Error fetching salary:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const createSalary = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      employee_id,
      month_year,
      basic_salary,
      allowances,
      deductions,
      bonus,
      payment_date,
      status
    } = req.body;

    if (!employee_id || !month_year) {
      return res.status(400).json({ success: false, message: 'Employee and month are required' });
    }

    const employee = await Employee.findByPk(employee_id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const computed = calculateGrossAndNet({ basic_salary, allowances, deductions, bonus });

    const salary = await Salary.create({
      employee_id,
      month_year,
      basic_salary: computed.basic_salary,
      allowances: computed.allowances,
      deductions: computed.deductions,
      bonus: computed.bonus,
      total_salary: computed.total_salary,
      net_salary: computed.net_salary,
      payment_date: payment_date || null,
      status: status || 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Salary record created successfully',
      data: salary
    });
  } catch (error) {
    console.error('Error creating salary:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const updateSalary = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const salary = await Salary.findByPk(id);

    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found' });
    }

    const payload = { ...req.body };
    const computed = calculateGrossAndNet({
      basic_salary: payload.basic_salary ?? salary.basic_salary,
      allowances: payload.allowances ?? salary.allowances,
      deductions: payload.deductions ?? salary.deductions,
      bonus: payload.bonus ?? salary.bonus
    });

    await salary.update({
      ...payload,
      basic_salary: computed.basic_salary,
      allowances: computed.allowances,
      deductions: computed.deductions,
      bonus: computed.bonus,
      total_salary: computed.total_salary,
      net_salary: computed.net_salary
    });

    res.status(200).json({
      success: true,
      message: 'Salary record updated successfully',
      data: salary
    });
  } catch (error) {
    console.error('Error updating salary:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const deleteSalary = async (req, res) => {
  try {
    const { id } = req.params;
    const salary = await Salary.findByPk(id);

    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found' });
    }

    await salary.destroy();

    res.status(200).json({
      success: true,
      message: 'Salary record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting salary:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const paySalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_date } = req.body;

    const salary = await Salary.findByPk(id);
    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found' });
    }

    await salary.update({
      status: 'paid',
      payment_date: payment_date || new Date().toISOString().slice(0, 10)
    });

    res.status(200).json({
      success: true,
      message: 'Salary marked as paid',
      data: salary
    });
  } catch (error) {
    console.error('Error marking salary paid:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getSalaries,
  getSalary,
  createSalary,
  updateSalary,
  deleteSalary,
  paySalary
};
