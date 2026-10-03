const { sequelize } = require('../config/database');

async function cleanIndexes() {
  try {
    console.log('Cleaning employees indexes...');
    const [empIndexes] = await sequelize.query('SHOW INDEXES FROM employees');
    const empKeysToDrop = new Set();
    for (const idx of empIndexes) {
      const name = idx.Key_name;
      if (
        name.startsWith('employee_id_') || 
        name.startsWith('email_') || 
        name === 'idx_employees_employee_id' || 
        name === 'idx_employees_email' || 
        name === 'idx_employees_user_id'
      ) {
        empKeysToDrop.add(name);
      }
    }
    for (const key of empKeysToDrop) {
      console.log(`Dropping employees index: ${key}`);
      await sequelize.query(`ALTER TABLE employees DROP INDEX \`${key}\``);
    }

    console.log('Cleaning users indexes...');
    const [userIndexes] = await sequelize.query('SHOW INDEXES FROM users');
    const userKeysToDrop = new Set();
    for (const idx of userIndexes) {
      const name = idx.Key_name;
      if (name.startsWith('email_') || name === 'idx_users_email') {
        userKeysToDrop.add(name);
      }
    }
    for (const key of userKeysToDrop) {
      console.log(`Dropping users index: ${key}`);
      await sequelize.query(`ALTER TABLE users DROP INDEX \`${key}\``);
    }

    console.log('✅ Cleanup completed successfully!');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await sequelize.close();
  }
}

cleanIndexes();
