const express = require('express');
const router = express.Router();
const {
    uploadScreenshot,
    getScreenshots,
    verifyScreenshot,
    bulkVerifyScreenshots,
    deleteScreenshot,
    bulkDeleteScreenshots
} = require('../controllers/screenshotController');
const { protect, authorize } = require('../middleware/auth');

router.post('/upload', protect, uploadScreenshot);
router.get('/', protect, getScreenshots);
router.patch('/:id/verify', protect, authorize('admin', 'hr', 'manager'), verifyScreenshot);
router.post('/bulk-verify', protect, authorize('admin', 'hr', 'manager'), bulkVerifyScreenshots);
router.delete('/:id', protect, authorize('admin', 'hr', 'manager'), deleteScreenshot);
router.post('/bulk-delete', protect, authorize('admin', 'hr', 'manager'), bulkDeleteScreenshots);

module.exports = router;
