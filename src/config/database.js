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

const ensureLetterSecurityColumns = async () => {
    try {
        const [sigCol] = await sequelize.query("SHOW COLUMNS FROM letters LIKE 'include_signature'");
        if (!sigCol || sigCol.length === 0) {
            await sequelize.query("ALTER TABLE letters ADD COLUMN include_signature TINYINT(1) DEFAULT 0");
            console.log("✅ Added include_signature column to letters table");
        }
        const [stampCol] = await sequelize.query("SHOW COLUMNS FROM letters LIKE 'include_stamp'");
        if (!stampCol || stampCol.length === 0) {
            await sequelize.query("ALTER TABLE letters ADD COLUMN include_stamp TINYINT(1) DEFAULT 0");
            console.log("✅ Added include_stamp column to letters table");
        }
        const [bodyCol] = await sequelize.query("SHOW COLUMNS FROM letters LIKE 'body_content'");
        if (!bodyCol || bodyCol.length === 0) {
            await sequelize.query("ALTER TABLE letters ADD COLUMN body_content LONGTEXT NULL");
            console.log("✅ Added body_content column to letters table");
        }
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS letter_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    } catch (err) {
        console.warn("⚠️ Letter columns/settings check notice:", err.message);
    }
};

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL Connected Successfully');
        
        await sequelize.sync();
        console.log('✅ Database synced');

        await ensureAttendanceColumns();
        await ensureLetterSecurityColumns();
    } catch (error) {
        console.error('❌ Unable to connect to database:', error);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB };
