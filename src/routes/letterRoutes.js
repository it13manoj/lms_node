const express = require('express');
const router = express.Router();
const {
    getLetters,
    getLetterById,
    getPinStatus,
    configurePin,
    verifyPin,
    authorizeLetterSignature,
    createLetter,
    updateLetter,
    deleteLetter
} = require('../controllers/letterController');
const { protect, authorize } = require('../middleware/auth');

// All letter routes are strictly restricted to Admin only
router.use(protect);
router.use(authorize('admin'));

// Security PIN settings endpoints (must precede /:id)
router.get('/settings/pin-status', getPinStatus);
router.post('/settings/configure-pin', configurePin);
router.post('/settings/verify-pin', verifyPin);

router.route('/')
    .get(getLetters)
    .post(createLetter);

router.post('/:id/authorize-signature', authorizeLetterSignature);

router.route('/:id')
    .get(getLetterById)
    .put(updateLetter)
    .delete(deleteLetter);

module.exports = router;
