const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'lms_panel',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true,
            // Prevent automatic index creation
            indexes: []
        }
    }
);

const ensureAttendanceColumns = async () => {
    try {
        const [inCol] = await sequelize.query("SHOW COLUMNS FROM attendance LIKE 'check_in_image'");
        if (!inCol || inCol.length === 0) {
            await sequelize.query("ALTER TABLE attendance ADD COLUMN check_in_image LONGTEXT NULL");
            console.log("✅ Added check_in_image column to attendance table");
        }
        const [outCol] = await sequelize.query("SHOW COLUMNS FROM attendance LIKE 'check_out_image'");
        if (!outCol || outCol.length === 0) {
            await sequelize.query("ALTER TABLE attendance ADD COLUMN check_out_image LONGTEXT NULL");
            console.log("✅ Added check_out_image column to attendance table");
        }
    } catch (err) {
        console.warn("⚠️ Attendance columns check notice:", err.message);
    }
};

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL Connected Successfully');
        
        await sequelize.sync();
        console.log('✅ Database synced');

        await ensureAttendanceColumns();
    } catch (error) {
        console.error('❌ Unable to connect to database:', error);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB };