import CreativeTask from '../models/CreativeTask.js';
import CreativeActivityTemplate from '../models/CreativeActivityTemplate.js';
import EmployeeTarget from '../models/EmployeeTarget.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Company from '../models/Company.js';

// Helper to recalculate CreativeTask target progress
const recalculateSeoTargetProgress = async (employeeId, taskType) => {
  if (!employeeId) return;
  try {
    const template = await CreativeActivityTemplate.findOne({ activityName: taskType });
    if (!template) return;

    // Get all targets for this employee and template
    const targets = await EmployeeTarget.find({
      employeeId,
      seoTemplateId: template._id,
      targetType: 'CreativeTask',
    });

    for (const target of targets) {
      // Count completed CreativeTasks for this employee & type within the target's start and end dates
      const completedCount = await CreativeTask.countDocuments({
        employeeId,
        type: taskType,
        status: 'completed',
        createdAt: { $gte: target.startDate, $lte: target.endDate }
      });

      target.currentValue = completedCount;
      const goalValue = parseInt(target.targetGoal) || target.weeklyTarget || target.monthlyTarget || 0;
      if (target.currentValue >= goalValue) {
        target.status = 'Completed';
      } else {
        target.status = 'In Progress';
      }
      await target.save();
      console.log(`Recalculated CreativeTask target ${target._id}: currentValue=${target.currentValue}, status=${target.status}`);
    }
  } catch (error) {
    console.error('Error recalculating CreativeTask target progress:', error);
  }
};

// @desc    Get all CreativeTask tasks based on filters
// @route   GET /api/seo-tasks
// @access  Public
export const getCreativeTasks = async (req, res) => {
  try {
    const { companyId, employeeId, weekLabel } = req.query;

    const query = {};
    if (companyId && companyId !== 'all') query.companyId = companyId;
    if (employeeId && employeeId !== 'all') query.employeeId = employeeId;
    if (weekLabel) query.weekLabel = weekLabel;

    const tasks = await CreativeTask.find(query).sort({ createdAt: -1 });
    await Promise.all(tasks.filter((task) => task.completedQuantity > 0 && task.updates.length === 0 && task.url).map(async (task) => {
      task.updates.push({ quantityAdded: task.completedQuantity, description: task.url, date: task.updatedAt || task.createdAt });
      await task.save();
    }));

    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    console.error('Error fetching CreativeTask tasks:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a new CreativeTask task
// @route   POST /api/seo-tasks
// @access  Public
export const createCreativeTask = async (req, res) => {
  try {
    const { title, description, url, type, status, employeeId, assignedTo, companyId, weekLabel, date } = req.body;

    if (!title || !companyId || !assignedTo) {
      return res.status(400).json({ success: false, message: 'Title, companyId, and assignedTo are required' });
    }

    const newTask = await CreativeTask.create({
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
      const company = await Company.findOne({ id: companyId });
      const notificationData = {
        title: 'New CreativeTask Task Assigned',
        message: `You have been assigned a new CreativeTask task: ${title}`,
        category: 'task',
        severity: 'info',
        userId: employeeId,
      };
      if (company) {
        notificationData.companyId = company._id;
      }
      await Notification.create(notificationData);
    }

    if (status === 'completed' && employeeId) {
      await recalculateSeoTargetProgress(employeeId, type);
    }

    res.status(201).json({ success: true, data: newTask });
  } catch (error) {
    console.error('Error creating CreativeTask task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update an CreativeTask task
// @route   PUT /api/seo-tasks/:id
// @access  Public
export const updateCreativeTask = async (req, res) => {
  try {
    const originalTask = await CreativeTask.findById(req.params.id);

    if (!originalTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const { newUpdate, ...taskFields } = req.body;
    let updatedTask;
    const hasLegacyQuantityUpdate = originalTask.targetQuantity > 1 && taskFields.completedQuantity !== undefined;
    if (newUpdate || hasLegacyQuantityUpdate) {
      const requestedQuantity = newUpdate ? Number(newUpdate.quantityAdded) : Number(taskFields.completedQuantity);
      const quantityAdded = newUpdate ? requestedQuantity : requestedQuantity - (originalTask.completedQuantity || 0);
      const description = String(newUpdate?.description || taskFields.url || taskFields.description || '').trim();
      const remaining = Math.max((originalTask.targetQuantity || 1) - (originalTask.completedQuantity || 0), 0);
      if (!Number.isInteger(quantityAdded) || quantityAdded < 1 || quantityAdded > remaining || !description) {
        return res.status(400).json({ success: false, message: 'Invalid task update or quantity exceeds the remaining target' });
      }
      originalTask.completedQuantity = (originalTask.completedQuantity || 0) + quantityAdded;
      originalTask.status = originalTask.completedQuantity >= originalTask.targetQuantity ? 'completed' : 'inprogress';
      originalTask.updates.push({ quantityAdded, description });
      if (!newUpdate && taskFields.url) originalTask.url = taskFields.url;
      updatedTask = await originalTask.save();
    } else {
      updatedTask = await CreativeTask.findByIdAndUpdate(req.params.id, taskFields, { new: true, runValidators: true });
    }

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
      
      const company = await Company.findOne({ id: updatedTask.companyId });
      
      const notifications = managers.map(manager => {
        const notif = {
          title: 'CreativeTask Task Completed',
          message: `${employeeName} completed the CreativeTask task: ${updatedTask.title}`,
          category: 'seo',
          severity: 'success',
          userId: manager._id
        };
        if (company) notif.companyId = company._id;
        return notif;
      });
      
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating CreativeTask task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete an CreativeTask task
// @route   DELETE /api/seo-tasks/:id
// @access  Public
export const deleteCreativeTask = async (req, res) => {
  try {
    const task = await CreativeTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    await CreativeTask.findByIdAndDelete(req.params.id);

    if (task.status === 'completed' && task.employeeId) {
      await recalculateSeoTargetProgress(task.employeeId, task.type);
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('Error deleting CreativeTask task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
