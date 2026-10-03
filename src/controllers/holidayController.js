const Holiday = require('../models/Holiday');

// @desc    Get all holidays
// @route   GET /api/holidays
// @access  Private
exports.getHolidays = async (req, res) => {
    try {
        const holidays = await Holiday.findAll({
            order: [['holiday_date', 'ASC']]
        });
        res.status(200).json({
            success: true,
            data: holidays
        });
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Create a new holiday
// @route   POST /api/holidays
// @access  Private (Admin/HR)
exports.createHoliday = async (req, res) => {
    try {
       const { holiday_name, holiday_date, description, holiday_type, status } = req.body;
        console.log("Holiday Model Check:", Holiday); 
        if (!holiday_name || !holiday_date) {
            return res.status(400).json({ success: false, message: 'Holiday name and date are required.' });
        }

        // Automatically extract year from holiday_date (e.g., "2026-08-15" -> 2026)
        const year = new Date(holiday_date).getFullYear();

        const newHoliday = await Holiday.create({
            holiday_name,
            holiday_date,
            description: description || '',
            holiday_type: holiday_type || 'public',
            year,
            status: status || 'active'
        });

        res.status(201).json({
            success: true,
            data: newHoliday
        });
    } catch (error) {
        console.error('Error creating holiday:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update a holiday
// @route   PUT /api/holidays/:id
// @access  Private (Admin/HR)
exports.updateHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const { holiday_name, holiday_date, description, holiday_type, status } = req.body;

        const holiday = await Holiday.findByPk(id);
        if (!holiday) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }

        const year = holiday_date ? new Date(holiday_date).getFullYear() : holiday.year;

        await holiday.update({
            holiday_name: holiday_name || holiday.holiday_name,
            holiday_date: holiday_date || holiday.holiday_date,
            description: description !== undefined ? description : holiday.description,
            holiday_type: holiday_type || holiday.holiday_type,
            year,
            status: status || holiday.status
        });

        res.status(200).json({
            success: true,
            data: holiday
        });
    } catch (error) {
        console.error('Error updating holiday:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete a holiday
// @route   DELETE /api/holidays/:id
// @access  Private (Admin/HR)
exports.deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const holiday = await Holiday.findByPk(id);

        if (!holiday) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }

        await holiday.destroy();
        res.status(200).json({
            success: true,
            message: 'Holiday deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting holiday:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};