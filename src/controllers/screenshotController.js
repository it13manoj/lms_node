const Screenshot = require('../models/Screenshot');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { Op } = require('sequelize');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

const IST_OFFSET = '+05:30';
const OFFICE_START_MINUTES = 9 * 60 + 30;  // 09:30 AM
const OFFICE_END_MINUTES = 18 * 60 + 30;   // 06:30 PM
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/screenshots');

const isWithinOfficeHoursIST = (istMoment) => {
    const totalMinutes = istMoment.hours() * 60 + istMoment.minutes();
    return totalMinutes >= OFFICE_START_MINUTES && totalMinutes <= OFFICE_END_MINUTES;
};

const formatTime12 = (timeStr) => {
    if (!timeStr) return '--:--';
    return moment(timeStr, ['HH:mm:ss', 'HH:mm']).format('hh:mm:ss A');
};

const saveScreenshotFile = (base64Data, dateStr, userId, employeeId) => {
    if (!base64Data || typeof base64Data !== 'string') {
        throw new Error('Screenshot image data is required');
    }

    const matches = base64Data.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
    if (!matches || matches.length !== 3) {
        throw new Error('Invalid screenshot image format. Expected base64 JPEG, PNG, or WebP');
    }

    const rawExt = matches[1].toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const buffer = Buffer.from(matches[2], 'base64');

    if (!buffer || buffer.length === 0) {
        throw new Error('Empty screenshot image');
    }
    if (buffer.length > 8 * 1024 * 1024) {
        throw new Error('Screenshot exceeds 8MB size limit');
    }

    const safeDate = String(dateStr).replace(/[^0-9-]/g, '');
    const targetDir = path.join(UPLOAD_ROOT, safeDate);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `ss_u${userId}_e${employeeId || 0}_${Date.now()}.${ext}`;
    const fullPath = path.join(targetDir, filename);
    fs.writeFileSync(fullPath, buffer);

    return {
        relativePath: `/uploads/screenshots/${safeDate}/${filename}`,
        sizeKb: Math.max(1, Math.round(buffer.length / 1024))
    };
};

const deleteScreenshotFileFromDisk = (imagePath) => {
    if (!imagePath || typeof imagePath !== 'string') return;
    if (!imagePath.startsWith('/uploads/screenshots/')) return;
    const relative = imagePath.replace(/^\/uploads\/screenshots\//, '');
    const resolved = path.resolve(UPLOAD_ROOT, relative);
    if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) return;
    try {
        if (fs.existsSync(resolved)) {
            fs.unlinkSync(resolved);
        }
    } catch (err) {
        console.warn('Could not delete screenshot file:', resolved, err.message);
    }
};

const buildFilterWhere = (query, user, isManagerial) => {
    const { date, month, employeeId, userId, status } = query || {};
    const where = {};

    if (!isManagerial) {
        where.user_id = user.id;
    } else if (employeeId && employeeId !== 'all') {
        if (String(employeeId).startsWith('user:')) {
            const uid = parseInt(String(employeeId).slice(5), 10);
            if (!isNaN(uid)) where.user_id = uid;
        } else {
            const eid = parseInt(employeeId, 10);
            if (!isNaN(eid)) where.employee_id = eid;
        }
    } else if (userId && userId !== 'all') {
        const uid = parseInt(userId, 10);
        if (!isNaN(uid)) where.user_id = uid;
    }

    if (date) {
        where.date = date;
    } else if (month && /^\d{4}-\d{2}$/.test(String(month))) {
        const start = moment(`${month}-01`, 'YYYY-MM-DD').startOf('month').format('YYYY-MM-DD');
        const end = moment(`${month}-01`, 'YYYY-MM-DD').endOf('month').format('YYYY-MM-DD');
        where.date = { [Op.between]: [start, end] };
    }

    if (status && status !== 'all' && ['pending', 'verified', 'rejected'].includes(status)) {
        where.status = status;
    }

    return where;
};

