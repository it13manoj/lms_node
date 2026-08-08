const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const { generateEmployeeIdFromUser } = require('../utils/employeeIdGenerator');

const Employee = sequelize.define('Employee', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        },
        unique: true
    },
    employee_id: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    first_name: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    last_name: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    phone: {
        type: DataTypes.STRING(20)
    },
    department: {
        type: DataTypes.STRING(50)
    },
    position: {
        type: DataTypes.STRING(50)
    },
    joining_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    salary: {
        type: DataTypes.DECIMAL(10, 2)
    },
    profile_picture: {
        type: DataTypes.STRING(255)
    },
    address: {
        type: DataTypes.TEXT
    },
    emergency_contact: {
        type: DataTypes.STRING(50)
    },
    bank_account: {
        type: DataTypes.STRING(50)
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: 'deleted_at'
    }
}, {
    tableName: 'employees',
    timestamps: true,
    underscored: true,
    paranoid: true,
    // Prevent automatic index creation
    indexes: [
        // Only explicitly define necessary indexes
        {
            name: 'idx_employees_employee_id',
            fields: ['employee_id'],
            unique: true
        },
        {
            name: 'idx_employees_email',
            fields: ['email'],
            unique: true
        },
        {
            name: 'idx_employees_department',
            fields: ['department']
        },
        {
            name: 'idx_employees_deleted_at',
            fields: ['deleted_at']
        },
        {
            name: 'idx_employees_user_id',
            fields: ['user_id']
        }
    ],
    hooks: {
        beforeCreate: async (employee) => {
            if (!employee.employee_id) {
                employee.employee_id = generateEmployeeIdFromUser(employee.user_id);
            }
        }
    }
});

Employee.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(Employee, { foreignKey: 'user_id' });

module.exports = Employee;