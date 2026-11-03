const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LetterSetting = sequelize.define('LetterSetting', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    setting_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    setting_value: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'letter_settings',
    timestamps: true,
    underscored: true
});

module.exports = LetterSetting;

