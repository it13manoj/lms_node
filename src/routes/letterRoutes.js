const express = require('express');
const router = express.Router();
const {
    getLetters,
    getLetterById,
    createLetter,
    updateLetter,
    deleteLetter
} = require('../controllers/letterController');
const { protect, authorize } = require('../middleware/auth');

// All letter routes are strictly restricted to Admin only
router.use(protect);
router.use(authorize('admin'));

router.route('/')
    .get(getLetters)
    .post(createLetter);

router.route('/:id')
    .get(getLetterById)
    .put(updateLetter)
    .delete(deleteLetter);

module.exports = router;

