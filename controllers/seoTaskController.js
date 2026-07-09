import SeoTask from '../models/SeoTask.js';
import SeoActivityTemplate from '../models/SeoActivityTemplate.js';
import EmployeeTarget from '../models/EmployeeTarget.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Helper to recalculate SEO target progress
const recalculateSeoTargetProgress = async (employeeId, taskType) => {
  if (!employeeId) return;
  try {
    const template = await SeoActivityTemplate.findOne({ activityName: taskType });
    if (!template) return;

    // Get all targets for this employee and template
    const targets = await EmployeeTarget.find({
      employeeId,
      seoTemplateId: template._id,
      targetType: 'SEO',
    });

    for (const target of targets) {
      // Count completed SeoTasks for this employee & type within the target's start and end dates
      const completedCount = await SeoTask.countDocuments({
        employeeId,
        type: taskType,
        status: 'completed',
        createdAt: { $gte: target.startDate, $lte: target.endDate }
      });

      target.currentValue = completedCount;
      const goalValue = target.weeklyTarget || target.monthlyTarget || target.targetGoal || 0;
      if (target.currentValue >= goalValue) {
        target.status = 'Completed';
      } else {
        target.status = 'In Progress';
      }
      await target.save();
      console.log(`Recalculated SEO target ${target._id}: currentValue=${target.currentValue}, status=${target.status}`);
    }
  } catch (error) {
    console.error('Error recalculating SEO target progress:', error);
  }
};

// @desc    Get all SEO tasks based on filters
// @route   GET /api/seo-tasks
// @access  Public
export const getSeoTasks = async (req, res) => {
  try {
    const { companyId, employeeId, weekLabel } = req.query;

    const query = {};
    if (companyId) query.companyId = companyId;
    if (employeeId && employeeId !== 'all') query.employeeId = employeeId;
    if (weekLabel) query.weekLabel = weekLabel;

    const tasks = await SeoTask.find(query).sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    console.error('Error fetching SEO tasks:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a new SEO task
// @route   POST /api/seo-tasks
// @access  Public
export const createSeoTask = async (req, res) => {
  try {
    const { title, description, url, type, status, employeeId, assignedTo, companyId, weekLabel, date } = req.body;

    if (!title || !companyId || !assignedTo) {
      return res.status(400).json({ success: false, message: 'Title, companyId, and assignedTo are required' });
    }

    const newTask = await SeoTask.create({
      title,
      description,
      url,
      type,
      status,
      employeeId,
      assignedTo,
      companyId,
      weekLabel,
      date,
    });

    if (employeeId) {
      await Notification.create({
        title: 'New SEO Task Assigned',
        message: `You have been assigned a new SEO task: ${title}`,
        category: 'task',
        severity: 'info',
        userId: employeeId,
        companyId: companyId
      });
    }

    if (status === 'completed' && employeeId) {
      await recalculateSeoTargetProgress(employeeId, type);
    }

    res.status(201).json({ success: true, data: newTask });
  } catch (error) {
    console.error('Error creating SEO task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update an SEO task
// @route   PUT /api/seo-tasks/:id
// @access  Public
export const updateSeoTask = async (req, res) => {
  try {
    const originalTask = await SeoTask.findById(req.params.id);

    if (!originalTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const updatedTask = await SeoTask.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Recalculate target progress if status, type, or employee changed, or if it was completed
    if ((originalTask.status === 'completed' || updatedTask.status === 'completed') && (originalTask.employeeId || updatedTask.employeeId)) {
      if (originalTask.employeeId) {
        await recalculateSeoTargetProgress(originalTask.employeeId, originalTask.type);
      }
      if (updatedTask.employeeId && (originalTask.employeeId !== updatedTask.employeeId || originalTask.type !== updatedTask.type)) {
        await recalculateSeoTargetProgress(updatedTask.employeeId, updatedTask.type);
      }
    }

    // Send notification if newly completed
    if (originalTask.status !== 'completed' && updatedTask.status === 'completed') {
      const managers = await User.find({ role: 'manager' });
      const employeeName = updatedTask.assignedTo || 'An employee';
      
      const notifications = managers.map(manager => ({
        title: 'SEO Task Completed',
        message: `${employeeName} completed the SEO task: ${updatedTask.title}`,
        category: 'seo',
        severity: 'success',
        userId: manager._id,
        companyId: updatedTask.companyId
      }));
      
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating SEO task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete an SEO task
// @route   DELETE /api/seo-tasks/:id
// @access  Public
export const deleteSeoTask = async (req, res) => {
  try {
    const task = await SeoTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    await SeoTask.findByIdAndDelete(req.params.id);

    if (task.status === 'completed' && task.employeeId) {
      await recalculateSeoTargetProgress(task.employeeId, task.type);
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('Error deleting SEO task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
