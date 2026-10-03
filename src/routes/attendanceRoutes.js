const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
    uploadAttendanceCSV,
    getDailyAttendance,
    getAttendanceDates,
    getEmployeeMonthlyAttendance,
    checkIn,
    checkOut,
    getAttendanceStats
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

// Multer in-memory storage for CSV upload
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.csv' || ext === '.txt') {
            cb(null, true);
        } else {
            cb(new Error('Only CSV or TXT files are allowed'));
        }
    }
});

// CSV Upload route
router.post(
    '/upload-csv', 
    protect, 
    authorize('admin', 'hr', 'manager'), 
    upload.single('file'), 
    uploadAttendanceCSV
);

// Daily attendance report (present, absent, late, early leaving)
router.get('/daily', protect, getDailyAttendance);

// Complete monthly & yearly attendance for a specific employee
router.get('/employee-monthly', protect, getEmployeeMonthlyAttendance);

// Distinct dates in attendance records
router.get('/dates', protect, getAttendanceDates);

// Download sample attendance CSV
router.get('/sample-csv', (req, res) => {
    const samplePath = path.join(__dirname, '../../sample_attendance.csv');
    res.download(samplePath, 'sample_attendance.csv');
});

// Self-service Check in / Check out / Stats
router.post('/check-in', protect, checkIn);
router.post('/check-out', protect, checkOut);
router.get('/stats', protect, getAttendanceStats);

module.exports = router;
