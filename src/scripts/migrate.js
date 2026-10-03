const { sequelize } = require('../config/database');
const path = require('path');

// Import all models in dependency order
const User = require('../models/User');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const Leave = require('../models/Leave');
const Policy = require('../models/Policy');
const Salary = require('../models/Salary');

const models = [
  { name: 'User', model: User, table: 'users' },
  { name: 'Employee', model: Employee, table: 'employees' },
  { name: 'Attendance', model: Attendance, table: 'attendance' },
  { name: 'Holiday', model: Holiday, table: 'holidays' },
  { name: 'Leave', model: Leave, table: 'leaves' },
  { name: 'Policy', model: Policy, table: 'policies' },
  { name: 'Salary', model: Salary, table: 'salary' }
];

function getSqlColumnDefinition(attr) {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;
  let def = queryGenerator.attributeToSQL(attr, { context: 'changeColumn' });
  return def;
}

async function runMigration() {
  console.log('=============================================');
  console.log('🚀 Running LMS Database Migration');
  console.log('=============================================');

  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database:', sequelize.config.database);

    const [existingTables] = await sequelize.query('SHOW TABLES');
    const tableKey = 'Tables_in_' + sequelize.config.database;
    const tableList = existingTables.map(t => t[tableKey] || Object.values(t)[0]);

    for (const item of models) {
      const { name, model, table } = item;
      console.log(`\n📋 Checking table: ${table} (${name} model)...`);

      if (!tableList.includes(table)) {
        console.log(`  Table '${table}' does not exist. Creating...`);
        await model.sync();
        console.log(`  ✅ Created table '${table}'`);
        continue;
      }

      // Table exists, check for missing columns
      const [tableCols] = await sequelize.query(`DESCRIBE \`${table}\``);
      const existingColNames = tableCols.map(c => c.Field);
      const rawAttrs = model.rawAttributes;

      let addedCount = 0;
      for (const [attrName, attrDef] of Object.entries(rawAttrs)) {
        const colName = attrDef.field || attrName;
        if (!existingColNames.includes(colName)) {
          const sqlDef = getSqlColumnDefinition(attrDef);
          console.log(`  ➕ Adding missing column '${colName}' (${sqlDef})...`);
          await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${colName}\` ${sqlDef}`);
          addedCount++;
        }
      }

      if (addedCount === 0) {
        console.log(`  ✅ All columns up to date (${existingColNames.length} columns)`);
      } else {
        console.log(`  ✅ Added ${addedCount} missing column(s) to '${table}'`);
      }

      // Check and clean duplicate indexes on table
      const [indexes] = await sequelize.query(`SHOW INDEXES FROM \`${table}\``);
      const redundantIndexes = new Set();
      for (const idx of indexes) {
        const keyName = idx.Key_name;
        // Patterns for duplicate auto-generated keys in MySQL
        if (
          keyName.match(/_2$/) ||
          keyName.match(/_\d+$/) ||
          (table === 'employees' && (keyName === 'idx_employees_employee_id' || keyName === 'idx_employees_email' || keyName === 'idx_employees_user_id')) ||
          (table === 'users' && keyName === 'idx_users_email')
        ) {
          redundantIndexes.add(keyName);
        }
      }

      if (redundantIndexes.size > 0) {
        console.log(`  🧹 Found ${redundantIndexes.size} redundant indexes to clean...`);
        for (const idx of redundantIndexes) {
          try {
            await sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${idx}\``);
            console.log(`    - Dropped duplicate index: ${idx}`);
          } catch (e) {
            console.log(`    - Could not drop ${idx}: ${e.message}`);
          }
        }
      }
    }

    console.log('\n=============================================');
    console.log('🎉 Migration completed successfully!');
    console.log('=============================================');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
