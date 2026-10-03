const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');

// Standard Office Timing constants
const OFFICE_START_TIME = '09:30:00'; // 9:30 AM
const OFFICE_END_TIME = '18:30:00';   // 6:30 PM

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

        // If no date provided, pick the latest date from attendance or today
        if (!date) {
            const latestAtt = await Attendance.findOne({
                order: [['date', 'DESC']]
            });
            date = latestAtt ? latestAtt.date : moment().format('YYYY-MM-DD');
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
                    check_out: attRecord.check_out,
                    check_out_formatted: formatTime12(attRecord.check_out),
                    working_hours: parseFloat(attRecord.working_hours || 0),
                    working_hours_formatted: `${Math.floor(attRecord.working_hours || 0)}h ${Math.round(((attRecord.working_hours || 0) % 1) * 60)}m`,
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
                        check_out: att.check_out,
                        check_out_formatted: formatTime12(att.check_out),
                        working_hours: parseFloat(att.working_hours || 0),
                        working_hours_formatted: `${Math.floor(att.working_hours || 0)}h ${Math.round(((att.working_hours || 0) % 1) * 60)}m`,
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

        // 6. Filtering & Searching
        let filteredList = fullDayList;
        if (status && status !== 'all') {
            if (status === 'present') filteredList = filteredList.filter(r => r.is_present);
            else if (status === 'absent') filteredList = filteredList.filter(r => r.is_absent);
            else if (status === 'late') filteredList = filteredList.filter(r => r.is_late);
            else if (status === 'early_leave') filteredList = filteredList.filter(r => r.is_early_leave);
            else if (status === 'on_time') filteredList = filteredList.filter(r => r.is_on_time);
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
                onTimeCount
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
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const today = moment().format('YYYY-MM-DD');
        const existingAttendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        if (existingAttendance && existingAttendance.check_in) {
            return res.status(400).json({ message: 'Already checked in today' });
        }

        const nowTime = moment().format('HH:mm:ss');
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

        let attendance;
        if (existingAttendance) {
            await existingAttendance.update({
                check_in: nowTime,
                status: 'present',
                late_minutes: lateMinutes,
                remarks: lateComment,
                raw_punches: JSON.stringify([nowTime])
            });
            attendance = existingAttendance;
        } else {
            attendance = await Attendance.create({
                employee_id: employee.id,
                job_no: employee.employee_id,
                employee_name: `${employee.first_name} ${employee.last_name}`,
                date: today,
                check_in: nowTime,
                status: 'present',
                late_minutes: lateMinutes,
                remarks: lateComment,
                raw_punches: JSON.stringify([nowTime])
            });
        }

        res.json({
            success: true,
            message: 'Checked in successfully',
            data: attendance
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
        const employee = await Employee.findOne({
            where: { user_id: req.user.id }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const today = moment().format('YYYY-MM-DD');
        const attendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        if (!attendance) {
            return res.status(404).json({ message: 'No check-in found for today' });
        }

        if (attendance.check_out) {
            return res.status(400).json({ message: 'Already checked out' });
        }

        const checkOutTime = moment().format('HH:mm:ss');
        const checkInTime = moment(attendance.check_in, 'HH:mm:ss');
        const checkOutMoment = moment(checkOutTime, 'HH:mm:ss');
        const workingHours = parseFloat(checkOutMoment.diff(checkInTime, 'hours', true).toFixed(2));

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
        currentPunches.push(checkOutTime);

        const updatedRemarks = `${attendance.remarks || ''} | ${earlyLeaveComment}`.replace(/^ \| /, '');

        await attendance.update({
            check_out: checkOutTime,
            working_hours: workingHours,
            early_leave_minutes: earlyLeaveMinutes,
            remarks: updatedRemarks,
            raw_punches: JSON.stringify(currentPunches)
        });

        res.json({
            success: true,
            message: 'Checked out successfully',
            data: attendance
        });
    } catch (error) {
        console.error('Check out error:', error);
        res.status(500).json({ message: 'Server error' });
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

        const today = moment().format('YYYY-MM-DD');
        const todayAttendance = await Attendance.findOne({
            where: {
                employee_id: employee.id,
                date: today
            }
        });

        const monthStart = moment().startOf('month').format('YYYY-MM-DD');
        const monthEnd = moment().endOf('month').format('YYYY-MM-DD');
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

        res.json({
            success: true,
            data: {
                todayStatus,
                checkInTime: todayAttendance?.check_in || null,
                checkOutTime: todayAttendance?.check_out || null,
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
                const wHours = parseFloat(att.working_hours || 0);
                totalWorkingHours += wHours;

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
                    check_out: att.check_out,
                    check_out_formatted: formatTime12(att.check_out),
                    working_hours: wHours,
                    working_hours_formatted: `${Math.floor(wHours)}h ${Math.round((wHours % 1) * 60)}m`,
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

module.exports = {
    uploadAttendanceCSV,
    getDailyAttendance,
    getAttendanceDates,
    getEmployeeMonthlyAttendance,
    checkIn,
    checkOut,
    getAttendanceStats
};