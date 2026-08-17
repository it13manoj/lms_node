const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const Policy = sequelize.define('Policy', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  policy_type: {
    type: DataTypes.ENUM('hr', 'company', 'employee', 'manager', 'sales', 'team'),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  file_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  effective_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
}, {
  tableName: 'policies',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

Policy.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Policy, { foreignKey: 'created_by', as: 'policies' });

module.exports = Policy;
