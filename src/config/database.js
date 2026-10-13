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
        const [offCol] = await sequelize.query("SHOW COLUMNS FROM attendance LIKE 'system_off_minutes'");
        if (!offCol || offCol.length === 0) {
            await sequelize.query("ALTER TABLE attendance ADD COLUMN system_off_minutes INT DEFAULT 0");
            console.log("✅ Added system_off_minutes column to attendance table");
        }
        const [netCol] = await sequelize.query("SHOW COLUMNS FROM attendance LIKE 'net_working_hours'");
        if (!netCol || netCol.length === 0) {
            await sequelize.query("ALTER TABLE attendance ADD COLUMN net_working_hours DECIMAL(5,2) NULL");
            console.log("✅ Added net_working_hours column to attendance table");
        }
        const [actCol] = await sequelize.query("SHOW COLUMNS FROM attendance LIKE 'last_activity_time'");
        if (!actCol || actCol.length === 0) {
            await sequelize.query("ALTER TABLE attendance ADD COLUMN last_activity_time DATETIME NULL");
            console.log("✅ Added last_activity_time column to attendance table");
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