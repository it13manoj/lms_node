const express = require('express');
const router = express.Router();
const {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday
} = require('../controllers/holidayController');

// Assuming you have authentication and role verification middlewares:
// const { protect, authorize } = require('../middleware/authMiddleware');

// Routes
router.route('/')
  .get(getHolidays)                  // GET /api/holidays
  .post(createHoliday);               // POST /api/holidays (Add protect, authorize('admin', 'hr') here if needed)

router.route('/:id')
  .put(updateHoliday)                 // PUT /api/holidays/:id
  .delete(deleteHoliday);             // DELETE /api/holidays/:id

module.exports = router;