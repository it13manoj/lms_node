/**
 * Generate Employee ID with format: PT + YYYYMMDD + UserID
 * Example: PT202601011 (where 1 is the user_id)
 * 
 * Using pure JavaScript date formatting
 */

/**
 * Format date to YYYYMMDD
 */
const formatDateYYYYMMDD = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

/**
 * Generate Employee ID with User ID and date
 * Format: PT + YYYYMMDD + UserID
 */
const generateEmployeeIdFromUser = (userId) => {
    const dateStr = formatDateYYYYMMDD();
    return `PT${dateStr}${userId}`;
};

/**
 * Generate Employee ID with sequence number (no user_id needed)
 * Format: PT + YYYYMMDD + 3-digit sequence
 * Example: PT20260101001
 */
const generateEmployeeIdWithSequence = async (sequelize) => {
    const dateStr = formatDateYYYYMMDD();
    const prefix = `PT${dateStr}`;
    
    // Find the latest employee ID with today's prefix
    const Employee = require('../models/Employee');
    const { Op } = require('sequelize');
    
    const latestEmployee = await Employee.findOne({
        where: {
            employee_id: {
                [Op.like]: `${prefix}%`
            }
        },
        order: [['employee_id', 'DESC']]
    });
    
    let sequence = 1;
    if (latestEmployee) {
        const lastId = latestEmployee.employee_id;
        const lastSeq = parseInt(lastId.substring(prefix.length));
        if (!isNaN(lastSeq)) {
            sequence = lastSeq + 1;
        }
    }
    
    // Pad sequence to 3 digits
    const seqStr = String(sequence).padStart(3, '0');
    return `${prefix}${seqStr}`;
};

/**
 * Generate Employee ID using simple timestamp
 * Format: PT + Timestamp (YYYYMMDDHHmmss) + Random suffix
 */
const generateEmployeeIdWithTimestamp = () => {
    const now = new Date();
    const dateStr = formatDateYYYYMMDD(now);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${dateStr}${hours}${minutes}${seconds}`;
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `PT${timestamp}${random}`;
};

/**
 * Generate Employee ID using the format: PT + Timestamp
 * Your requested format: `${Date.now()}`
 */
const generateEmployeeIdWithNow = () => {
    // Using Date.now() which returns milliseconds since epoch
    const timestamp = Date.now();
    return `PT${timestamp}`;
};

/**
 * Generate Employee ID using formatted Date.now()
 * Your requested format: `PT${Date.now('YYYYMMDD')}`
 * Note: Date.now() doesn't accept format strings, so we format it manually
 */
const generateEmployeeIdWithFormattedDate = (userId = null) => {
    const now = new Date();
    const dateStr = formatDateYYYYMMDD(now);
    if (userId) {
        return `PT${dateStr}${userId}`;
    }
    return `PT${dateStr}`;
};

module.exports = {
    formatDateYYYYMMDD,
    generateEmployeeIdFromUser,
    generateEmployeeIdWithSequence,
    generateEmployeeIdWithTimestamp,
    generateEmployeeIdWithNow,
    generateEmployeeIdWithFormattedDate
};