const Meeting = require('../models/Meeting');
const MeetingMessage = require('../models/MeetingMessage');
const MeetingDocument = require('../models/MeetingDocument');
const Employee = require('../models/Employee');
const { Op } = require('sequelize');
const moment = require('moment');

// Helper to generate readable meeting code e.g. "ptk-392-817"
const generateMeetingCode = () => {
    const part1 = 'ptk';
    const part2 = Math.floor(100 + Math.random() * 900);
    const part3 = Math.floor(100 + Math.random() * 900);
    return `${part1}-${part2}-${part3}`;
};

// @desc    Get all meetings
// @route   GET /api/meetings
// @access  Private
const getMeetings = async (req, res) => {
    try {
        const { status, date, type, search } = req.query;
        const whereClause = {};

        if (status && status !== 'all') {
            whereClause.status = status;
        }

        if (date) {
            whereClause.scheduled_date = date;
        }

        if (type && type !== 'all') {
            whereClause.meeting_type = type;
        }

        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { meeting_id: { [Op.like]: `%${search}%` } },
                { host_name: { [Op.like]: `%${search}%` } },
                { department: { [Op.like]: `%${search}%` } }
            ];
        }

        const meetings = await Meeting.findAll({
            where: whereClause,
            order: [
                ['scheduled_date', 'DESC'],
                ['start_time', 'ASC']
            ],
            include: [{
                model: Employee,
                as: 'host',
                attributes: ['id', 'first_name', 'last_name', 'email', 'department', 'position'],
                required: false
            }]
        });

        // Compute summary counts
        const allList = await Meeting.findAll();
        const stats = {
            total: allList.length,
            scheduled: allList.filter(m => m.status === 'scheduled').length,
            inProgress: allList.filter(m => m.status === 'in-progress').length,
            completed: allList.filter(m => m.status === 'completed').length
        };

        res.json({
            success: true,
            data: meetings,
            stats
        });
    } catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get single meeting by meeting_id or id
