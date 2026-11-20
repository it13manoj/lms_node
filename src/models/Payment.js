const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Employee = require('./Employee');
const User = require('./User');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reference_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Employee,
      key: 'id'
    }
  },
  payment_type: {
    type: DataTypes.ENUM('salary', 'bonus', 'reimbursement', 'advance'),
    defaultValue: 'salary'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('completed', 'pending', 'failed'),
    defaultValue: 'completed'
  },
  payment_method: {
    type: DataTypes.STRING(50),
    defaultValue: 'Bank Transfer'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  }
}, {
  tableName: 'payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

Payment.belongsTo(Employee, { foreignKey: 'employee_id' });
Payment.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

module.exports = Payment;
