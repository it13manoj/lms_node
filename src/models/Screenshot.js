const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Employee = require('./Employee');
const User = require('./User');

const Screenshot = sequelize.define('Screenshot', {
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
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    employee_name: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    job_no: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    capture_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    captured_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    image_path: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    file_size_kb: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('pending', 'verified', 'rejected'),
        defaultValue: 'pending'
    },
    verified_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    verified_by_name: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    verified_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    notes: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, {
    tableName: 'screenshots',
    timestamps: true,
    underscored: true
});

Screenshot.belongsTo(Employee, { foreignKey: 'employee_id' });
Employee.hasMany(Screenshot, { foreignKey: 'employee_id' });
Screenshot.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Screenshot;