// @desc    Upload screenshot captured during office hours (09:30 AM - 06:30 PM IST)
// @route   POST /api/screenshots/upload
// @access  Private
const uploadScreenshot = async (req, res) => {
    try {
        const istNow = moment().utcOffset(IST_OFFSET);
        if (!isWithinOfficeHoursIST(istNow)) {
            return res.status(400).json({
                success: false,
                message: 'Screenshots can only be captured during office hours (09:30 AM - 06:30 PM IST)'
            });
        }

        const employee = await Employee.findOne({ where: { user_id: req.user.id } });
        const dateStr = istNow.format('YYYY-MM-DD');
        const timeStr = istNow.format('HH:mm:ss');

        const { relativePath, sizeKb } = saveScreenshotFile(
            req.body.image,
            dateStr,
            req.user.id,
            employee ? employee.id : 0
        );

        const empName = employee
            ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
            : (req.user.email || 'User');

        const screenshot = await Screenshot.create({
            employee_id: employee ? employee.id : null,
            user_id: req.user.id,
            employee_name: empName,
            job_no: employee ? (employee.employee_id || null) : null,
            date: dateStr,
            capture_time: timeStr,
            captured_at: istNow.toDate(),
            image_path: relativePath,
            file_size_kb: sizeKb,
            status: 'pending',
            notes: req.body.notes ? String(req.body.notes).slice(0, 255) : null
        });

        res.status(201).json({
            success: true,
            message: 'Screenshot uploaded successfully',
            data: {
                ...screenshot.toJSON(),
                capture_time_formatted: formatTime12(screenshot.capture_time)
            }
        });
    } catch (error) {
        console.error('Upload screenshot error:', error);
        const statusCode = error.message && error.message.includes('Screenshot') ? 400 : 500;
        res.status(statusCode).json({ success: false, message: error.message || 'Server error' });
    }
};

