const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Employee = require('./Employee');

const Attendance = sequelize.define('Attendance', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    employee_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Employee,
            key: 'id'
        }
    },
    job_no: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    employee_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    check_in: {
        type: DataTypes.TIME,
        allowNull: true
    },
    check_out: {
        type: DataTypes.TIME,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('present', 'absent', 'late', 'half-day', 'holiday'),
        defaultValue: 'absent'
    },
    late_minutes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    early_leave_minutes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    remarks: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    working_hours: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    overtime_hours: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    raw_punches: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'attendance',
    timestamps: false,
    underscored: true
});

Attendance.belongsTo(Employee, { foreignKey: 'employee_id' });
Employee.hasMany(Attendance, { foreignKey: 'employee_id' });

module.exports = Attendance;
