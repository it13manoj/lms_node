const Letter = require('../models/Letter');
const LetterSetting = require('../models/LetterSetting');
const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

/**
 * Generate a unique reference number based on letter type and year
 */
const generateReferenceNo = async (type) => {
    const year = new Date().getFullYear();
    const typePrefix = type === 'joining' ? 'JL' : (type === 'experience' ? 'EXP' : 'OL');
    const prefix = `PT/${typePrefix}/${year}/`;
    
    // Find the latest letter with this prefix
    const latestLetter = await Letter.findOne({
        where: {
            reference_no: {
                [Op.like]: `${prefix}%`
            }
        },
        order: [['id', 'DESC']]
    });

    let nextNumber = 1;
    if (latestLetter && latestLetter.reference_no) {
        const parts = latestLetter.reference_no.split('/');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
};

// @desc    Get all letters with filtering and pagination
// @route   GET /api/letters
// @access  Private (Admin only)
const getLetters = async (req, res) => {
    try {
        const { letter_type, search, status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        const where = {};
        if (letter_type && letter_type !== 'all') {
            where.letter_type = letter_type;
        }
        if (status) {
            where.status = status;
        }
        if (search) {
            where[Op.or] = [
                { candidate_name: { [Op.like]: `%${search}%` } },
                { position: { [Op.like]: `%${search}%` } },
                { reference_no: { [Op.like]: `%${search}%` } },
                { candidate_email: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await Letter.findAndCountAll({
            where,
            include: [{
                model: Employee,
                as: 'employee',
                attributes: ['id', 'employee_id', 'first_name', 'last_name', 'email', 'position']
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit, 10),
            offset
        });

        // Compute summary counts
        const totalOffer = await Letter.count({ where: { letter_type: 'offer' } });
        const totalJoining = await Letter.count({ where: { letter_type: 'joining' } });
        const totalExperience = await Letter.count({ where: { letter_type: 'experience' } });

        res.json({
            success: true,
            data: {
                letters: rows,
                total: count,
                currentPage: parseInt(page, 10),
                totalPages: Math.ceil(count / parseInt(limit, 10)),
                stats: {
                    total: count,
                    offer: totalOffer,
                    joining: totalJoining,
                    experience: totalExperience
                }
            }
        });
    } catch (error) {
        console.error('Error fetching letters:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve letters',
            error: error.message
        });
    }
};

// @desc    Get single letter details
// @route   GET /api/letters/:id
// @access  Private (Admin only)
const getLetterById = async (req, res) => {
    try {
        const letter = await Letter.findByPk(req.params.id, {
            include: [{
                model: Employee,
                as: 'employee',
                attributes: ['id', 'employee_id', 'first_name', 'last_name', 'email', 'position', 'department']
            }]
        });

        if (!letter) {
            return res.status(404).json({
                success: false,
                message: 'Letter not found'
            });
        }

        res.json({
            success: true,
            data: letter
        });
    } catch (error) {
        console.error('Error fetching letter:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve letter',
            error: error.message
        });
    }
};

// @desc    Get status of letter security PIN (whether it is configured)
// @route   GET /api/letters/settings/pin-status
// @access  Private (Admin only)
const getPinStatus = async (req, res) => {
    try {
        const pinSetting = await LetterSetting.findOne({
            where: { setting_key: 'signature_pin' }
        });

        res.json({
            success: true,
            data: {
                isConfigured: Boolean(pinSetting && pinSetting.setting_value)
            }
        });
    } catch (error) {
        console.error('Error checking PIN status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check security PIN status',
            error: error.message
        });
    }
};

// @desc    Configure or change security PIN for digital signature & stamp
// @route   POST /api/letters/settings/configure-pin
// @access  Private (Admin only)
const configurePin = async (req, res) => {
    try {
        const { currentPin, newPin } = req.body;

        if (!newPin || typeof newPin !== 'string' || newPin.trim().length < 4 || newPin.trim().length > 8) {
            return res.status(400).json({
                success: false,
                message: 'Security PIN must be between 4 and 8 digits'
            });
        }

        const pinSetting = await LetterSetting.findOne({
            where: { setting_key: 'signature_pin' }
        });

        // If a PIN is already configured, current PIN must be verified
        if (pinSetting && pinSetting.setting_value) {
            if (!currentPin) {
                return res.status(400).json({
                    success: false,
                    message: 'Current Security PIN is required to change your PIN'
                });
            }

            const isCurrentValid = await bcrypt.compare(String(currentPin).trim(), pinSetting.setting_value);
            if (!isCurrentValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Current Security PIN is incorrect'
                });
            }
        }

        const hashedPin = await bcrypt.hash(newPin.trim(), 10);

        if (pinSetting) {
            pinSetting.setting_value = hashedPin;
            await pinSetting.save();
        } else {
            await LetterSetting.create({
                setting_key: 'signature_pin',
                setting_value: hashedPin
            });
        }

        res.json({
            success: true,
            message: 'Security PIN configured successfully'
        });
    } catch (error) {
        console.error('Error configuring PIN:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to configure security PIN',
            error: error.message
        });
    }
};

