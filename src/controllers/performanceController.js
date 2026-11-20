const Performance = require('../models/Performance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { Op } = require('sequelize');

let hasAutoSynced = false;
const ensurePerformanceSynced = async () => {
    if (hasAutoSynced) return;
    hasAutoSynced = true;
    try {
        await Performance.sync({ alter: true });
        const count = await Performance.count();
        if (count === 0) {
            // Seed sample initial evaluations from active employees
            const employees = await Employee.findAll({ limit: 5 });
            const sampleGoals = [
                'Complete AWS Cloud Certification and streamline CI/CD deployment pipelines.',
                'Improve test coverage by 20% and architect scalable microservices modules.',
                'Lead agile sprints, reduce technical debt, and mentor junior developers.',
                'Optimize LMS frontend caching and mobile responsiveness.'
            ];
            const sampleAchievements = [
                'Delivered core attendance tracking module ahead of project deadlines.',
                'Automated HR letter generation and digital certificate workflows.',
                'Resolved high-priority production tickets with high client satisfaction.',
                'Spearheaded performance benchmarking across database clusters.'
            ];
            const sampleComments = [
                'Consistently demonstrates exceptional engineering and problem-solving abilities.',
                'Highly dependable team player with strong technical discipline and ownership.',
                'Proactive communicator who meets all sprint deliverables reliably.',
                'Exceeds expectations across all project milestones.'
            ];

            for (let i = 0; i < employees.length; i++) {
                const emp = employees[i];
                await Performance.create({
                    employee_id: emp.id,
                    reviewer_id: null,
                    review_date: new Date(Date.now() - i * 7 * 86400000),
                    rating: i === 0 ? 5 : (i % 2 === 0 ? 4 : 5),
                    status: i === 3 ? 'submitted' : 'reviewed',
                    comments: sampleComments[i % sampleComments.length],
                    goals: sampleGoals[i % sampleGoals.length],
                    achievements: sampleAchievements[i % sampleAchievements.length]
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.error('Error auto-syncing performance table:', e.message);
    }
};

// @desc    Get all performance reviews
// @route   GET /api/performance
// @access  Private (Admin, HR, Manager, Employee)
const getPerformances = async (req, res) => {
    try {
        await ensurePerformanceSynced();

        const where = {};
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'hr' && req.user.role !== 'manager') {
            const currentEmployee = await Employee.findOne({ where: { user_id: req.user.id } });
            if (!currentEmployee) {
                return res.json({ success: true, data: [] });
            }
            where.employee_id = currentEmployee.id;
        }

        const reviews = await Performance.findAll({
            where,
            include: [
                {
                    model: Employee,
                    attributes: ['id', 'first_name', 'last_name', 'employee_id', 'department', 'position']
                },
                {
                    model: User,
                    as: 'reviewer',
                    attributes: ['id', 'email', 'role']
                }
            ],
            order: [['review_date', 'DESC'], ['id', 'DESC']]
        });

        const data = reviews.map(r => ({
            id: r.id,
            employee_id: r.employee_id,
            employee_name: r.Employee ? `${r.Employee.first_name} ${r.Employee.last_name}` : 'N/A',
            employee_code: r.Employee?.employee_id || `EMP-${r.employee_id}`,
            department: r.Employee?.department || 'N/A',
            position: r.Employee?.position || 'N/A',
            review_date: r.review_date,
            rating: r.rating,
            status: r.status,
            comments: r.comments || '',
            goals: r.goals || '',
            achievements: r.achievements || '',
            reviewer_name: r.reviewer ? r.reviewer.email : 'Senior Management'
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error('Get performances error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get performance statistics
// @route   GET /api/performance/stats
// @access  Private
const getPerformanceStats = async (req, res) => {
    try {
        await ensurePerformanceSynced();

        const where = {};
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'hr' && req.user.role !== 'manager') {
            const currentEmployee = await Employee.findOne({ where: { user_id: req.user.id } });
            if (currentEmployee) {
                where.employee_id = currentEmployee.id;
            }
        }

        const allReviews = await Performance.findAll({ where });

        let totalReviews = allReviews.length;
        let totalRating = 0;
        let reviewedCount = 0;
        let pendingCount = 0;

        allReviews.forEach(r => {
            totalRating += r.rating || 0;
            if (r.status === 'reviewed') reviewedCount++;
            if (r.status === 'submitted' || r.status === 'draft') pendingCount++;
        });

        const avgRating = totalReviews > 0 ? (totalRating / totalReviews).toFixed(1) : 0;

        res.json({
            success: true,
            data: {
                totalReviews,
                avgRating: parseFloat(avgRating),
                reviewedCount,
                pendingCount
            }
        });
    } catch (error) {
        console.error('Get performance stats error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get single review by id
// @route   GET /api/performance/:id
// @access  Private
const getPerformance = async (req, res) => {
    try {
        const review = await Performance.findByPk(req.params.id, {
            include: [
                {
                    model: Employee,
                    attributes: ['id', 'first_name', 'last_name', 'employee_id', 'department', 'position', 'email']
                },
                {
                    model: User,
                    as: 'reviewer',
                    attributes: ['id', 'email', 'role']
                }
            ]
        });

        if (!review) {
            return res.status(404).json({ success: false, message: 'Performance review not found' });
        }

        const data = {
            id: review.id,
            employee_id: review.employee_id,
            employee_name: review.Employee ? `${review.Employee.first_name} ${review.Employee.last_name}` : 'N/A',
            employee_code: review.Employee?.employee_id || `EMP-${review.employee_id}`,
            department: review.Employee?.department || 'N/A',
            position: review.Employee?.position || 'N/A',
            email: review.Employee?.email || '',
            review_date: review.review_date,
            rating: review.rating,
            status: review.status,
            comments: review.comments || '',
            goals: review.goals || '',
            achievements: review.achievements || '',
            reviewer_name: review.reviewer ? review.reviewer.email : 'Senior Management'
        };

        res.json({ success: true, data });
    } catch (error) {
        console.error('Get single review error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Create new performance review
// @route   POST /api/performance
// @access  Private (Admin, HR, Manager)
const createPerformance = async (req, res) => {
    try {
        const {
            employee_id,
            review_date = new Date(),
            rating = 4,
            status = 'reviewed',
            comments = '',
            goals = '',
            achievements = ''
        } = req.body;

        if (!employee_id) {
            return res.status(400).json({ success: false, message: 'Employee is required' });
        }

        const employee = await Employee.findByPk(employee_id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const review = await Performance.create({
            employee_id,
            reviewer_id: req.user?.id || null,
            review_date,
            rating: Math.min(5, Math.max(1, parseInt(rating) || 4)),
            status,
            comments,
            goals,
            achievements
        });

        res.status(201).json({
            success: true,
            message: 'Performance review created successfully',
            data: review
        });
    } catch (error) {
        console.error('Create performance review error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Update performance review
// @route   PUT /api/performance/:id
// @access  Private (Admin, HR, Manager)
const updatePerformance = async (req, res) => {
    try {
        const review = await Performance.findByPk(req.params.id);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Performance review not found' });
        }

        const {
            employee_id,
            review_date,
            rating,
            status,
            comments,
            goals,
            achievements
        } = req.body;

        await review.update({
            employee_id: employee_id || review.employee_id,
            review_date: review_date || review.review_date,
            rating: rating !== undefined ? Math.min(5, Math.max(1, parseInt(rating))) : review.rating,
            status: status || review.status,
            comments: comments !== undefined ? comments : review.comments,
            goals: goals !== undefined ? goals : review.goals,
            achievements: achievements !== undefined ? achievements : review.achievements,
            reviewer_id: req.user?.id || review.reviewer_id
        });

        res.json({
            success: true,
            message: 'Performance review updated successfully',
            data: review
        });
    } catch (error) {
        console.error('Update performance review error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Delete performance review
// @route   DELETE /api/performance/:id
// @access  Private (Admin, HR)
const deletePerformance = async (req, res) => {
    try {
        const review = await Performance.findByPk(req.params.id);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Performance review not found' });
        }

        await review.destroy();
        res.json({ success: true, message: 'Performance review deleted successfully' });
    } catch (error) {
        console.error('Delete performance review error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

module.exports = {
    getPerformances,
    getPerformanceStats,
    getPerformance,
    createPerformance,
    updatePerformance,
    deletePerformance
};
