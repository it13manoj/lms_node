const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');

// Protect routes - verify token
const protect = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            req.user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password'] },
                include: [{
                    model: Employee,
                    attributes: ['id', 'first_name', 'last_name', 'employee_id', 'department', 'position']
                }]
            });
            
            if (!req.user) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Not authorized, user not found' 
                });
            }

            // Check if user is soft deleted
            if (req.user.deleted_at) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Account has been deactivated' 
                });
            }

            // Add role to request for easier access
            req.userRole = req.user.role;
            
            next();
        } catch (error) {
            console.error('Auth error:', error);
            return res.status(401).json({ 
                success: false,
                message: 'Not authorized, token failed' 
            });
        }
    }
    
    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Not authorized, no token' 
        });
    }
};

// Authorize - check if user has required role
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                message: 'Not authorized' 
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false,
                message: `Access denied. Role ${req.user.role} is not authorized. Required roles: ${roles.join(', ')}` 
            });
        }
        next();
    };
};

// Check if user is admin or HR
const isAdminOrHR = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: 'Not authorized' 
        });
    }

    if (!['admin', 'hr'].includes(req.user.role)) {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied. Only Admin and HR can perform this action' 
        });
    }
    next();
};

// Check if user is admin, HR, or manager
const isAdminOrHRorManager = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: 'Not authorized' 
        });
    }

    if (!['admin', 'hr', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied. Only Admin, HR, and Managers can perform this action' 
        });
    }
    next();
};

// Check if user can access employee data
const canAccessEmployeeData = (req, res, next) => {
    const userRole = req.user?.role;
    const requestedEmployeeId = parseInt(req.params.id);
    
    // Admin and HR can access all employees
    if (['admin', 'hr'].includes(userRole)) {
        return next();
    }

    // Employees can only access their own data
    if (userRole === 'employee') {
        // Get current employee's ID from their user record
        Employee.findOne({
            where: { user_id: req.user.id }
        }).then(employee => {
            if (employee && employee.id === requestedEmployeeId) {
                next();
            } else {
                res.status(403).json({ 
                    success: false,
                    message: 'Access denied. You can only access your own data' 
                });
            }
        }).catch(err => {
            res.status(500).json({ 
                success: false,
                message: 'Server error' 
            });
        });
    } else {
        res.status(403).json({ 
            success: false,
            message: 'Access denied' 
        });
    }
};

// Check if user can view reports
const canViewReports = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: 'Not authorized' 
        });
    }

    const reportRoles = ['admin', 'hr', 'manager'];
    if (!reportRoles.includes(req.user.role)) {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied. Only Admin, HR, and Managers can view reports' 
        });
    }
    next();
};

// Check if user can manage policies
const canManagePolicies = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: 'Not authorized' 
        });
    }

    const policyRoles = ['admin', 'hr'];
    if (!policyRoles.includes(req.user.role)) {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied. Only Admin and HR can manage policies' 
        });
    }
    next();
};

module.exports = {
    protect,
    authorize,
    isAdminOrHR,
    isAdminOrHRorManager,
    canAccessEmployeeData,
    canViewReports,
    canManagePolicies
};