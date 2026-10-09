const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MeetingDocument = sequelize.define('MeetingDocument', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    meeting_id: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    uploader_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    uploader_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    file_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    file_path: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    file_size: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    file_type: {
        type: DataTypes.STRING(100),
        allowNull: true
    }
}, {
    tableName: 'meeting_documents',
    timestamps: true
});

module.exports = MeetingDocument;

