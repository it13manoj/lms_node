const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', paymentController.getPayments);
router.get('/summary', paymentController.getPaymentSummary);
router.get('/:id/receipt', paymentController.getPaymentReceipt);
router.get('/:id', paymentController.getPayment);
router.post('/', authorize('admin', 'hr'), paymentController.createPayment);

module.exports = router;
