const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

// Helper: Save punch snapshot photo (base64 string to image file on disk)
const savePunchImage = (base64Data, employeeId, type = 'in') => {
    if (!base64Data || typeof base64Data !== 'string') return null;
    try {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let ext = 'jpg';
        let buffer;
        if (matches && matches.length === 3) {
            const mime = matches[1];
            if (mime.includes('png')) ext = 'png';
            else if (mime.includes('webp')) ext = 'webp';
            buffer = Buffer.from(matches[2], 'base64');
        } else if (base64Data.startsWith('/uploads/') || base64Data.startsWith('http')) {
            return base64Data;
        } else {
            buffer = Buffer.from(base64Data, 'base64');
        }

        const uploadDir = path.join(__dirname, '../../uploads/attendance');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filename = `punch_${type}_emp${employeeId}_${Date.now()}.${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);

        return `/uploads/attendance/${filename}`;
    } catch (err) {
        console.error('Error saving punch image to disk:', err);
        return base64Data;
    }
};

// Standard Office Timing constants
const OFFICE_START_TIME = '09:30:00'; // 9:30 AM
const OFFICE_END_TIME = '18:30:00';   // 6:30 PM
const IST_OFFSET = '+05:30';
const IDLE_THRESHOLD_MINUTES = 30;

// Helper: Parse date ('YYYY-MM-DD') and time ('HH:mm:ss' or 'HH:mm') strictly in IST (+05:30)
const parseISTDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    let cleanTime = String(timeStr).trim();
    if (cleanTime.length === 5) cleanTime = cleanTime + ':00';
    const m = moment(dateStr + ' ' + cleanTime + ' ' + IST_OFFSET, 'YYYY-MM-DD HH:mm:ss Z');
    return m.isValid() ? m.utcOffset(IST_OFFSET) : null;
};

// Helper: Compute 09:30 AM - 06:30 PM IST tracking bounds and maximum possible system off minutes
const getShiftTrackingBounds = (dateStr, checkInTime, endMoment) => {
    const shiftStart = parseISTDateTime(dateStr, OFFICE_START_TIME);
    const shiftEnd = parseISTDateTime(dateStr, OFFICE_END_TIME);
    const checkInMoment = parseISTDateTime(dateStr, checkInTime);
    if (!shiftStart || !shiftEnd || !checkInMoment || !endMoment) {
        return null;
    }
    const effectiveStartMs = Math.max(shiftStart.valueOf(), checkInMoment.valueOf());
    const effectiveEndMs = Math.min(shiftEnd.valueOf(), endMoment.valueOf());
    const shiftWindowMinutes = Math.max(0, Math.floor((effectiveEndMs - effectiveStartMs) / 60000));
    const maxPossibleOffMinutes = Math.max(0, shiftWindowMinutes - IDLE_THRESHOLD_MINUTES);
    return {
        shiftStart,
        shiftEnd,
        checkInMoment,
        effectiveStartMs,
        effectiveEndMs,
        shiftWindowMinutes,
        maxPossibleOffMinutes
    };
};

// Helper: Calculate gross hours, shift-window-clamped system off minutes (09:30 AM - 06:30 PM IST), and net working hours
const calculateShiftAttendanceMetrics = (attRecord, istNow = moment().utcOffset(IST_OFFSET)) => {
    const dateStr = attRecord.date;
    const todayIST = istNow.format('YYYY-MM-DD');
    const checkInMoment = attRecord.check_in ? parseISTDateTime(dateStr, attRecord.check_in) : null;
    const checkOutMoment = attRecord.check_out ? parseISTDateTime(dateStr, attRecord.check_out) : null;

    if (!checkInMoment) {
        return {
            grossHours: parseFloat(attRecord.working_hours || 0) || 0,
            systemOffMinutes: 0,
            netWorkingHours: parseFloat(attRecord.net_working_hours || attRecord.working_hours || 0) || 0,
            isLiveOff: false
        };
    }

    const shiftEnd = parseISTDateTime(dateStr, OFFICE_END_TIME);
    const liveEnd = checkOutMoment
        ? checkOutMoment
        : (dateStr === todayIST ? istNow : shiftEnd);

    const grossHours = checkOutMoment
        ? parseFloat(Math.max(0, checkOutMoment.diff(checkInMoment, 'hours', true)).toFixed(2))
        : parseFloat(Math.max(0, liveEnd.diff(checkInMoment, 'hours', true)).toFixed(2));

    const bounds = getShiftTrackingBounds(dateStr, attRecord.check_in, liveEnd);
    const maxPossibleOff = bounds ? bounds.maxPossibleOffMinutes : 0;

    let currentOffMinutes = Math.min(
        Math.max(0, parseInt(attRecord.system_off_minutes, 10) || 0),
        maxPossibleOff
    );
    let isLiveOff = false;

    if (!checkOutMoment && attRecord.last_activity_time && bounds && bounds.effectiveEndMs > bounds.effectiveStartMs) {
        const lastActMs = moment(attRecord.last_activity_time).valueOf();
        if (!isNaN(lastActMs)) {
            const clampedStartMs = Math.max(lastActMs, bounds.effectiveStartMs);
            if (bounds.effectiveEndMs > clampedStartMs) {
                const awayMinutesInWindow = Math.floor((bounds.effectiveEndMs - clampedStartMs) / 60000);
                if (awayMinutesInWindow > IDLE_THRESHOLD_MINUTES) {
                    const extraOff = awayMinutesInWindow - IDLE_THRESHOLD_MINUTES;
                    currentOffMinutes = Math.min(maxPossibleOff, currentOffMinutes + extraOff);
                    if (dateStr === todayIST && istNow.valueOf() <= bounds.shiftEnd.valueOf()) {
                        isLiveOff = true;
                    }
                }
            }
        }
    }

    const netWorkingHours = parseFloat(Math.max(0, grossHours - (currentOffMinutes / 60)).toFixed(2));

    return {
        grossHours,
        systemOffMinutes: currentOffMinutes,
        netWorkingHours,
        isLiveOff
    };
};

// Helper: Convert time string 'HH:mm:ss' to seconds since midnight
const timeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseInt(parts[2], 10) || 0;
    return h * 3600 + m * 60 + s;
};

// Helper: Format minutes into human readable 'Xh Ym' or 'Ym'
const formatMinutes = (minutes) => {
    if (!minutes || minutes <= 0) return '0 min';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
};

// Helper: Format time to 12-hour AM/PM format
const formatTime12 = (timeStr) => {
    if (!timeStr) return '--:--';
    return moment(timeStr, ['HH:mm:ss', 'HH:mm']).format('hh:mm A');
};

// Helper: Strip quotes and whitespace from cell value
const cleanCell = (cell) => {
    if (!cell) return '';
    return cell.trim().replace(/^['"\s]+|['"\s]+$/g, '');
};

// Helper: Check if request is originating from a mobile device or tablet
const isMobileRequest = (req) => {
    if (!req) return false;

    // 1. Client header sent by frontend device detector
    if (req.headers && req.headers['x-device-type'] === 'mobile') {
        return true;
    }

    // 2. Client hints header sent by modern Chromium mobile browsers
    const secChUaMobile = req.headers ? req.headers['sec-ch-ua-mobile'] : null;
    if (secChUaMobile === '?1') {
        return true;
    }

    // 3. User-Agent inspection for mobile/tablet devices
    const userAgent = (req.headers && req.headers['user-agent']) || '';
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk|Kindle/i;
    if (mobileRegex.test(userAgent)) {
        return true;
    }

    // 4. Request body flag if provided
    if (req.body && (req.body.isMobile === true || req.body.deviceType === 'mobile')) {
        return true;
    }

    return false;
};

// Helper: Normalize date string to standard YYYY-MM-DD
const normalizeDate = (rawDateStr) => {
    if (!rawDateStr) return null;
    const cleanStr = cleanCell(rawDateStr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
        return cleanStr;
    }
    // Check for DD-MM-YYYY or DD/MM/YYYY
    const parts = cleanStr.split(/[-/]/);
    if (parts.length === 3) {
        if (parts[2].length === 4) {
            // DD-MM-YYYY
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        } else if (parts[0].length === 4) {
            // YYYY-MM-DD
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }
    const m = moment(cleanStr);
    return m.isValid() ? m.format('YYYY-MM-DD') : null;
};

// Parse a single line into cells handling double quotes and excel prefix quotes
const parseRow = (line) => {
    const result = [];
    let cur = '';
    let inDoubleQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && !inDoubleQuotes) {
            inDoubleQuotes = true;
        } else if (char === '"' && inDoubleQuotes) {
            inDoubleQuotes = false;
        } else if ((char === ',' || char === '\t' || char === ';') && !inDoubleQuotes) {
            result.push(cleanCell(cur));
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cleanCell(cur));
    return result;
};

// Parse CSV content into structured punch records
const parseCSV = (csvContent) => {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const header = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // Find column indexes
    const nameIdx = header.findIndex(h => h === 'sname' || h === 'name' || h === 'employeename');
    const jobIdx = header.findIndex(h => h === 'sjobno' || h === 'jobno' || h === 'employeeid');
    const dateIdx = header.findIndex(h => h === 'date');
    const timeIdx = header.findIndex(h => h === 'time');
    const statusIdx = header.findIndex(h => h === 'attendancestatus' || h === 'status');
    const serialIdx = header.findIndex(h => h === 'serialno');

    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseRow(lines[i]);
        if (row.length <= 1) continue;

        const sName = nameIdx !== -1 && row[nameIdx] ? cleanCell(row[nameIdx]) : '';
        const sJobNo = jobIdx !== -1 && row[jobIdx] ? cleanCell(row[jobIdx]) : '';
        const dateStr = dateIdx !== -1 && row[dateIdx] ? cleanCell(row[dateIdx]) : '';
        const timeStr = timeIdx !== -1 && row[timeIdx] ? cleanCell(row[timeIdx]) : '';
        const attStatus = statusIdx !== -1 && row[statusIdx] ? cleanCell(row[statusIdx]) : '';
        const serialNo = serialIdx !== -1 && row[serialIdx] ? cleanCell(row[serialIdx]) : '';

        // Skip anonymous / unassigned card punches where both name and job number are NULL or empty
        const isAnonName = !sName || sName.toUpperCase() === 'NULL';
        const isAnonJob = !sJobNo || sJobNo.toUpperCase() === 'NULL';
        if (isAnonName && isAnonJob) {
            continue;
        }

        const normalizedDate = normalizeDate(dateStr);
        if (normalizedDate && timeStr) {
            records.push({
                sName: isAnonName ? '' : sName,
                sJobNo: isAnonJob ? '' : sJobNo,
                date: normalizedDate,
                time: timeStr.length === 5 ? `${timeStr}:00` : timeStr,
                attendanceStatus: attStatus,
                serialNo
            });
        }
    }
    return records;
};

// @desc    Upload biometric attendance CSV
// @route   POST /api/attendance/upload-csv
// @access  Private (Admin / HR)
const uploadAttendanceCSV = async (req, res) => {
    try {
        let csvText = '';
        if (req.file) {
            csvText = req.file.buffer ? req.file.buffer.toString('utf-8') : require('fs').readFileSync(req.file.path, 'utf-8');
        } else if (req.body.csvText) {
            csvText = req.body.csvText;
        } else {
            return res.status(400).json({ success: false, message: 'Please upload a CSV file or provide csvText' });
        }

        const rawRecords = parseCSV(csvText);
        if (rawRecords.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid attendance records found in CSV' });
        }

        // Fetch all existing employees & users for matching
        const existingEmployees = await Employee.findAll({
            include: [{ model: User, attributes: ['id', 'email', 'role'] }]
        });

        // Helper to match an employee
        const findMatchingEmployee = (jobNo, name) => {
            const cleanJob = cleanCell(jobNo).toLowerCase();
            const cleanName = cleanCell(name).toLowerCase();

            // 1. Exact match by employee_id
            let match = existingEmployees.find(e => (e.employee_id || '').toLowerCase() === cleanJob);
            if (match) return match;

            // 2. Match by full name (High priority when jobNo is biometric machine ID like '1')
            if (cleanName) {
                match = existingEmployees.find(e => {
                    const fullName = `${e.first_name || ''} ${e.last_name || ''}`.trim().toLowerCase();
                    return fullName === cleanName;
                });
                if (match) return match;

                // 3. Match by first name and fuzzy last name (e.g. Kushawaha vs Kushwaha)
                const nameParts = cleanName.split(' ');
                if (nameParts.length > 0) {
                    match = existingEmployees.find(e => {
                        const fn = (e.first_name || '').toLowerCase();
                        const ln = (e.last_name || '').toLowerCase();
                        return fn === nameParts[0] && (nameParts.length === 1 || ln.startsWith(nameParts[1].substring(0, 3)));
                    });
                    if (match) return match;
                }
            }

            // 4. Fallback match by id / user_id
            if (cleanJob && cleanJob !== 'null' && cleanJob !== 'undefined') {
                match = existingEmployees.find(e => String(e.id) === cleanJob || String(e.user_id) === cleanJob);
                if (match) return match;
            }

            return null;
        };

        // Group records by (Employee Identifier, Date)
        const grouped = {};
        for (const record of rawRecords) {
            const empKey = record.sJobNo || record.sName;
            if (!empKey) continue;
            const key = `${empKey.trim()}___${record.date}`;
            if (!grouped[key]) {
                grouped[key] = {
                    sName: record.sName,
                    sJobNo: record.sJobNo,
                    date: record.date,
                    punches: []
                };
            }
            grouped[key].punches.push(record.time);
        }

        const groupKeys = Object.keys(grouped);
        const officeStartSec = timeToSeconds(OFFICE_START_TIME); // 9:30 AM = 34200
        const officeEndSec = timeToSeconds(OFFICE_END_TIME);     // 6:30 PM = 66600

        let insertedOrUpdated = 0;
        const uniqueDates = new Set();
        let newEmployeesCount = 0;

        for (const groupKey of groupKeys) {
            const item = grouped[groupKey];
            uniqueDates.add(item.date);

            // Sort punches chronologically
            item.punches.sort();
            const rawPunches = item.punches;
            const checkIn = rawPunches[0];
            const checkOut = rawPunches.length > 1 ? rawPunches[rawPunches.length - 1] : null;

            // Late Comer calculation (Office start: 09:30 AM)
            const inSec = timeToSeconds(checkIn);
            let lateMinutes = 0;
            let lateComment = '';
            if (inSec > officeStartSec) {
                lateMinutes = Math.floor((inSec - officeStartSec) / 60);
                lateComment = `Late by ${formatMinutes(lateMinutes)} (In: ${formatTime12(checkIn)})`;
            } else {
                lateComment = `On Time (In: ${formatTime12(checkIn)})`;
            }

            // Early Leaving calculation (Office end: 06:30 PM)
            let earlyLeaveMinutes = 0;
            let earlyLeaveComment = '';
            let workingHours = 0;

            if (checkOut) {
                const outSec = timeToSeconds(checkOut);
                if (outSec < officeEndSec) {
                    earlyLeaveMinutes = Math.floor((officeEndSec - outSec) / 60);
                    earlyLeaveComment = `Left early by ${formatMinutes(earlyLeaveMinutes)} (Out: ${formatTime12(checkOut)})`;
                } else {
                    earlyLeaveComment = `Full day completed (Out: ${formatTime12(checkOut)})`;
                }
                workingHours = parseFloat(((outSec - inSec) / 3600).toFixed(2));
                if (workingHours < 0) workingHours = 0;
            } else {
                earlyLeaveComment = 'No check-out recorded';
                workingHours = 0;
            }

            const remarks = `${lateComment} | ${earlyLeaveComment}`;

            // Match or create employee
            let matchedEmp = findMatchingEmployee(item.sJobNo, item.sName);
            if (!matchedEmp && item.sName && item.sName.toUpperCase() !== 'NULL') {
                try {
                    const nameParts = item.sName.trim().split(' ');
                    const firstName = nameParts[0] || 'Employee';
                    const lastName = nameParts.slice(1).join(' ') || 'Staff';
                    const safeJobNo = item.sJobNo && item.sJobNo !== 'NULL' && item.sJobNo !== '1' 
                        ? item.sJobNo 
                        : `PT${Date.now().toString().slice(-8)}`;
                    
                    const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/gi, '');
                    const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/gi, '');
                    const generatedEmail = `${cleanFirst || 'emp'}.${cleanLast || 'user'}${Math.floor(Math.random() * 899 + 100)}@company.com`;

                    const newUser = await User.create({
                        email: generatedEmail,
                        password: 'Password@123',
                        role: 'employee',
                        status: 'active'
                    });

                    matchedEmp = await Employee.create({
                        user_id: newUser.id,
                        employee_id: safeJobNo,
                        first_name: firstName,
                        last_name: lastName,
                        email: generatedEmail,
                        department: 'General',
                        position: 'Staff'
                    });
                    existingEmployees.push(matchedEmp);
                    newEmployeesCount++;
                } catch (autoErr) {
                    console.warn('Auto-create employee note:', autoErr.message);
                }
            }

            const employeeId = matchedEmp ? matchedEmp.id : null;
            const displayName = matchedEmp ? `${matchedEmp.first_name} ${matchedEmp.last_name}` : item.sName;
            const displayJobNo = matchedEmp ? matchedEmp.employee_id : item.sJobNo;

            // Check if record already exists for this date and employee/job
            const whereClause = {
                date: item.date,
                [Op.or]: []
            };
            if (employeeId) whereClause[Op.or].push({ employee_id: employeeId });
            if (displayJobNo) whereClause[Op.or].push({ job_no: displayJobNo });
            if (displayName) whereClause[Op.or].push({ employee_name: displayName });

            let existingAtt = null;
            if (whereClause[Op.or].length > 0) {
                existingAtt = await Attendance.findOne({ where: whereClause });
            }

            const attData = {
                employee_id: employeeId,
                job_no: displayJobNo,
                employee_name: displayName,
                date: item.date,
                check_in: checkIn,
                check_out: checkOut,
                status: 'present',
                late_minutes: lateMinutes,
                early_leave_minutes: earlyLeaveMinutes,
                remarks: remarks,
                working_hours: workingHours,
                raw_punches: JSON.stringify(rawPunches)
            };

            if (existingAtt) {
                await existingAtt.update(attData);
            } else {
                await Attendance.create(attData);
            }
            insertedOrUpdated++;
        }

        const sortedDates = Array.from(uniqueDates).sort();

        res.json({
            success: true,
            message: `Attendance CSV processed successfully! ${insertedOrUpdated} employee attendance records mapped across ${sortedDates.length} dates.`,
            data: {
                totalRows: rawRecords.length,
                recordsMapped: insertedOrUpdated,
                dates: sortedDates,
                newEmployeesCreated: newEmployeesCount,
                officeHours: '09:30 AM to 06:30 PM'
            }
        });
    } catch (error) {
        console.error('Error uploading attendance CSV:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process attendance CSV',
            error: error.message
        });
    }
};

// @desc    Get daily attendance report with Present, Absent, Late comers & Early leavers
// @route   GET /api/attendance/daily
// @access  Private
const getDailyAttendance = async (req, res) => {
    try {
        let { date, status, search } = req.query;

        // If no date provided, pick today's date if attendance exists, or latest date, or today's date
        if (!date) {
            const todayStr = moment().utcOffset('+05:30').format('YYYY-MM-DD');
            const todayAtt = await Attendance.findOne({ where: { date: todayStr } });
            if (todayAtt) {
                date = todayStr;
            } else {
                const latestAtt = await Attendance.findOne({
                    order: [['date', 'DESC']]
                });
                date = latestAtt ? latestAtt.date : todayStr;
            }
        } else {
            date = normalizeDate(date) || date;
        }

        // Check user role: Admin, HR and Manager see all staff; Employees only see their own attendance
        const isManagerial = ['admin', 'hr', 'manager'].includes(req.user?.role);
        let currentEmployee = null;
        if (!isManagerial && req.user) {
            currentEmployee = await Employee.findOne({
                where: { user_id: req.user.id }
            });
        }

        // 1. Fetch active employees
        const allEmployees = await Employee.findAll({
            include: [{
                model: User,
                attributes: ['id', 'email', 'role', 'status'],
                where: { status: 'active' },
                required: false
            }],
            order: [['first_name', 'ASC']]
        });

        // Filter employees list for non-managerial staff
        const employeesToProcess = isManagerial 
            ? allEmployees 
            : allEmployees.filter(e => currentEmployee && (e.id === currentEmployee.id || e.user_id === req.user.id));

        // 2. Fetch all attendance records for this date
        const dayAttendance = await Attendance.findAll({
            where: { date }
        });

        // Map attendance records by employee_id and also by job_no / name
        const attByEmpId = new Map();
        const attByJobNo = new Map();
        const attByName = new Map();

        dayAttendance.forEach(att => {
            if (att.employee_id) attByEmpId.set(att.employee_id, att);
            if (att.job_no) attByJobNo.set(cleanCell(att.job_no).toLowerCase(), att);
            if (att.employee_name) attByName.set(cleanCell(att.employee_name).toLowerCase(), att);
        });

        const matchedAttIds = new Set();
        const fullDayList = [];

        // 3. Process registered employees
        for (const emp of employeesToProcess) {
            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
            const cleanJob = cleanCell(emp.employee_id).toLowerCase();
            const cleanName = fullName.toLowerCase();

            let attRecord = attByEmpId.get(emp.id) || 
                           attByJobNo.get(cleanJob) || 
                           attByName.get(cleanName);

            if (attRecord) {
                matchedAttIds.add(attRecord.id);

                const isLate = (attRecord.late_minutes || 0) > 0;
                const isEarlyLeave = (attRecord.early_leave_minutes || 0) > 0;
                const isOnTime = !isLate && !isEarlyLeave && !!attRecord.check_out;

                let lateComment = isLate 
                    ? `Late by ${formatMinutes(attRecord.late_minutes)} (Arrival: ${formatTime12(attRecord.check_in)})`
                    : `On Time (Arrival: ${formatTime12(attRecord.check_in)})`;

                let earlyLeaveComment = '';
                if (attRecord.check_out) {
                    earlyLeaveComment = isEarlyLeave
                        ? `Left early by ${formatMinutes(attRecord.early_leave_minutes)} (Departure: ${formatTime12(attRecord.check_out)})`
                        : `Completed full day (Departure: ${formatTime12(attRecord.check_out)})`;
                } else {
                    earlyLeaveComment = 'Missed check-out punch';
                }

                const istMoment = moment().utcOffset(IST_OFFSET);
                const {
                    grossHours,
                    systemOffMinutes: currentOffMinutes,
                    netWorkingHours,
                    isLiveOff
                } = calculateShiftAttendanceMetrics(attRecord, istMoment);

                fullDayList.push({
                    id: attRecord.id,
                    employee_id: emp.id,
                    job_no: emp.employee_id || attRecord.job_no,
                    name: fullName,
                    email: emp.email,
                    department: emp.department || 'General',
                    position: emp.position || 'Staff',
                    date: date,
                    status: 'present',
                    is_present: true,
                    is_absent: false,
                    is_late: isLate,
                    late_minutes: attRecord.late_minutes || 0,
                    late_comment: lateComment,
                    is_early_leave: isEarlyLeave,
                    early_leave_minutes: attRecord.early_leave_minutes || 0,
                    early_leave_comment: earlyLeaveComment,
                    check_in: attRecord.check_in,
                    check_in_formatted: formatTime12(attRecord.check_in),
                    check_in_image: attRecord.check_in_image || null,
                    check_out: attRecord.check_out,
                    check_out_formatted: formatTime12(attRecord.check_out),
                    check_out_image: attRecord.check_out_image || null,
                    working_hours: grossHours,
                    working_hours_formatted: `${Math.floor(grossHours)}h ${Math.round((grossHours % 1) * 60)}m`,
                    system_off_minutes: currentOffMinutes,
                    system_off_formatted: formatMinutes(currentOffMinutes),
                    net_working_hours: netWorkingHours,
                    is_live_off: isLiveOff,
                    remarks: attRecord.remarks || `${lateComment} | ${earlyLeaveComment}`,
                    raw_punches: attRecord.raw_punches ? JSON.parse(attRecord.raw_punches) : [],
                    is_on_time: isOnTime
                });
            } else {
                // ABSENT EMPLOYEE
                fullDayList.push({
                    id: `absent_${emp.id}`,
                    employee_id: emp.id,
                    job_no: emp.employee_id || '--',
                    name: fullName,
                    email: emp.email,
                    department: emp.department || 'General',
                    position: emp.position || 'Staff',
                    date: date,
                    status: 'absent',
                    is_present: false,
                    is_absent: true,
                    is_late: false,
                    late_minutes: 0,
                    late_comment: 'Absent',
                    is_early_leave: false,
                    early_leave_minutes: 0,
                    early_leave_comment: 'Absent',
                    check_in: null,
                    check_in_formatted: '--:--',
                    check_out: null,
                    check_out_formatted: '--:--',
                    working_hours: 0,
                    working_hours_formatted: '0h 0m',
                    system_off_minutes: 0,
                    system_off_formatted: '0m',
                    net_working_hours: 0,
                    is_live_off: false,
                    remarks: 'Absent (No punch recorded)',
                    raw_punches: [],
                    is_on_time: false
                });
            }
        }

        // 4. Include any attendance records for this date not mapped to an existing employee (Managers/Admins only)
        if (isManagerial) {
            dayAttendance.forEach(att => {
                if (!matchedAttIds.has(att.id)) {
                    const isLate = (att.late_minutes || 0) > 0;
                    const isEarlyLeave = (att.early_leave_minutes || 0) > 0;

                    const istMoment = moment().utcOffset(IST_OFFSET);
                    const {
                        grossHours,
                        systemOffMinutes: currentOffMinutes,
                        netWorkingHours,
                        isLiveOff
                    } = calculateShiftAttendanceMetrics(att, istMoment);

                    fullDayList.push({
                        id: att.id,
                        employee_id: att.employee_id,
                        job_no: att.job_no || '--',
                        name: att.employee_name || 'Guest/Unmapped Employee',
                        email: '--',
                        department: 'Operations',
                        position: 'Staff',
                        date: date,
                        status: 'present',
                        is_present: true,
                        is_absent: false,
                        is_late: isLate,
                        late_minutes: att.late_minutes || 0,
                        late_comment: isLate ? `Late by ${formatMinutes(att.late_minutes)}` : 'On Time',
                        is_early_leave: isEarlyLeave,
                        early_leave_minutes: att.early_leave_minutes || 0,
                        early_leave_comment: isEarlyLeave ? `Left early by ${formatMinutes(att.early_leave_minutes)}` : 'Completed',
                        check_in: att.check_in,
                        check_in_formatted: formatTime12(att.check_in),
                        check_in_image: att.check_in_image || null,
                        check_out: att.check_out,
                        check_out_formatted: formatTime12(att.check_out),
                        check_out_image: att.check_out_image || null,
                        working_hours: grossHours,
                        working_hours_formatted: `${Math.floor(grossHours)}h ${Math.round(((grossHours % 1) * 60))}m`,
                        system_off_minutes: currentOffMinutes,
                        system_off_formatted: formatMinutes(currentOffMinutes),
                        net_working_hours: netWorkingHours,
                        is_live_off: isLiveOff,
                        remarks: att.remarks,
                        raw_punches: att.raw_punches ? JSON.parse(att.raw_punches) : [],
                        is_on_time: !isLate && !isEarlyLeave && !!att.check_out
                    });
                }
            });
        }

        // 5. Compute Summary Metrics
        const totalEmployees = fullDayList.length;
        const presentCount = fullDayList.filter(r => r.is_present).length;
        const absentCount = fullDayList.filter(r => r.is_absent).length;
        const lateCount = fullDayList.filter(r => r.is_late).length;
        const earlyLeaveCount = fullDayList.filter(r => r.is_early_leave).length;
        const onTimeCount = fullDayList.filter(r => r.is_on_time).length;
        const systemOffCount = fullDayList.filter(r => r.is_present && (r.system_off_minutes || 0) > 0).length;

        // 6. Filtering & Searching
        let filteredList = fullDayList;
        if (status && status !== 'all') {
            if (status === 'present') filteredList = filteredList.filter(r => r.is_present);
            else if (status === 'absent') filteredList = filteredList.filter(r => r.is_absent);
            else if (status === 'late') filteredList = filteredList.filter(r => r.is_late);
            else if (status === 'early_leave') filteredList = filteredList.filter(r => r.is_early_leave);
            else if (status === 'on_time') filteredList = filteredList.filter(r => r.is_on_time);
            else if (status === 'system_off') filteredList = filteredList.filter(r => r.is_present && (r.system_off_minutes || 0) > 0);
        }

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            filteredList = filteredList.filter(r => 
                (r.name && r.name.toLowerCase().includes(q)) ||
                (r.job_no && String(r.job_no).toLowerCase().includes(q)) ||
                (r.department && r.department.toLowerCase().includes(q))
            );
        }

        // Available dates in DB for quick date switcher
        const allDistinctDates = await Attendance.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('date')), 'date']],
            order: [['date', 'DESC']],
            raw: true
        });
        const availableDates = allDistinctDates.map(d => d.date);

        res.json({
            success: true,
            date,
            officeTiming: {
                start: OFFICE_START_TIME,
                end: OFFICE_END_TIME,
                display: '09:30 AM to 06:30 PM'
            },
            summary: {
                totalEmployees,
                presentCount,
                absentCount,
                lateCount,
                earlyLeaveCount,
                onTimeCount,
                systemOffCount
            },
            availableDates,
            data: filteredList
        });
    } catch (error) {
        console.error('Get daily attendance error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get all distinct dates with attendance data
// @route   GET /api/attendance/dates
// @access  Private
const getAttendanceDates = async (req, res) => {
    try {
        const dates = await Attendance.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('date')), 'date']],
            order: [['date', 'DESC']],
            raw: true
        });
        res.json({
            success: true,
            data: dates.map(d => d.date)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Self Check in
// @route   POST /api/attendance/check-in
// @access  Private
const checkIn = async (req, res) => {
    try {
        // Restrict punch-in on mobile devices: attendance punch is strictly required via desktop/laptop system
        if (isMobileRequest(req)) {
            return res.status(403).json({
                success: false,
                message: 'Punch-In is restricted on mobile devices. Attendance punches are strictly required to be recorded from an office desktop or laptop system.'
            });
        }

        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Use client current date/time if provided, otherwise fallback to IST (+05:30)
        const istMoment = moment().utcOffset('+05:30');
        const today = req.body.date || istMoment.format('YYYY-MM-DD');
        let nowTime = req.body.time || istMoment.format('HH:mm:ss');
        if (nowTime && nowTime.length === 5) nowTime = `${nowTime}:00`;

        const existingAttendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        if (existingAttendance && existingAttendance.check_in && !req.body.allowUpdate) {
            return res.status(400).json({ message: 'Already checked in today' });
        }

        const inSec = timeToSeconds(nowTime);
        const officeStartSec = timeToSeconds(OFFICE_START_TIME);
        let lateMinutes = 0;
        let lateComment = '';
        if (inSec > officeStartSec) {
            lateMinutes = Math.floor((inSec - officeStartSec) / 60);
            lateComment = `Late by ${formatMinutes(lateMinutes)} (In: ${formatTime12(nowTime)})`;
        } else {
            lateComment = `On Time (In: ${formatTime12(nowTime)})`;
        }

        const savedImage = req.body.image ? savePunchImage(req.body.image, employee.id, 'in') : null;

        let attendance;
        if (existingAttendance) {
            let currentPunches = [];
            try {
                currentPunches = existingAttendance.raw_punches ? JSON.parse(existingAttendance.raw_punches) : [];
            } catch (e) {
                currentPunches = [];
            }
            if (!currentPunches.includes(nowTime)) {
                currentPunches.unshift(nowTime);
            }

            const updateData = {
                check_in: nowTime,
                status: 'present',
                late_minutes: lateMinutes,
                remarks: lateComment,
                system_off_minutes: 0,
                net_working_hours: 0,
                last_activity_time: new Date(),
                raw_punches: JSON.stringify(currentPunches.length > 0 ? currentPunches : [nowTime])
            };
            if (savedImage) {
                updateData.check_in_image = savedImage;
            }

            await existingAttendance.update(updateData);
            attendance = existingAttendance;
        } else {
            attendance = await Attendance.create({
                employee_id: employee.id,
                job_no: employee.employee_id,
                employee_name: `${employee.first_name} ${employee.last_name}`,
                date: today,
                check_in: nowTime,
                check_in_image: savedImage,
                status: 'present',
                late_minutes: lateMinutes,
                remarks: lateComment,
                system_off_minutes: 0,
                net_working_hours: 0,
                last_activity_time: new Date(),
                raw_punches: JSON.stringify([nowTime])
            });
        }

        res.json({
            success: true,
            message: 'Checked in successfully',
            data: {
                ...attendance.toJSON(),
                check_in_formatted: formatTime12(nowTime),
                check_in_image: savedImage || attendance.check_in_image || null,
                system_off_minutes: 0,
                net_working_hours: 0
            }
        });
    } catch (error) {
        console.error('Check in error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Self Check out
// @route   POST /api/attendance/check-out
// @access  Private
const checkOut = async (req, res) => {
    try {
        // Restrict punch-out on mobile devices: attendance punch is strictly required via desktop/laptop system
        if (isMobileRequest(req)) {
            return res.status(403).json({
                success: false,
                message: 'Punch-Out is restricted on mobile devices. Attendance punches are strictly required to be recorded from an office desktop or laptop system.'
            });
        }

        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Use client current date/time if provided, otherwise fallback to IST (+05:30)
        const istMoment = moment().utcOffset('+05:30');
        const today = req.body.date || istMoment.format('YYYY-MM-DD');
        let checkOutTime = req.body.time || istMoment.format('HH:mm:ss');
        if (checkOutTime && checkOutTime.length === 5) checkOutTime = `${checkOutTime}:00`;

        const attendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        if (!attendance) {
            return res.status(404).json({ message: 'No check-in found for today' });
        }

        if (attendance.check_out && !req.body.allowUpdate) {
            return res.status(400).json({ message: 'Already checked out' });
        }

        const checkInMoment = parseISTDateTime(attendance.date, attendance.check_in);
        const checkOutMoment = parseISTDateTime(attendance.date, checkOutTime);
        const workingHours = (checkInMoment && checkOutMoment)
            ? parseFloat(Math.max(0, checkOutMoment.diff(checkInMoment, 'hours', true)).toFixed(2))
            : 0;

        const bounds = (checkInMoment && checkOutMoment)
            ? getShiftTrackingBounds(attendance.date, attendance.check_in, checkOutMoment)
            : null;
        const maxPossibleOff = bounds ? bounds.maxPossibleOffMinutes : 0;

        const storedOff = Math.max(0, parseInt(attendance.system_off_minutes, 10) || 0);
        const clientOff = req.body.system_off_minutes !== undefined
            ? Math.max(0, parseInt(req.body.system_off_minutes, 10) || 0)
            : storedOff;
        let systemOffMinutes = Math.min(maxPossibleOff, Math.max(storedOff, clientOff));

        // Account for any unlogged gap strictly inside 09:30 AM - 06:30 PM IST before punch out
        if (attendance.last_activity_time && bounds && bounds.effectiveEndMs > bounds.effectiveStartMs) {
            const lastActMs = moment(attendance.last_activity_time).valueOf();
            if (!isNaN(lastActMs)) {
                const clampedStartMs = Math.max(lastActMs, bounds.effectiveStartMs);
                if (bounds.effectiveEndMs > clampedStartMs) {
                    const gapMinutes = Math.floor((bounds.effectiveEndMs - clampedStartMs) / 60000);
                    if (gapMinutes > IDLE_THRESHOLD_MINUTES) {
                        const unloggedOff = gapMinutes - IDLE_THRESHOLD_MINUTES;
                        systemOffMinutes = Math.min(maxPossibleOff, Math.max(systemOffMinutes, storedOff + unloggedOff));
                    }
                }
            }
        }

        const grossHours = workingHours > 0 ? workingHours : 0;
        const offHours = systemOffMinutes / 60;
        const netWorkingHours = parseFloat(Math.max(0, grossHours - offHours).toFixed(2));

        const outSec = timeToSeconds(checkOutTime);
        const officeEndSec = timeToSeconds(OFFICE_END_TIME);
        let earlyLeaveMinutes = 0;
        let earlyLeaveComment = '';

        if (outSec < officeEndSec) {
            earlyLeaveMinutes = Math.floor((officeEndSec - outSec) / 60);
            earlyLeaveComment = `Left early by ${formatMinutes(earlyLeaveMinutes)} (Out: ${formatTime12(checkOutTime)})`;
        } else {
            earlyLeaveComment = `Completed full day (Out: ${formatTime12(checkOutTime)})`;
        }

        let currentPunches = [];
        try {
            currentPunches = attendance.raw_punches ? JSON.parse(attendance.raw_punches) : [attendance.check_in];
        } catch (e) {
            currentPunches = [attendance.check_in];
        }
        if (!currentPunches.includes(checkOutTime)) {
            currentPunches.push(checkOutTime);
        }

        const savedImage = req.body.image ? savePunchImage(req.body.image, employee.id, 'out') : null;

        const updatedRemarks = `${attendance.remarks || ''} | ${earlyLeaveComment}`.replace(/^ \| /, '');

        const updateData = {
            check_out: checkOutTime,
            working_hours: grossHours,
            system_off_minutes: systemOffMinutes,
            net_working_hours: netWorkingHours,
            last_activity_time: new Date(),
            early_leave_minutes: earlyLeaveMinutes,
            remarks: updatedRemarks,
            raw_punches: JSON.stringify(currentPunches)
        };
        if (savedImage) {
            updateData.check_out_image = savedImage;
        }

        await attendance.update(updateData);

        res.json({
            success: true,
            message: 'Checked out successfully',
            data: {
                ...attendance.toJSON(),
                check_out_formatted: formatTime12(checkOutTime),
                check_out_image: savedImage || attendance.check_out_image || null,
                system_off_minutes: systemOffMinutes,
                net_working_hours: netWorkingHours
            }
        });
    } catch (error) {
        console.error('Check out error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Sync employee system off / idle time during the workday
// @route   POST /api/attendance/sync-system-off-time
// @access  Private
const syncSystemOffTime = async (req, res) => {
    try {
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const istMoment = moment().utcOffset(IST_OFFSET);
        const today = req.body.date || istMoment.format('YYYY-MM-DD');
        const requestedOff = Math.max(0, parseInt(req.body.system_off_minutes, 10) || 0);

        const attendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        if (!attendance) {
            return res.status(404).json({ success: false, message: 'No attendance record found for today' });
        }

        // Only track system off time if employee has checked in
        if (!attendance.check_in) {
            return res.status(400).json({ success: false, message: 'Employee has not checked in today' });
        }

        if (attendance.check_out) {
            return res.json({
                success: true,
                message: 'Already checked out; system off time finalized',
                data: {
                    system_off_minutes: attendance.system_off_minutes || 0,
                    net_working_hours: parseFloat(attendance.net_working_hours || attendance.working_hours || 0),
                    working_hours: parseFloat(attendance.working_hours || 0),
                    last_activity_time: attendance.last_activity_time
                }
            });
        }

        // Compute current working hours & clamp off time to 09:30 AM - 06:30 PM IST
        const inTime = parseISTDateTime(today, attendance.check_in);
        const grossHours = inTime
            ? parseFloat(Math.max(0, istMoment.diff(inTime, 'hours', true)).toFixed(2))
            : (parseFloat(attendance.working_hours) || 0);

        const bounds = getShiftTrackingBounds(today, attendance.check_in, istMoment);
        const maxPossibleOff = bounds ? bounds.maxPossibleOffMinutes : 0;
        const systemOffMinutes = Math.min(
            maxPossibleOff,
            Math.max(parseInt(attendance.system_off_minutes, 10) || 0, requestedOff)
        );

        const offHours = systemOffMinutes / 60;
        const netHours = parseFloat(Math.max(0, grossHours - offHours).toFixed(2));

        await attendance.update({
            system_off_minutes: systemOffMinutes,
            net_working_hours: netHours,
            last_activity_time: new Date()
        });

        res.json({
            success: true,
            message: 'System off time synced successfully',
            data: {
                system_off_minutes: systemOffMinutes,
                net_working_hours: netHours,
                working_hours: grossHours,
                last_activity_time: new Date()
            }
        });
    } catch (error) {
        console.error('Error syncing system off time:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Record employee live activity heartbeat while checked in
// @route   POST /api/attendance/heartbeat
// @access  Private
const recordHeartbeat = async (req, res) => {
    try {
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const istMoment = moment().utcOffset('+05:30');
        const today = req.body.date || istMoment.format('YYYY-MM-DD');

        const attendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        if (!attendance || !attendance.check_in || attendance.check_out) {
            return res.json({ success: true, message: 'No active checked-in session' });
        }

        const now = new Date();
        const updateData = { last_activity_time: now };

        const inTime = parseISTDateTime(today, attendance.check_in);
        const grossHours = inTime
            ? parseFloat(Math.max(0, istMoment.diff(inTime, 'hours', true)).toFixed(2))
            : 0;

        const bounds = getShiftTrackingBounds(today, attendance.check_in, istMoment);
        const maxPossibleOff = bounds ? bounds.maxPossibleOffMinutes : 0;
        const existingOff = Math.max(0, parseInt(attendance.system_off_minutes, 10) || 0);
        const parsedClientOff = req.body.system_off_minutes !== undefined
            ? parseInt(req.body.system_off_minutes, 10)
            : NaN;
        const candidateOff = !isNaN(parsedClientOff) ? Math.max(existingOff, parsedClientOff) : existingOff;
        const clampedOff = Math.min(maxPossibleOff, Math.max(0, candidateOff));

        updateData.system_off_minutes = clampedOff;
        updateData.net_working_hours = parseFloat(Math.max(0, grossHours - (clampedOff / 60)).toFixed(2));

        await attendance.update(updateData);
        res.json({
            success: true,
            data: {
                last_activity_time: now,
                system_off_minutes: updateData.system_off_minutes !== undefined ? updateData.system_off_minutes : (attendance.system_off_minutes || 0)
            }
        });
    } catch (err) {
        console.error('Heartbeat error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get personal attendance stats
// @route   GET /api/attendance/stats
// @access  Private
const getAttendanceStats = async (req, res) => {
    try {
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const istMoment = moment().utcOffset('+05:30');
        const today = req.query.date || istMoment.format('YYYY-MM-DD');
        const todayAttendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        const monthStart = istMoment.clone().startOf('month').format('YYYY-MM-DD');
        const monthEnd = istMoment.clone().endOf('month').format('YYYY-MM-DD');
        const monthlyAttendance = await Attendance.findAll({
            where: {
                employee_id: employee.id,
                date: {
                    [Op.between]: [monthStart, monthEnd]
                }
            }
        });

        const monthlyStats = {
            present: 0,
            absent: 0,
            late: 0,
            'half-day': 0
        };

        monthlyAttendance.forEach(record => {
            if (record.late_minutes > 0) {
                monthlyStats.late++;
            }
            if (monthlyStats[record.status] !== undefined) {
                monthlyStats[record.status]++;
            }
        });

        const todayStatus = todayAttendance ? 
            (todayAttendance.check_out ? 'checked-out' : 'checked-in') : 
            'not-checked-in';

        const liveMetrics = todayAttendance
            ? calculateShiftAttendanceMetrics(todayAttendance, istMoment)
            : { grossHours: 0, systemOffMinutes: 0, netWorkingHours: 0, isLiveOff: false };

        res.json({
            success: true,
            data: {
                todayStatus,
                checkInTime: todayAttendance?.check_in ? formatTime12(todayAttendance.check_in) : null,
                checkOutTime: todayAttendance?.check_out ? formatTime12(todayAttendance.check_out) : null,
                checkInImage: todayAttendance?.check_in_image || null,
                checkOutImage: todayAttendance?.check_out_image || null,
                rawCheckIn: todayAttendance?.check_in || null,
                rawCheckOut: todayAttendance?.check_out || null,
                systemOffMinutes: liveMetrics.systemOffMinutes,
                netWorkingHours: liveMetrics.netWorkingHours,
                workingHours: liveMetrics.grossHours,
                lastActivityTime: todayAttendance?.last_activity_time || null,
                monthlyStats
            }
        });
    } catch (error) {
        console.error('Get attendance stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get complete monthly/yearly attendance for a specific employee
// @route   GET /api/attendance/employee-monthly
// @access  Private
const getEmployeeMonthlyAttendance = async (req, res) => {
    try {
        let { employeeId, year, month, status, dateSearch } = req.query;

        // Non-managerial staff can ONLY access their own monthly records
        const isManagerial = ['admin', 'hr', 'manager'].includes(req.user?.role);
        let targetEmployeeId = employeeId;

        if (!isManagerial && req.user) {
            const currentEmp = await Employee.findOne({
                where: { user_id: req.user.id }
            });
            if (!currentEmp) {
                return res.status(404).json({ success: false, message: 'Employee profile not found' });
            }
            targetEmployeeId = currentEmp.id;
        } else if (!targetEmployeeId) {
            return res.status(400).json({ success: false, message: 'employeeId parameter is required' });
        }

        // 1. Find employee
        let employee = await Employee.findOne({
            where: {
                [Op.or]: [
                    { id: targetEmployeeId },
                    { employee_id: targetEmployeeId },
                    { user_id: targetEmployeeId }
                ]
            },
            include: [{ model: User, attributes: ['id', 'email', 'role'] }]
        });

        // Fallback: If employee not found in employees table, check attendance table
        let displayName = employee ? `${employee.first_name} ${employee.last_name}` : null;
        let displayJobNo = employee ? employee.employee_id : targetEmployeeId;

        if (!employee) {
            const attSample = await Attendance.findOne({
                where: {
                    [Op.or]: [
                        { employee_id: employeeId },
                        { job_no: employeeId },
                        { employee_name: employeeId }
                    ]
                }
            });
            if (attSample) {
                displayName = attSample.employee_name;
                displayJobNo = attSample.job_no;
            } else {
                return res.status(404).json({ success: false, message: 'Employee not found' });
            }
        }

        // Available years and months for this employee
        const distinctDates = await Attendance.findAll({
            where: {
                [Op.or]: [
                    ...(employee ? [{ employee_id: employee.id }] : []),
                    { job_no: displayJobNo },
                    ...(displayName ? [{ employee_name: displayName }] : [])
                ]
            },
            attributes: ['date'],
            order: [['date', 'DESC']],
            raw: true
        });

        const availableMonths = [...new Set(distinctDates.map(d => d.date.substring(0, 7)))];
        const availableYears = [...new Set(distinctDates.map(d => parseInt(d.date.substring(0, 4), 10)))];

        // Determine selected year and month
        const latestDate = distinctDates.length > 0 ? distinctDates[0].date : moment().format('YYYY-MM-DD');
        const selectedYear = year ? parseInt(year, 10) : parseInt(latestDate.substring(0, 4), 10);
        const selectedMonth = month && month !== 'all' ? parseInt(month, 10) : (month === 'all' ? 'all' : parseInt(latestDate.substring(5, 7), 10));

        // Construct date range
        let startDate, endDate;
        if (selectedMonth === 'all') {
            startDate = moment([selectedYear, 0, 1]);
            endDate = moment([selectedYear, 11, 31]);
        } else {
            startDate = moment([selectedYear, selectedMonth - 1, 1]);
            endDate = moment([selectedYear, selectedMonth - 1]).endOf('month');
        }

        // 2. Fetch all attendance records in this range
        const attendanceRecords = await Attendance.findAll({
            where: {
                [Op.and]: [
                    {
                        date: {
                            [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
                        }
                    },
                    {
                        [Op.or]: [
                            ...(employee ? [{ employee_id: employee.id }] : []),
                            { job_no: displayJobNo },
                            ...(displayName ? [{ employee_name: displayName }] : [])
                        ]
                    }
                ]
            },
            order: [['date', 'ASC']]
        });

        const attByDate = new Map();
        attendanceRecords.forEach(att => attByDate.set(att.date, att));

        // 3. Fetch any holidays in range
        let holidays = [];
        try {
            holidays = await Holiday.findAll({
                where: {
                    holiday_date: {
                        [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
                    }
                }
            });
        } catch (hErr) {}
        const holidayByDate = new Map();
        holidays.forEach(h => holidayByDate.set(h.holiday_date, h));

        // 4. Build day-by-day roster
        const days = [];
        let cur = moment(startDate);

        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let earlyLeaveCount = 0;
        let onTimeCount = 0;
        let weekendCount = 0;
        let holidayCount = 0;
        let totalWorkingHours = 0;
        let totalSystemOffMinutes = 0;
        let totalNetWorkingHours = 0;
        const istMoment = moment().utcOffset(IST_OFFSET);

        while (cur.isSameOrBefore(endDate)) {
            const dateStr = cur.format('YYYY-MM-DD');
            const dayOfWeek = cur.day();
            const isSunday = dayOfWeek === 0;
            const att = attByDate.get(dateStr);
            const holiday = holidayByDate.get(dateStr);

            if (att) {
                presentCount++;
                const isLate = (att.late_minutes || 0) > 0;
                const isEarlyLeave = (att.early_leave_minutes || 0) > 0;
                const isOnTime = !isLate && !isEarlyLeave && !!att.check_out;
                const {
                    grossHours: wHours,
                    systemOffMinutes: offMinutes,
                    netWorkingHours: netHours
                } = calculateShiftAttendanceMetrics(att, istMoment);

                totalWorkingHours += wHours;
                totalSystemOffMinutes += offMinutes;
                totalNetWorkingHours += netHours;

                if (isLate) lateCount++;
                if (isEarlyLeave) earlyLeaveCount++;
                if (isOnTime) onTimeCount++;

                let lateComment = isLate 
                    ? `Late by ${formatMinutes(att.late_minutes)} (In: ${formatTime12(att.check_in)})`
                    : `On Time (In: ${formatTime12(att.check_in)})`;

                let earlyLeaveComment = '';
                if (att.check_out) {
                    earlyLeaveComment = isEarlyLeave
                        ? `Left early by ${formatMinutes(att.early_leave_minutes)} (Out: ${formatTime12(att.check_out)})`
                        : `Full day completed (Out: ${formatTime12(att.check_out)})`;
                } else {
                    earlyLeaveComment = 'Missed check-out punch';
                }

                days.push({
                    date: dateStr,
                    dayOfWeek: cur.format('ddd'),
                    fullDay: cur.format('dddd'),
                    dayOfMonth: cur.date(),
                    isWeekend: isSunday,
                    isHoliday: false,
                    holidayName: null,
                    status: 'present',
                    is_present: true,
                    is_absent: false,
                    is_late: isLate,
                    late_minutes: att.late_minutes || 0,
                    late_comment: lateComment,
                    is_early_leave: isEarlyLeave,
                    early_leave_minutes: att.early_leave_minutes || 0,
                    early_leave_comment: earlyLeaveComment,
                    check_in: att.check_in,
                    check_in_formatted: formatTime12(att.check_in),
                    check_in_image: att.check_in_image || null,
                    check_out: att.check_out,
                    check_out_formatted: formatTime12(att.check_out),
                    check_out_image: att.check_out_image || null,
                    working_hours: wHours,
                    working_hours_formatted: `${Math.floor(wHours)}h ${Math.round((wHours % 1) * 60)}m`,
                    system_off_minutes: offMinutes,
                    system_off_formatted: formatMinutes(offMinutes),
                    net_working_hours: netHours,
                    remarks: att.remarks || `${lateComment} | ${earlyLeaveComment}`,
                    raw_punches: att.raw_punches ? JSON.parse(att.raw_punches) : [],
                    is_on_time: isOnTime
                });
            } else if (holiday) {
                holidayCount++;
                days.push({
                    date: dateStr,
                    dayOfWeek: cur.format('ddd'),
                    fullDay: cur.format('dddd'),
                    dayOfMonth: cur.date(),
                    isWeekend: isSunday,
                    isHoliday: true,
                    holidayName: holiday.holiday_name,
                    status: 'holiday',
                    is_present: false,
                    is_absent: false,
                    is_late: false,
                    late_minutes: 0,
                    late_comment: '-',
                    is_early_leave: false,
                    early_leave_minutes: 0,
                    early_leave_comment: '-',
                    check_in: null,
                    check_in_formatted: '--:--',
                    check_out: null,
                    check_out_formatted: '--:--',
                    working_hours: 0,
                    working_hours_formatted: '0h 0m',
                    remarks: `Holiday: ${holiday.holiday_name}`,
                    raw_punches: [],
                    is_on_time: false
                });
            } else if (isSunday) {
                weekendCount++;
                days.push({
                    date: dateStr,
                    dayOfWeek: cur.format('ddd'),
                    fullDay: cur.format('dddd'),
                    dayOfMonth: cur.date(),
                    isWeekend: true,
                    isHoliday: false,
                    holidayName: null,
                    status: 'weekend',
                    is_present: false,
                    is_absent: false,
                    is_late: false,
                    late_minutes: 0,
                    late_comment: '-',
                    is_early_leave: false,
                    early_leave_minutes: 0,
                    early_leave_comment: '-',
                    check_in: null,
                    check_in_formatted: '--:--',
                    check_out: null,
                    check_out_formatted: '--:--',
                    working_hours: 0,
                    working_hours_formatted: '0h 0m',
                    remarks: 'Weekly Off (Sunday)',
                    raw_punches: [],
                    is_on_time: false
                });
            } else {
                // Working day with NO punch
                absentCount++;
                days.push({
                    date: dateStr,
                    dayOfWeek: cur.format('ddd'),
                    fullDay: cur.format('dddd'),
                    dayOfMonth: cur.date(),
                    isWeekend: false,
                    isHoliday: false,
                    holidayName: null,
                    status: 'absent',
                    is_present: false,
                    is_absent: true,
                    is_late: false,
                    late_minutes: 0,
                    late_comment: 'Absent',
                    is_early_leave: false,
                    early_leave_minutes: 0,
                    early_leave_comment: 'Absent',
                    check_in: null,
                    check_in_formatted: '--:--',
                    check_out: null,
                    check_out_formatted: '--:--',
                    working_hours: 0,
                    working_hours_formatted: '0h 0m',
                    remarks: 'Absent (No punch recorded)',
                    raw_punches: [],
                    is_on_time: false
                });
            }
            cur.add(1, 'day');
        }

        // Apply filters to days list
        let filteredDays = days;
        if (status && status !== 'all') {
            if (status === 'working_days') filteredDays = filteredDays.filter(d => !d.isWeekend && !d.isHoliday);
            else if (status === 'present') filteredDays = filteredDays.filter(d => d.is_present);
            else if (status === 'absent') filteredDays = filteredDays.filter(d => d.is_absent);
            else if (status === 'late') filteredDays = filteredDays.filter(d => d.is_late);
            else if (status === 'early_leave') filteredDays = filteredDays.filter(d => d.is_early_leave);
            else if (status === 'on_time') filteredDays = filteredDays.filter(d => d.is_on_time);
            else if (status === 'system_off') filteredDays = filteredDays.filter(d => d.is_present && (d.system_off_minutes || 0) > 0);
            else if (status === 'weekend') filteredDays = filteredDays.filter(d => d.isWeekend);
            else if (status === 'holiday') filteredDays = filteredDays.filter(d => d.isHoliday);
        }

        if (dateSearch && dateSearch.trim()) {
            const q = dateSearch.trim().toLowerCase();
            filteredDays = filteredDays.filter(d => 
                d.date.includes(q) || d.dayOfWeek.toLowerCase().includes(q) || d.fullDay.toLowerCase().includes(q)
            );
        }

        const workingDays = days.length - weekendCount - holidayCount;
        const avgWorkingHours = presentCount > 0 ? parseFloat((totalWorkingHours / presentCount).toFixed(2)) : 0;

        res.json({
            success: true,
            employee: {
                id: employee ? employee.id : null,
                employee_id: displayJobNo,
                name: displayName,
                email: employee ? employee.email : '--',
                department: employee ? employee.department : 'General',
                position: employee ? employee.position : 'Staff'
            },
            year: selectedYear,
            month: selectedMonth,
            monthName: selectedMonth === 'all' ? 'All Months' : moment([selectedYear, selectedMonth - 1, 1]).format('MMMM'),
            officeTiming: {
                start: OFFICE_START_TIME,
                end: OFFICE_END_TIME,
                display: '09:30 AM to 06:30 PM'
            },
            summary: {
                totalDays: days.length,
                workingDays,
                presentCount,
                absentCount,
                lateCount,
                earlyLeaveCount,
                onTimeCount,
                weekendCount,
                holidayCount,
                totalWorkingHours: parseFloat(totalWorkingHours.toFixed(2)),
                totalSystemOffMinutes,
                totalSystemOffFormatted: formatMinutes(totalSystemOffMinutes),
                totalNetWorkingHours: parseFloat(totalNetWorkingHours.toFixed(2)),
                avgWorkingHours
            },
            availableMonths,
            availableYears,
            days: filteredDays
        });
    } catch (error) {
        console.error('Get employee monthly attendance error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Manually record or update employee attendance for any date
// @route   POST /api/attendance/manual-entry
// @access  Private (Admin, HR, Manager)
const saveManualAttendance = async (req, res) => {
    try {
        const {
            employee_id,
            date,
            check_in,
            check_out,
            status,
            system_off_minutes,
            remarks
        } = req.body;

        if (!employee_id) {
            return res.status(400).json({ success: false, message: 'Please select an employee' });
        }

        if (!date) {
            return res.status(400).json({ success: false, message: 'Please select a date' });
        }

        // Validate date format YYYY-MM-DD
        if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Expected YYYY-MM-DD' });
        }

        let employee = await Employee.findByPk(employee_id);
        if (!employee) {
            employee = await Employee.findOne({ where: { employee_id: employee_id } });
        }
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const normalizeTime = (t) => {
            if (!t || typeof t !== 'string' || t.trim() === '' || t === '--:--') return null;
            const s = t.trim();
            if (/^\d{1,2}:\d{2}$/.test(s)) {
                const parts = s.split(':');
                return `${parts[0].padStart(2, '0')}:${parts[1]}:00`;
            }
            if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
                const parts = s.split(':');
                return `${parts[0].padStart(2, '0')}:${parts[1]}:${parts[2]}`;
            }
            return s;
        };

        const checkInTime = normalizeTime(check_in);
        const checkOutTime = normalizeTime(check_out);

        const officeStartSec = timeToSeconds(OFFICE_START_TIME); // 09:30:00 = 34200
        const officeEndSec = timeToSeconds(OFFICE_END_TIME);     // 18:30:00 = 66600

        let lateMinutes = 0;
        let lateComment = '';
        let earlyLeaveMinutes = 0;
        let earlyLeaveComment = '';
        let workingHours = 0;

        if (checkInTime) {
            const inSec = timeToSeconds(checkInTime);
            if (inSec > officeStartSec) {
                lateMinutes = Math.floor((inSec - officeStartSec) / 60);
                lateComment = `Late by ${formatMinutes(lateMinutes)} (In: ${formatTime12(checkInTime)})`;
            } else {
                lateComment = `On Time (In: ${formatTime12(checkInTime)})`;
            }
        }

        if (checkOutTime) {
            const outSec = timeToSeconds(checkOutTime);
            if (outSec < officeEndSec) {
                earlyLeaveMinutes = Math.floor((officeEndSec - outSec) / 60);
                earlyLeaveComment = `Left early by ${formatMinutes(earlyLeaveMinutes)} (Out: ${formatTime12(checkOutTime)})`;
            } else {
                earlyLeaveComment = `Completed full day (Out: ${formatTime12(checkOutTime)})`;
            }

            if (checkInTime) {
                const inSec = timeToSeconds(checkInTime);
                workingHours = parseFloat(Math.max(0, (outSec - inSec) / 3600).toFixed(2));
            }
        } else if (checkInTime) {
            earlyLeaveComment = 'No check-out recorded';
        }

        const offMins = parseInt(system_off_minutes, 10) || 0;
        const netWorkingHours = parseFloat(Math.max(0, workingHours - (offMins / 60)).toFixed(2));

        // Determine final status
        let finalStatus = status;
        if (!finalStatus) {
            if (!checkInTime && !checkOutTime) {
                finalStatus = 'absent';
            } else if (workingHours > 0 && workingHours < 4.5) {
                finalStatus = 'half-day';
            } else if (lateMinutes > 0) {
                finalStatus = 'late';
            } else {
                finalStatus = 'present';
            }
        }

        // Format remarks
        const customNote = remarks ? remarks.trim() : 'Manual Entry by Admin';
        const timingNote = checkInTime
            ? `${lateComment} | ${earlyLeaveComment || 'Punched'}`
            : 'Marked Absent';
        const finalRemarks = `${timingNote} • ${customNote}`;

        // Raw punches array
        const punches = [];
        if (checkInTime) punches.push(checkInTime);
        if (checkOutTime && checkOutTime !== checkInTime) punches.push(checkOutTime);

        const employeeFullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Employee';
        const jobNo = employee.employee_id || employee.job_no || '';

        // Check if attendance already exists for this employee and date
        let attendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: date
            }
        });

        const updateData = {
            employee_id: employee.id,
            job_no: jobNo,
            employee_name: employeeFullName,
            date: date,
            check_in: checkInTime,
            check_out: checkOutTime,
            status: finalStatus,
            late_minutes: lateMinutes,
            early_leave_minutes: earlyLeaveMinutes,
            working_hours: workingHours,
            system_off_minutes: offMins,
            net_working_hours: netWorkingHours,
            remarks: finalRemarks,
            raw_punches: JSON.stringify(punches),
            last_activity_time: new Date()
        };

        if (attendance) {
            await attendance.update(updateData);
        } else {
            attendance = await Attendance.create(updateData);
        }

        res.json({
            success: true,
            message: `Attendance ${attendance ? 'updated' : 'recorded'} successfully for ${employeeFullName} on ${date}`,
            data: attendance
        });
    } catch (error) {
        console.error('Manual attendance entry error:', error);
        res.status(500).json({ success: false, message: 'Server error saving manual attendance', error: error.message });
    }
};

// @desc    Delete manual attendance record
// @route   DELETE /api/attendance/manual/:id
// @access  Private (Admin, HR, Manager)
const deleteManualAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.findByPk(req.params.id);
        if (!attendance) {
            return res.status(404).json({ success: false, message: 'Attendance record not found' });
        }
        await attendance.destroy();
        res.json({ success: true, message: 'Attendance record deleted successfully' });
    } catch (error) {
        console.error('Delete manual attendance error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

module.exports = {
    uploadAttendanceCSV,
    getDailyAttendance,
    getAttendanceDates,
    getEmployeeMonthlyAttendance,
    checkIn,
    checkOut,
    syncSystemOffTime,
    recordHeartbeat,
    getAttendanceStats,
    saveManualAttendance,
    deleteManualAttendance
};