// @route   GET /api/meetings/:meetingId
// @access  Private
const getMeetingById = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const meeting = await Meeting.findOne({
            where: {
                [Op.or]: [
                    { meeting_id: meetingId },
                    { id: isNaN(meetingId) ? 0 : parseInt(meetingId, 10) }
                ]
            },
            include: [{
                model: Employee,
                as: 'host',
                attributes: ['id', 'first_name', 'last_name', 'email', 'department', 'position'],
                required: false
            }]
        });

        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        res.json({
            success: true,
            data: meeting
        });
    } catch (error) {
        console.error('Error fetching meeting by id:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Schedule / Create a new meeting
// @route   POST /api/meetings
// @access  Private
const createMeeting = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            meeting_type, 
            scheduled_date, 
            start_time, 
            duration_minutes, 
            department, 
            passcode,
            custom_meeting_id,
            settings,
            invited_employees 
        } = req.body;

        if (!title || !scheduled_date || !start_time) {
            return res.status(400).json({ 
                success: false, 
                message: 'Meeting title, date, and start time are required' 
            });
        }

        // Identify host from logged-in user
        let hostId = null;
        let hostName = req.user?.email || 'Host';

        if (req.user?.id) {
            const emp = await Employee.findOne({ where: { user_id: req.user.id } });
            if (emp) {
                hostId = emp.id;
                hostName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;
            }
        }

        const meetingId = (custom_meeting_id && custom_meeting_id.trim()) 
            ? custom_meeting_id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
            : generateMeetingCode();

        // Calculate end_time based on start_time + duration_minutes
        const duration = parseInt(duration_minutes || 45, 10);
        const startMoment = moment(start_time, ['HH:mm:ss', 'HH:mm']);
        const endMoment = startMoment.clone().add(duration, 'minutes');
        const endTime = endMoment.format('HH:mm:ss');

        const defaultSettings = JSON.stringify(settings || {
            allowScreenShare: true,
            allowChat: true,
            allowDocumentShare: true,
            muteOnJoin: false
        });

        const invitedEmployeesStr = Array.isArray(invited_employees)
            ? JSON.stringify(invited_employees)
            : (typeof invited_employees === 'string' ? invited_employees : '[]');

        const newMeeting = await Meeting.create({
            meeting_id: meetingId,
            title: title.trim(),
            description: description || '',
            host_id: hostId,
            host_name: hostName,
            meeting_type: meeting_type || 'group',
            status: 'scheduled',
            scheduled_date,
            start_time,
            end_time: endTime,
            duration_minutes: duration,
            department: department || 'All',
            passcode: passcode || '',
            meeting_link: `/meetings/${meetingId}`,
            settings: defaultSettings,
            invited_employees: invitedEmployeesStr
        });

        res.status(201).json({
            success: true,
            message: 'Meeting scheduled successfully',
            data: newMeeting
        });
    } catch (error) {
        console.error('Error creating meeting:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Update meeting status or details
// @route   PUT /api/meetings/:id
// @access  Private
const updateMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const meeting = await Meeting.findOne({
            where: {
                [Op.or]: [
                    { id: isNaN(id) ? 0 : parseInt(id, 10) },
                    { meeting_id: id }
                ]
            }
        });

        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        const { title, description, status, scheduled_date, start_time, duration_minutes, department, passcode } = req.body;

        if (title !== undefined) meeting.title = title;
        if (description !== undefined) meeting.description = description;
        if (status !== undefined) meeting.status = status;
        if (scheduled_date !== undefined) meeting.scheduled_date = scheduled_date;
        if (start_time !== undefined) meeting.start_time = start_time;
        if (duration_minutes !== undefined) meeting.duration_minutes = duration_minutes;
        if (department !== undefined) meeting.department = department;
        if (passcode !== undefined) meeting.passcode = passcode;

        await meeting.save();

        res.json({
            success: true,
            message: 'Meeting updated successfully',
            data: meeting
        });
    } catch (error) {
        console.error('Error updating meeting:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Delete / Cancel meeting
// @route   DELETE /api/meetings/:id
// @access  Private
const deleteMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const meeting = await Meeting.findOne({
            where: {
                [Op.or]: [
                    { id: isNaN(id) ? 0 : parseInt(id, 10) },
                    { meeting_id: id }
                ]
            }
        });

        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        await meeting.destroy();

        res.json({
            success: true,
            message: 'Meeting cancelled successfully'
        });
    } catch (error) {
        console.error('Error deleting meeting:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get chat messages for a meeting
// @route   GET /api/meetings/:meetingId/messages
// @access  Private
const getMeetingMessages = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const messages = await MeetingMessage.findAll({
            where: { meeting_id: meetingId },
            order: [['created_at', 'ASC']]
        });

        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error('Error fetching meeting messages:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Post a chat message in a meeting
// @route   POST /api/meetings/:meetingId/messages
// @access  Private
const postMeetingMessage = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { message, sender_name, sender_role } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message content is required' });
        }

        let name = sender_name;
        let role = sender_role || req.user?.role || 'Participant';

        if (!name && req.user) {
            const emp = await Employee.findOne({ where: { user_id: req.user.id } });
            name = emp ? `${emp.first_name} ${emp.last_name}` : req.user.email;
        }

        const newMsg = await MeetingMessage.create({
            meeting_id: meetingId,
            sender_id: req.user?.id || null,
            sender_name: name || 'Anonymous',
            sender_role: role,
            message: message.trim()
        });

        res.status(201).json({
            success: true,
            data: newMsg
        });
    } catch (error) {
        console.error('Error posting meeting message:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get documents shared in a meeting
// @route   GET /api/meetings/:meetingId/documents
// @access  Private
const getMeetingDocuments = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const documents = await MeetingDocument.findAll({
            where: { meeting_id: meetingId },
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: documents
        });
    } catch (error) {
        console.error('Error fetching meeting documents:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Upload & share document in a meeting
// @route   POST /api/meetings/:meetingId/documents
// @access  Private
const uploadMeetingDocument = async (req, res) => {
    try {
        const { meetingId } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a document file' });
        }

        let uploaderName = req.body.uploader_name || 'Participant';
        if (req.user) {
            const emp = await Employee.findOne({ where: { user_id: req.user.id } });
            uploaderName = emp ? `${emp.first_name} ${emp.last_name}` : req.user.email;
        }

        const relativePath = `/uploads/documents/${req.file.filename}`;

        const docRecord = await MeetingDocument.create({
            meeting_id: meetingId,
            uploader_id: req.user?.id || null,
            uploader_name: uploaderName,
            file_name: req.file.originalname,
            file_path: relativePath,
            file_size: req.file.size,
            file_type: req.file.mimetype
        });

        res.status(201).json({
            success: true,
            message: 'Document shared successfully',
            data: docRecord
        });
    } catch (error) {
        console.error('Error uploading meeting document:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

module.exports = {
    getMeetings,
    getMeetingById,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getMeetingMessages,
    postMeetingMessage,
    getMeetingDocuments,
    uploadMeetingDocument
};

