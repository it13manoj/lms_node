const Policy = require('../models/Policy');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

const getPolicies = async (req, res) => {
  try {
    const { status, policy_type, category, search } = req.query;

    const where = {};

    if (status) where.status = status;
    if (policy_type) where.policy_type = policy_type;
    if (category) where.category = category;

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } }
      ];
    }

    const policies = await Policy.findAll({
      where,
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'email', 'role']
      }],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: policies
    });
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getPolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await Policy.findByPk(id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'email', 'role']
      }]
    });

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const createPolicy = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      title,
      description,
      policy_type,
      category,
      file_url,
      version,
      effective_date,
      status
    } = req.body;

    const payload = {
      title,
      description,
      policy_type,
      category: category || null,
      file_url: file_url || null,
      version: version || null,
      effective_date: effective_date || null,
      created_by: req.user.id,
      status: status || 'active'
    };

    const policy = await Policy.create(payload);

    res.status(201).json({
      success: true,
      message: 'Policy created successfully',
      data: policy
    });
  } catch (error) {
    console.error('Error creating policy:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const updatePolicy = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const policy = await Policy.findByPk(id);

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    const {
      title,
      description,
      policy_type,
      category,
      file_url,
      version,
      effective_date,
      status
    } = req.body;

    await policy.update({
      title: title || policy.title,
      description: description !== undefined ? description : policy.description,
      policy_type: policy_type || policy.policy_type,
      category: category !== undefined ? category : policy.category,
      file_url: file_url !== undefined ? file_url : policy.file_url,
      version: version !== undefined ? version : policy.version,
      effective_date: effective_date !== undefined ? effective_date : policy.effective_date,
      status: status || policy.status
    });

    res.status(200).json({
      success: true,
      message: 'Policy updated successfully',
      data: policy
    });
  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findByPk(id);

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    await policy.destroy();

    res.status(200).json({
      success: true,
      message: 'Policy deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting policy:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy
};
