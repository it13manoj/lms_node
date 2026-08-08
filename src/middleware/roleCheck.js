/**
 * Role-based access control middleware
 * Defines what each role can access
 */

// Define role permissions
const ROLE_PERMISSIONS = {
    admin: {
        // Full access to everything
        canManageUsers: true,
        canManageEmployees: true,
        canManageRoles: true,
        canManagePolicies: true,
        canManagePayments: true,
        canManageAttendance: true,
        canManageLeaves: true,
        canManageSalary: true,
        canManagePerformance: true,
        canViewAllData: true,
        canDeleteData: true,
        canRestoreData: true,
        canExportData: true,
        canManageHolidays: true,
        canViewReports: true
    },
    hr: {
        canManageUsers: true,
        canManageEmployees: true,
        canManagePolicies: true,
        canManagePayments: true,
        canManageAttendance: true,
        canManageLeaves: true,
        canManageSalary: true,
        canManagePerformance: true,
        canViewAllData: true,
        canDeleteData: false,
        canRestoreData: false,
        canExportData: true,
        canManageHolidays: true,
        canViewReports: true,
        canManageRoles: false
    },
    manager: {
        canManageUsers: false,
        canManageEmployees: false,
        canManagePolicies: false,
        canManagePayments: false,
        canManageAttendance: false,
        canManageLeaves: true, // Can approve/reject leaves for team
        canManageSalary: false,
        canManagePerformance: true, // Can review team performance
        canViewAllData: true,
        canDeleteData: false,
        canRestoreData: false,
        canExportData: false,
        canManageHolidays: false,
        canViewReports: true,
        canManageRoles: false
    },
    sales: {
        canManageUsers: false,
        canManageEmployees: false,
        canManagePolicies: false,
        canManagePayments: false,
        canManageAttendance: false,
        canManageLeaves: false,
        canManageSalary: false,
        canManagePerformance: false,
        canViewAllData: false,
        canDeleteData: false,
        canRestoreData: false,
        canExportData: false,
        canManageHolidays: false,
        canViewReports: false,
        canManageRoles: false
    },
    team: {
        canManageUsers: false,
        canManageEmployees: false,
        canManagePolicies: false,
        canManagePayments: false,
        canManageAttendance: false,
        canManageLeaves: false,
        canManageSalary: false,
        canManagePerformance: false,
        canViewAllData: false,
        canDeleteData: false,
        canRestoreData: false,
        canExportData: false,
        canManageHolidays: false,
        canViewReports: false,
        canManageRoles: false
    },
    employee: {
        canManageUsers: false,
        canManageEmployees: false,
        canManagePolicies: false,
        canManagePayments: false,
        canManageAttendance: false,
        canManageLeaves: false,
        canManageSalary: false,
        canManagePerformance: false,
        canViewAllData: false,
        canDeleteData: false,
        canRestoreData: false,
        canExportData: false,
        canManageHolidays: false,
        canViewReports: false,
        canManageRoles: false
    }
};

// Define role hierarchy (for inheritance)
const ROLE_HIERARCHY = {
    admin: ['admin', 'hr', 'manager', 'sales', 'team', 'employee'],
    hr: ['hr', 'manager', 'sales', 'team', 'employee'],
    manager: ['manager', 'sales', 'team', 'employee'],
    sales: ['sales', 'employee'],
    team: ['team', 'employee'],
    employee: ['employee']
};

// Check if user has permission for a specific action
const hasPermission = (userRole, action) => {
    if (!userRole || !ROLE_PERMISSIONS[userRole]) {
        return false;
    }
    return ROLE_PERMISSIONS[userRole][action] || false;
};

// Check if user can access a specific module
const canAccessModule = (userRole, module) => {
    const modulePermissions = {
        dashboard: ['admin', 'hr', 'manager', 'sales', 'team', 'employee'],
        employees: ['admin', 'hr', 'manager'],
        profile: ['admin', 'hr', 'manager', 'sales', 'team', 'employee'],
        leave: ['admin', 'hr', 'manager', 'employee'],
        attendance: ['admin', 'hr', 'manager', 'employee'],
        salary: ['admin', 'hr', 'manager', 'employee'],
        policies: ['admin', 'hr', 'manager', 'employee'],
        holidays: ['admin', 'hr', 'manager', 'employee'],
        payments: ['admin', 'hr'],
        performance: ['admin', 'hr', 'manager'],
        reports: ['admin', 'hr', 'manager']
    };

    return modulePermissions[module]?.includes(userRole) || false;
};

// Middleware to check module access
const checkModuleAccess = (module) => {
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (!userRole) {
            return res.status(401).json({ 
                success: false,
                message: 'Unauthorized - No role found' 
            });
        }

        if (canAccessModule(userRole, module)) {
            next();
        } else {
            res.status(403).json({ 
                success: false,
                message: `Access denied. ${userRole} cannot access ${module}` 
            });
        }
    };
};

// Middleware to check specific permission
const checkPermission = (action) => {
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (!userRole) {
            return res.status(401).json({ 
                success: false,
                message: 'Unauthorized - No role found' 
            });
        }

        if (hasPermission(userRole, action)) {
            next();
        } else {
            res.status(403).json({ 
                success: false,
                message: `Access denied. ${userRole} cannot perform ${action}` 
            });
        }
    };
};

module.exports = {
    ROLE_PERMISSIONS,
    ROLE_HIERARCHY,
    hasPermission,
    canAccessModule,
    checkModuleAccess,
    checkPermission
};