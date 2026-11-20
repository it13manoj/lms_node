const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/performanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', performanceController.getPerformances);
router.get('/stats', performanceController.getPerformanceStats);
router.get('/:id', performanceController.getPerformance);
router.post('/', authorize('admin', 'hr', 'manager'), performanceController.createPerformance);
router.put('/:id', authorize('admin', 'hr', 'manager'), performanceController.updatePerformance);
router.delete('/:id', authorize('admin', 'hr'), performanceController.deletePerformance);

module.exports = router;
