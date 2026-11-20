const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Employee = require('./Employee');
const User = require('./User');

const Performance = sequelize.define('Performance', {
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
  reviewer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  },
  review_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 4,
    validate: {
      min: 1,
      max: 5
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'reviewed'),
    defaultValue: 'reviewed'
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  goals: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  achievements: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'performance_reviews',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

Performance.belongsTo(Employee, { foreignKey: 'employee_id' });
Performance.belongsTo(User, { as: 'reviewer', foreignKey: 'reviewer_id' });

module.exports = Performance;
