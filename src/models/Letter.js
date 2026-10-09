const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Employee = require('./Employee');
const User = require('./User');

const Letter = sequelize.define('Letter', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    letter_type: {
        type: DataTypes.ENUM('offer', 'joining', 'experience'),
        allowNull: false,
        defaultValue: 'offer'
    },
    reference_no: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    employee_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Employee,
            key: 'id'
        }
    },
    candidate_name: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    candidate_email: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    candidate_phone: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    candidate_address: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    position: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    department: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    joining_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    annual_ctc: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: '₹1.2 LPA'
    },
    work_location: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'Buxar, Bihar (802101)'
    },
    issue_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    signatory_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Authorized Signatory'
    },
    signatory_title: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'For ParakshTech LLP'
    },
    custom_terms: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('issued', 'draft'),
        defaultValue: 'issued'
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
    tableName: 'letters',
    timestamps: true,
    underscored: true
});

Letter.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Letter.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

module.exports = Letter;