// @desc    Verify security PIN
// @route   POST /api/letters/settings/verify-pin
// @access  Private (Admin only)
const verifyPin = async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin) {
            return res.status(400).json({
                success: false,
                message: 'PIN is required'
            });
        }

        const pinSetting = await LetterSetting.findOne({
            where: { setting_key: 'signature_pin' }
        });

        if (!pinSetting || !pinSetting.setting_value) {
            return res.status(400).json({
                success: false,
                message: 'Security PIN is not configured yet. Please configure it first.'
            });
        }

        const isMatch = await bcrypt.compare(String(pin).trim(), pinSetting.setting_value);
        if (!isMatch) {
            return res.status(403).json({
                success: false,
                message: 'Invalid Security PIN'
            });
        }

        res.json({
            success: true,
            message: 'Security PIN verified successfully'
        });
    } catch (error) {
        console.error('Error verifying PIN:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify security PIN',
            error: error.message
        });
    }
};

// @desc    Authorize or revoke digital signature & stamp on existing letter
// @route   POST /api/letters/:id/authorize-signature
// @access  Private (Admin only)
const authorizeLetterSignature = async (req, res) => {
    try {
        const { security_pin, enable = true } = req.body;
        const letter = await Letter.findByPk(req.params.id);

        if (!letter) {
            return res.status(404).json({
                success: false,
                message: 'Letter not found'
            });
        }

        if (enable) {
            const pinSetting = await LetterSetting.findOne({
                where: { setting_key: 'signature_pin' }
            });

            if (!pinSetting || !pinSetting.setting_value) {
                return res.status(400).json({
                    success: false,
                    message: 'Security PIN is not configured yet. Please configure the Security PIN first.'
                });
            }

            if (!security_pin) {
                return res.status(400).json({
                    success: false,
                    message: 'Security PIN is required to authorize official stamp and signature'
                });
            }

            const isMatch = await bcrypt.compare(String(security_pin).trim(), pinSetting.setting_value);
            if (!isMatch) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid Security PIN. Authorization denied.'
                });
            }

            letter.include_signature = true;
            letter.include_stamp = true;
        } else {
            letter.include_signature = false;
            letter.include_stamp = false;
        }

        await letter.save();

        res.json({
            success: true,
            message: enable ? 'Official stamp and signature authorized successfully' : 'Stamp and signature revoked',
            data: letter
        });
    } catch (error) {
        console.error('Error authorizing letter signature:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update signature authorization',
            error: error.message
        });
    }
};

