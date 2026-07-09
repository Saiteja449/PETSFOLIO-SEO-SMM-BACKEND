import SmmTask from '../models/SmmTask.js';
import TargetTemplate from '../models/TargetTemplate.js';
import EmployeeTarget from '../models/EmployeeTarget.js';

// Helper to recalculate SMM target progress
const recalculateSmmTargetProgress = async (employeeId, taskType) => {
  try {
    const template = await TargetTemplate.findOne({ name: taskType });
    if (!template) return;

    // Get all targets for this employee and template
    const targets = await EmployeeTarget.find({
      employeeId,
      templateId: template._id,
    });

    for (const target of targets) {
      // Count completed SmmTasks for this employee & type within the target's start and end dates
      const completedCount = await SmmTask.countDocuments({
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
      console.log(`Recalculated target ${target._id}: currentValue=${target.currentValue}, status=${target.status}`);
    }
  } catch (error) {
    console.error('Error recalculating target progress:', error);
  }
};

// @desc    Get all SMM tasks based on filters
// @route   GET /api/smm-tasks
// @access  Public
export const getSmmTasks = async (req, res) => {
  try {
    const { companyId, employeeId, weekLabel } = req.query;

    const query = {};
    if (companyId) query.companyId = companyId;
    // If employeeId is "all", we don't filter by it
    if (employeeId && employeeId !== 'all') query.employeeId = employeeId;
    // Let's assume we want tasks globally if weekLabel isn't strictly requested, 
    // but the dashboard relies on week filters
    if (weekLabel) query.weekLabel = weekLabel;

    const tasks = await SmmTask.find(query).sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    console.error('Error fetching SMM tasks:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a new SMM task
// @route   POST /api/smm-tasks
// @access  Public
export const createSmmTask = async (req, res) => {
  try {
    const { title, url, type, status, employeeId, companyId, weekLabel, date } = req.body;

    if (!title || !companyId || !employeeId) {
      return res.status(400).json({ success: false, message: 'Title, companyId, and employeeId are required' });
    }

    const newTask = await SmmTask.create({
      title,
      url,
      type,
      status,
      employeeId,
      companyId,
      weekLabel,
      date,
    });

    if (status === 'completed') {
      await recalculateSmmTargetProgress(employeeId, type);
    }

    res.status(201).json({ success: true, data: newTask });
  } catch (error) {
    console.error('Error creating SMM task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update an SMM task
// @route   PUT /api/smm-tasks/:id
// @access  Public
export const updateSmmTask = async (req, res) => {
  try {
    const originalTask = await SmmTask.findById(req.params.id);

    if (!originalTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const updatedTask = await SmmTask.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Recalculate target progress if status, type, or employee changed, or if it was completed
    if (originalTask.status === 'completed' || updatedTask.status === 'completed') {
      await recalculateSmmTargetProgress(originalTask.employeeId, originalTask.type);
      if (originalTask.employeeId !== updatedTask.employeeId || originalTask.type !== updatedTask.type) {
        await recalculateSmmTargetProgress(updatedTask.employeeId, updatedTask.type);
      }
    }

    res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating SMM task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete an SMM task
// @route   DELETE /api/smm-tasks/:id
// @access  Public
export const deleteSmmTask = async (req, res) => {
  try {
    const task = await SmmTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    await SmmTask.findByIdAndDelete(req.params.id);

    if (task.status === 'completed') {
      await recalculateSmmTargetProgress(task.employeeId, task.type);
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('Error deleting SMM task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
