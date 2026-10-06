const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Employee = require('./Employee');

const Salary = sequelize.define('Salary', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Employee,
      key: 'id'
    }
  },
  month_year: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  basic_salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  allowances: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  deductions: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  bonus: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  total_salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  net_salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  present_days: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  absent_days: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  paid_leaves: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  unpaid_leaves: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  per_day_salary: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  absent_deduction: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  payment_method: {
    type: DataTypes.STRING(50),
    defaultValue: 'Bank Transfer'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
    defaultValue: 'pending'
  }
}, {
  tableName: 'salary',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

Salary.belongsTo(Employee, { foreignKey: 'employee_id' });
Employee.hasMany(Salary, { foreignKey: 'employee_id' });

module.exports = Salary;
