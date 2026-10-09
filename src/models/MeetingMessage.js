const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MeetingMessage = sequelize.define('MeetingMessage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    meeting_id: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    sender_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    sender_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    sender_role: {
        type: DataTypes.STRING(50),
        defaultValue: 'Participant'
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'meeting_messages',
    timestamps: true
});

module.exports = MeetingMessage;

