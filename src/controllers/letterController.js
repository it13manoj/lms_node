const Letter = require('../models/Letter');
const Employee = require('../models/Employee');
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
            status = 'issued'
        } = req.body;

        if (!candidate_name || !position || !joining_date) {
            return res.status(400).json({
                success: false,
                message: 'Candidate name, position, and joining date are required'
            });
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
            status,
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

        const allowedFields = [
            'candidate_name', 'candidate_email', 'candidate_phone', 'candidate_address',
            'position', 'department', 'joining_date', 'end_date', 'annual_ctc',
            'work_location', 'issue_date', 'signatory_name', 'signatory_title',
            'custom_terms', 'status', 'employee_id'
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
    createLetter,
    updateLetter,
    deleteLetter
};

