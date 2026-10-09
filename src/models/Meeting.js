const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Employee = require('./Employee');

const Meeting = sequelize.define('Meeting', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    meeting_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    host_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Employee,
            key: 'id'
        }
    },
    host_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    meeting_type: {
        type: DataTypes.ENUM('group', 'one-on-one', 'department', 'all-hands'),
        defaultValue: 'group'
    },
    status: {
        type: DataTypes.ENUM('scheduled', 'in-progress', 'completed', 'cancelled'),
        defaultValue: 'scheduled'
    },
    scheduled_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    start_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    end_time: {
        type: DataTypes.TIME,
        allowNull: true
    },
    duration_minutes: {
        type: DataTypes.INTEGER,
        defaultValue: 45
    },
    department: {
        type: DataTypes.STRING(100),
        defaultValue: 'All'
    },
    passcode: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    meeting_link: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    settings: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON string for meeting settings like allowScreenShare, allowChat, allowDocumentShare'
    },
    invited_employees: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON string of invited employees'
    }
}, {
    tableName: 'meetings',
    timestamps: true
});

Meeting.belongsTo(Employee, { foreignKey: 'host_id', as: 'host' });

module.exports = Meeting;

