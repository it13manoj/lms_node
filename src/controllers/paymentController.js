const Payment = require('../models/Payment');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Salary = require('../models/Salary');
const { Op } = require('sequelize');

// Auto-sync salaries into payments if payments table has never been populated
let hasAutoSynced = false;
const ensureSalariesSynced = async () => {
    if (hasAutoSynced) return;
    hasAutoSynced = true;
    try {
        await Payment.sync({ alter: true });
        const paymentCount = await Payment.count();
        if (paymentCount === 0) {
            const salaries = await Salary.findAll({
                include: [{ model: Employee, attributes: ['id', 'first_name', 'last_name', 'employee_id'] }]
            });
            for (const sal of salaries) {
                const year = sal.month_year ? new Date(sal.month_year).getFullYear() : 2026;
                const paddedId = String(sal.id).padStart(4, '0');
                const ref = `SAL-${year}-${paddedId}`;
                await Payment.create({
                    reference_number: ref,
                    employee_id: sal.employee_id,
                    payment_type: 'salary',
                    amount: sal.net_salary || sal.total_salary || sal.basic_salary || 0,
                    payment_date: sal.payment_date || sal.month_year || new Date(),
                    status: sal.status === 'paid' ? 'completed' : (sal.status === 'approved' ? 'completed' : 'pending'),
                    payment_method: sal.payment_method || 'Bank Transfer',
                    description: `Salary disbursement for ${sal.month_year || 'period'}`,
                    created_by: null
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.error('Error auto-syncing salaries to payments:', e.message);
    }
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private (Admin, HR, Employee)
const getPayments = async (req, res) => {
    try {
        await ensureSalariesSynced();

        const {
            page = 1,
            limit = 10,
            type,
            status,
            dateFrom,
            dateTo,
            search
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const where = {};

        // Role-based isolation: Regular employees can only see their own payment history
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'hr') {
            const currentEmployee = await Employee.findOne({ where: { user_id: req.user.id } });
            if (!currentEmployee) {
                return res.json({ success: true, data: [], total: 0, page: 1, totalPages: 0 });
            }
            where.employee_id = currentEmployee.id;
        }

        if (type) where.payment_type = type;
        if (status) where.status = status;
        if (dateFrom && dateTo) {
            where.payment_date = { [Op.between]: [dateFrom, dateTo] };
        } else if (dateFrom) {
            where.payment_date = { [Op.gte]: dateFrom };
        } else if (dateTo) {
            where.payment_date = { [Op.lte]: dateTo };
        }

        const employeeWhere = {};
        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            where[Op.or] = [
                { reference_number: { [Op.like]: term } },
                { description: { [Op.like]: term } },
                { '$Employee.first_name$': { [Op.like]: term } },
                { '$Employee.last_name$': { [Op.like]: term } },
                { '$Employee.employee_id$': { [Op.like]: term } }
            ];
        }

        const { count, rows } = await Payment.findAndCountAll({
            where,
            include: [
                {
                    model: Employee,
                    attributes: ['id', 'first_name', 'last_name', 'employee_id', 'department', 'position']
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: ['id', 'email', 'role']
                }
            ],
            order: [['payment_date', 'DESC'], ['id', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        const mapped = rows.map(p => ({
            id: p.id,
            reference_number: p.reference_number,
            employee_id: p.Employee?.employee_id || `EMP-${p.employee_id}`,
            employee_name: p.Employee ? `${p.Employee.first_name} ${p.Employee.last_name}` : 'N/A',
            department: p.Employee?.department || 'N/A',
            position: p.Employee?.position || 'N/A',
            payment_type: p.payment_type,
            amount: parseFloat(p.amount) || 0,
            payment_date: p.payment_date,
            status: p.status,
            payment_method: p.payment_method,
            description: p.description,
            created_by_name: p.creator ? p.creator.email : 'System',
            created_at: p.created_at
        }));

        res.json({
            success: true,
            data: mapped,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get summary statistics of payments
// @route   GET /api/payments/summary
// @access  Private (Admin, HR, Employee)
const getPaymentSummary = async (req, res) => {
    try {
        await ensureSalariesSynced();

        const where = {};
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'hr') {
            const currentEmployee = await Employee.findOne({ where: { user_id: req.user.id } });
            if (currentEmployee) {
                where.employee_id = currentEmployee.id;
            } else {
                return res.json({
                    success: true,
                    data: { totalAmount: 0, totalPayments: 0, pendingCount: 0, completedCount: 0 }
                });
            }
        }

        const allPayments = await Payment.findAll({ where });

        let totalAmount = 0;
        let totalPayments = allPayments.length;
        let pendingCount = 0;
        let completedCount = 0;

        allPayments.forEach(p => {
            const amt = parseFloat(p.amount) || 0;
            if (p.status === 'completed') {
                totalAmount += amt;
                completedCount++;
            } else if (p.status === 'pending') {
                pendingCount++;
            }
        });

        res.json({
            success: true,
            data: {
                totalAmount,
                totalPayments,
                pendingCount,
                completedCount
            }
        });
    } catch (error) {
        console.error('Get payment summary error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get single payment details
// @route   GET /api/payments/:id
// @access  Private
const getPayment = async (req, res) => {
    try {
        const payment = await Payment.findByPk(req.params.id, {
            include: [
                { model: Employee, attributes: ['id', 'first_name', 'last_name', 'employee_id', 'department', 'position'] },
                { model: User, as: 'creator', attributes: ['id', 'email', 'role'] }
            ]
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        const data = {
            id: payment.id,
            reference_number: payment.reference_number,
            employee_id: payment.Employee?.employee_id || `EMP-${payment.employee_id}`,
            employee_name: payment.Employee ? `${payment.Employee.first_name} ${payment.Employee.last_name}` : 'N/A',
            department: payment.Employee?.department || 'N/A',
            position: payment.Employee?.position || 'N/A',
            payment_type: payment.payment_type,
            amount: parseFloat(payment.amount) || 0,
            payment_date: payment.payment_date,
            status: payment.status,
            payment_method: payment.payment_method,
            description: payment.description,
            created_by_name: payment.creator ? payment.creator.email : 'System',
            created_at: payment.created_at
        };

        res.json({ success: true, data });
    } catch (error) {
        console.error('Get payment details error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Create a new payment record
// @route   POST /api/payments
// @access  Private (Admin, HR)
const createPayment = async (req, res) => {
    try {
        const {
            employee_id,
            payment_type = 'salary',
            amount,
            payment_date = new Date(),
            status = 'completed',
            payment_method = 'Bank Transfer',
            description = '',
            reference_number
        } = req.body;

        if (!employee_id || !amount) {
            return res.status(400).json({ success: false, message: 'Employee ID and amount are required' });
        }

        const employee = await Employee.findByPk(employee_id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const year = new Date(payment_date).getFullYear();
        const rand = Math.floor(1000 + Math.random() * 9000);
        const ref = reference_number || `PAY-${year}-${rand}`;

        const payment = await Payment.create({
            reference_number: ref,
            employee_id,
            payment_type,
            amount: parseFloat(amount),
            payment_date,
            status,
            payment_method,
            description,
            created_by: req.user?.id || null
        });

        res.status(201).json({
            success: true,
            message: 'Payment record created successfully',
            data: payment
        });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Download / view payment receipt
// @route   GET /api/payments/:id/receipt
// @access  Private
const getPaymentReceipt = async (req, res) => {
    try {
        const payment = await Payment.findByPk(req.params.id, {
            include: [{ model: Employee, attributes: ['id', 'first_name', 'last_name', 'employee_id', 'department', 'position', 'email'] }]
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        const formattedAmount = Number(payment.amount).toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR'
        });

        const empName = payment.Employee ? `${payment.Employee.first_name} ${payment.Employee.last_name}` : 'Employee';
        const empCode = payment.Employee?.employee_id || `EMP-${payment.employee_id}`;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payment Receipt - ${payment.reference_number}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #2d3748; background: #fff; }
        .receipt-card { max-width: 650px; margin: 0 auto; border: 2px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { text-align: center; border-bottom: 2px solid #2b6cb0; padding-bottom: 20px; margin-bottom: 24px; }
        .header h1 { margin: 0; color: #1a365d; font-size: 24px; letter-spacing: 1px; }
        .header p { margin: 4px 0 0; color: #718096; font-size: 13px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: #c6f6d5; color: #22543d; }
        .grid { display: flex; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid #edf2f7; padding-bottom: 12px; }
        .label { font-size: 13px; color: #718096; font-weight: 500; }
        .value { font-size: 14px; color: #1a202c; font-weight: 600; text-align: right; }
        .amount-box { text-align: center; background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 18px; margin: 24px 0; }
        .amount-box .title { font-size: 12px; color: #2b6cb0; font-weight: 600; text-transform: uppercase; }
        .amount-box .amt { font-size: 28px; color: #2c5282; font-weight: 800; margin-top: 4px; }
        .footer { text-align: center; font-size: 11px; color: #a0aec0; margin-top: 24px; }
        @media print { body { padding: 0; } .receipt-card { border: none; box-shadow: none; } }
    </style>
</head>
<body>
    <div class="receipt-card">
        <div class="header">
            <h1>PARAKSHTECH LLP</h1>
            <p>Official Transaction &amp; Payment Disbursement Receipt</p>
        </div>
        <div class="grid">
            <span class="label">Receipt Reference</span>
            <span class="value">${payment.reference_number}</span>
        </div>
        <div class="grid">
            <span class="label">Payment Date</span>
            <span class="value">${payment.payment_date}</span>
        </div>
        <div class="grid">
            <span class="label">Beneficiary Employee</span>
            <span class="value">${empName} (${empCode})</span>
        </div>
        <div class="grid">
            <span class="label">Department / Position</span>
            <span class="value">${payment.Employee?.department || 'Engineering'} - ${payment.Employee?.position || 'Staff'}</span>
        </div>
        <div class="grid">
            <span class="label">Payment Type</span>
            <span class="value" style="text-transform: capitalize;">${payment.payment_type}</span>
        </div>
        <div class="grid">
            <span class="label">Payment Method</span>
            <span class="value">${payment.payment_method}</span>
        </div>
        <div class="grid">
            <span class="label">Transaction Status</span>
            <span class="value"><span class="badge">${payment.status}</span></span>
        </div>
        <div class="amount-box">
            <div class="title">Net Amount Disbursed</div>
            <div class="amt">${formattedAmount}</div>
        </div>
        <div style="font-size: 12px; color: #718096; margin-bottom: 20px;">
            <strong>Remarks / Description:</strong> ${payment.description || 'Disbursement verified and credited to employee designated bank account.'}
        </div>
        <div class="footer">
            Generated securely via ParakshTech HRMS &bull; Verification Ref: ${payment.reference_number}
        </div>
    </div>
    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
        };
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Get payment receipt error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

module.exports = {
    getPayments,
    getPaymentSummary,
    getPayment,
    createPayment,
    getPaymentReceipt
};
