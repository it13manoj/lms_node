const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Employee = require('./Employee');

const Leave = sequelize.define('Leave', {
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
    leave_type: {
        type: DataTypes.ENUM('annual', 'sick', 'casual', 'maternity', 'paternity', 'other'),
        allowNull: false
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    total_days: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    reason: {
        type: DataTypes.TEXT
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
        defaultValue: 'pending'
    },
    approved_by: {
        type: DataTypes.INTEGER,
        references: {
            model: Employee,
            key: 'id'
        }
    },
    approved_at: {
        type: DataTypes.DATE
    },
    // Add cancellation fields
    cancellation_reason: {
        type: DataTypes.TEXT
    },
    cancelled_by: {
        type: DataTypes.INTEGER,
        references: {
            model: Employee,
            key: 'id'
        }
    },
    cancelled_at: {
        type: DataTypes.DATE
    }
});

// Define relationships
Leave.belongsTo(Employee, { foreignKey: 'employee_id' });
Employee.hasMany(Leave, { foreignKey: 'employee_id' });

module.exports = Leave;