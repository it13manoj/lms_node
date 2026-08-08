const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('admin', 'hr', 'manager', 'sales', 'team', 'employee'),
        defaultValue: 'employee'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active'
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: 'deleted_at'
    }
}, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    paranoid: true,
    indexes: [
        {
            name: 'idx_users_email',
            fields: ['email'],
            unique: true
        },
        {
            name: 'idx_users_deleted_at',
            fields: ['deleted_at']
        },
        {
            name: 'idx_users_role',
            fields: ['role']
        }
    ],
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

User.prototype.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = User;