// @desc    Get screenshots (day-wise, month-wise, user-wise)
// @route   GET /api/screenshots
// @access  Private
const getScreenshots = async (req, res) => {
    try {
        const isManagerial = ['admin', 'hr', 'manager'].includes(req.user?.role);
        const where = buildFilterWhere(req.query, req.user, isManagerial);

        const records = await Screenshot.findAll({
            where,
            order: [['date', 'DESC'], ['capture_time', 'DESC'], ['id', 'DESC']],
            limit: 500
        });

        // Summary counts for the active date/month/user scope (ignoring status filter)
        const summaryWhere = { ...where };
        delete summaryWhere.status;
        const allForSummary = await Screenshot.findAll({
            where: summaryWhere,
            attributes: ['status'],
            raw: true
        });
        const summary = {
            total: allForSummary.length,
            pending: allForSummary.filter(r => r.status === 'pending').length,
            verified: allForSummary.filter(r => r.status === 'verified').length,
            rejected: allForSummary.filter(r => r.status === 'rejected').length
        };

        let employees = [];
        if (isManagerial) {
            const empRows = await Employee.findAll({
                attributes: ['id', 'user_id', 'employee_id', 'first_name', 'last_name', 'department'],
                order: [['first_name', 'ASC']],
                raw: true
            });
            employees = empRows.map(e => ({
                id: e.id,
                user_id: e.user_id,
                job_no: e.employee_id,
                name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
                department: e.department || 'General'
            }));
        }

        const formatted = records.map(r => {
            const json = r.toJSON();
            return {
                ...json,
                capture_time_formatted: formatTime12(json.capture_time),
                verified_at_ist: json.verified_at
                    ? moment(json.verified_at).utcOffset(IST_OFFSET).format('DD MMM YYYY, hh:mm A')
                    : null
            };
        });

        res.json({
            success: true,
            data: {
                screenshots: formatted,
                summary,
                employees
            }
        });
    } catch (error) {
        console.error('Get screenshots error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Verify or reject a single screenshot
// @route   PATCH /api/screenshots/:id/verify
// @access  Private (Admin, HR, Manager)
const verifyScreenshot = async (req, res) => {
    try {
        const screenshot = await Screenshot.findByPk(req.params.id);
        if (!screenshot) {
            return res.status(404).json({ success: false, message: 'Screenshot not found' });
        }

        const nextStatus = ['verified', 'rejected', 'pending'].includes(req.body.status)
            ? req.body.status
            : 'verified';

        const verifierEmp = await Employee.findOne({ where: { user_id: req.user.id } });
        const verifierName = verifierEmp
            ? `${verifierEmp.first_name || ''} ${verifierEmp.last_name || ''}`.trim()
            : (req.user.email || 'Admin');

        await screenshot.update({
            status: nextStatus,
            verified_by: nextStatus === 'pending' ? null : req.user.id,
            verified_by_name: nextStatus === 'pending' ? null : verifierName,
            verified_at: nextStatus === 'pending' ? null : new Date(),
            notes: req.body.notes !== undefined ? String(req.body.notes || '').slice(0, 255) : screenshot.notes
        });

        res.json({
            success: true,
            message: `Screenshot marked as ${nextStatus}`,
            data: screenshot
        });
    } catch (error) {
        console.error('Verify screenshot error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Bulk verify or reject screenshots
// @route   POST /api/screenshots/bulk-verify
// @access  Private (Admin, HR, Manager)
const bulkVerifyScreenshots = async (req, res) => {
    try {
        const { ids, status, date, month, employeeId } = req.body;
        const nextStatus = ['verified', 'rejected', 'pending'].includes(status) ? status : 'verified';

        let where = {};
        if (Array.isArray(ids) && ids.length > 0) {
            where.id = { [Op.in]: ids };
        } else if (date || month || (employeeId && employeeId !== 'all')) {
            where = buildFilterWhere({ date, month, employeeId }, req.user, true);
        } else {
            return res.status(400).json({ success: false, message: 'Select screenshots or apply a filter' });
        }

        const verifierEmp = await Employee.findOne({ where: { user_id: req.user.id } });
        const verifierName = verifierEmp
            ? `${verifierEmp.first_name || ''} ${verifierEmp.last_name || ''}`.trim()
            : (req.user.email || 'Admin');

        const [updatedCount] = await Screenshot.update({
            status: nextStatus,
            verified_by: nextStatus === 'pending' ? null : req.user.id,
            verified_by_name: nextStatus === 'pending' ? null : verifierName,
            verified_at: nextStatus === 'pending' ? null : new Date()
        }, { where });

        res.json({
            success: true,
            message: `Updated ${updatedCount} screenshot(s) to ${nextStatus}`,
            updatedCount
        });
    } catch (error) {
        console.error('Bulk verify screenshots error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Delete a single screenshot (DB + disk)
// @route   DELETE /api/screenshots/:id
// @access  Private (Admin, HR, Manager)
const deleteScreenshot = async (req, res) => {
    try {
        const screenshot = await Screenshot.findByPk(req.params.id);
        if (!screenshot) {
            return res.status(404).json({ success: false, message: 'Screenshot not found' });
        }

        deleteScreenshotFileFromDisk(screenshot.image_path);
        await screenshot.destroy();

        res.json({ success: true, message: 'Screenshot deleted successfully' });
    } catch (error) {
        console.error('Delete screenshot error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Bulk delete screenshots by IDs or day/month/user filter (DB + disk)
// @route   POST /api/screenshots/bulk-delete
// @access  Private (Admin, HR, Manager)
const bulkDeleteScreenshots = async (req, res) => {
    try {
        const { ids, date, month, employeeId, status } = req.body;
        let where = {};
        if (Array.isArray(ids) && ids.length > 0) {
            where.id = { [Op.in]: ids };
        } else if (date || month || (employeeId && employeeId !== 'all') || (status && status !== 'all')) {
            where = buildFilterWhere({ date, month, employeeId, status }, req.user, true);
        } else {
            return res.status(400).json({ success: false, message: 'Select screenshots or a day/month/user filter to delete' });
        }

        const targets = await Screenshot.findAll({ where });
        targets.forEach(t => deleteScreenshotFileFromDisk(t.image_path));
        const deletedCount = await Screenshot.destroy({ where });

        res.json({
            success: true,
            message: `Deleted ${deletedCount} screenshot(s)`,
            deletedCount
        });
    } catch (error) {
        console.error('Bulk delete screenshots error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    uploadScreenshot,
    getScreenshots,
    verifyScreenshot,
    bulkVerifyScreenshots,
    deleteScreenshot,
    bulkDeleteScreenshots
};
