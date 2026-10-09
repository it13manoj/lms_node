const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
    getMeetings,
    getMeetingById,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getMeetingMessages,
    postMeetingMessage,
    getMeetingDocuments,
    uploadMeetingDocument
} = require('../controllers/meetingController');
const { protect } = require('../middleware/auth');

// Setup multer storage for meeting document uploads
const uploadDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'doc-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Meeting CRUD Routes
router.get('/', protect, getMeetings);
router.post('/', protect, createMeeting);
router.get('/:meetingId', protect, getMeetingById);
router.put('/:id', protect, updateMeeting);
router.delete('/:id', protect, deleteMeeting);

// In-Meeting Chat Routes
router.get('/:meetingId/messages', protect, getMeetingMessages);
router.post('/:meetingId/messages', protect, postMeetingMessage);

// In-Meeting Document Sharing Routes
router.get('/:meetingId/documents', protect, getMeetingDocuments);
router.post('/:meetingId/documents', protect, upload.single('file'), uploadMeetingDocument);

module.exports = router;

