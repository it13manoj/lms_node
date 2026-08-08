const { sequelize } = require('../config/database');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { generateEmployeeIdFromUser } = require('../utils/employeeIdGenerator');

/**
 * Script to generate employee IDs for existing employees
 * Run: node src/scripts/generateEmployeeIds.js
 */
const generateEmployeeIds = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // Get all employees without employee_id or with null employee_id
        const employees = await Employee.findAll({
            include: [{
                model: User,
                attributes: ['id']
            }],
            where: {
                employee_id: {
                    [require('sequelize').Op.or]: [
                        { [require('sequelize').Op.is]: null },
                        { [require('sequelize').Op.eq]: '' }
                    ]
                }
            }
        });

        console.log(`Found ${employees.length} employees without employee_id`);

        let updatedCount = 0;
        for (const employee of employees) {
            const employeeId = generateEmployeeIdFromUser(employee.user_id);
            
            // Check if employee_id already exists
            const existing = await Employee.findOne({
                where: { employee_id: employeeId }
            });

            if (!existing) {
                await employee.update({ employee_id: employeeId });
                updatedCount++;
                console.log(`✅ Updated employee ${employee.id}: ${employeeId}`);
            } else {
                // If exists, add a random suffix
                const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                const newId = `${employeeId}${suffix}`;
                await employee.update({ employee_id: newId });
                updatedCount++;
                console.log(`✅ Updated employee ${employee.id}: ${newId} (with suffix)`);
            }
        }

        console.log(`\n✅ Successfully updated ${updatedCount} employees`);

        // Show sample employee IDs
        const samples = await Employee.findAll({
            limit: 5,
            attributes: ['id', 'employee_id', 'first_name', 'last_name']
        });
        
        console.log('\n📋 Sample Employee IDs:');
        samples.forEach(emp => {
            console.log(`  - ${emp.employee_id}: ${emp.first_name} ${emp.last_name}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

generateEmployeeIds();