// @desc    Create dynamic letter (Offer, Joining, or Experience)
// @route   POST /api/letters
// @access  Private (Admin only)
const createLetter = async (req, res) => {
    try {
        const {
            letter_type = 'offer',
            employee_id,
            candidate_name,
            candidate_email,
            candidate_phone,
            candidate_address,
            position,
            department,
            joining_date,
            end_date,
            annual_ctc,
            work_location = 'Buxar, Bihar (802101)',
            issue_date = new Date().toISOString().slice(0, 10),
            signatory_name = 'Authorized Signatory',
            signatory_title = 'For ParakshTech LLP',
            custom_terms,
            body_content,
            status = 'issued',
            include_signature = false,
            include_stamp = false,
            security_pin
        } = req.body;

        if (!candidate_name || !position || !joining_date) {
            return res.status(400).json({
                success: false,
                message: 'Candidate name, position, and joining date are required'
            });
        }

        let finalIncludeSignature = false;
        let finalIncludeStamp = false;

        if (include_signature || include_stamp) {
            const pinSetting = await LetterSetting.findOne({
                where: { setting_key: 'signature_pin' }
            });

            if (!pinSetting || !pinSetting.setting_value) {
                return res.status(400).json({
                    success: false,
                    message: 'Security PIN has not been configured yet. Please configure the Security PIN first to attach digital stamp and signature.'
                });
            }

            if (!security_pin) {
                return res.status(400).json({
                    success: false,
                    message: 'Security PIN is required to attach official stamp and signature'
                });
            }

            const isValidPin = await bcrypt.compare(String(security_pin).trim(), pinSetting.setting_value);
            if (!isValidPin) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid Security PIN. Official stamp and signature cannot be attached.'
                });
            }

            finalIncludeSignature = Boolean(include_signature);
            finalIncludeStamp = Boolean(include_stamp);
        }

        const reference_no = await generateReferenceNo(letter_type);

        const newLetter = await Letter.create({
            letter_type,
            reference_no,
            employee_id: employee_id || null,
            candidate_name,
            candidate_email: candidate_email || null,
            candidate_phone: candidate_phone || null,
            candidate_address: candidate_address || 'Buxar, Bihar, 802101',
            position,
            department: department || 'Information Technology',
            joining_date,
            end_date: end_date || null,
            annual_ctc: annual_ctc || '₹1.2 LPA',
            work_location,
            issue_date,
            signatory_name,
            signatory_title,
            custom_terms: custom_terms || null,
            body_content: body_content || null,
            status,
            include_signature: finalIncludeSignature,
            include_stamp: finalIncludeStamp,
            created_by: req.user?.id || null
        });

        res.status(201).json({
            success: true,
            message: `${letter_type === 'joining' ? 'Joining' : (letter_type === 'experience' ? 'Experience' : 'Offer')} letter generated successfully`,
            data: newLetter
        });
    } catch (error) {
        console.error('Error generating letter:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate letter',
            error: error.message
        });
    }
};

// @desc    Update letter details
// @route   PUT /api/letters/:id
// @access  Private (Admin only)
const updateLetter = async (req, res) => {
    try {
        const letter = await Letter.findByPk(req.params.id);
        if (!letter) {
            return res.status(404).json({
                success: false,
                message: 'Letter not found'
            });
        }

        const wantSignature = req.body.include_signature !== undefined ? Boolean(req.body.include_signature) : letter.include_signature;
        const wantStamp = req.body.include_stamp !== undefined ? Boolean(req.body.include_stamp) : letter.include_stamp;

        // If newly enabling signature/stamp or explicitly providing security_pin
        const isEnabling = (wantSignature && !letter.include_signature) || (wantStamp && !letter.include_stamp);
        if (isEnabling || (req.body.security_pin && (wantSignature || wantStamp))) {
            const pinSetting = await LetterSetting.findOne({
                where: { setting_key: 'signature_pin' }
            });

            if (!pinSetting || !pinSetting.setting_value) {
                return res.status(400).json({
                    success: false,
                    message: 'Security PIN has not been configured yet. Please configure the Security PIN first.'
                });
            }

            if (!req.body.security_pin) {
                return res.status(400).json({
                    success: false,
                    message: 'Security PIN is required to authorize official stamp and signature'
                });
            }

            const isValidPin = await bcrypt.compare(String(req.body.security_pin).trim(), pinSetting.setting_value);
            if (!isValidPin) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid Security PIN. Official stamp and signature cannot be updated.'
                });
            }
        }

        const allowedFields = [
            'candidate_name', 'candidate_email', 'candidate_phone', 'candidate_address',
            'position', 'department', 'joining_date', 'end_date', 'annual_ctc',
            'work_location', 'issue_date', 'signatory_name', 'signatory_title',
            'custom_terms', 'body_content', 'status', 'employee_id', 'include_signature', 'include_stamp'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                letter[field] = req.body[field];
            }
        });

        await letter.save();

        res.json({
            success: true,
            message: 'Letter updated successfully',
            data: letter
        });
    } catch (error) {
        console.error('Error updating letter:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update letter',
            error: error.message
        });
    }
};

// @desc    Delete letter
// @route   DELETE /api/letters/:id
// @access  Private (Admin only)
const deleteLetter = async (req, res) => {
    try {
        const letter = await Letter.findByPk(req.params.id);
        if (!letter) {
            return res.status(404).json({
                success: false,
                message: 'Letter not found'
            });
        }

        await letter.destroy();

        res.json({
            success: true,
            message: 'Letter deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting letter:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete letter',
            error: error.message
        });
    }
};

module.exports = {
    getLetters,
    getLetterById,
    getPinStatus,
    configurePin,
    verifyPin,
    authorizeLetterSignature,
    createLetter,
    updateLetter,
    deleteLetter
};
