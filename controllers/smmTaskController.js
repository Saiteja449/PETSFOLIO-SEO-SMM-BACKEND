import SmmTask from '../models/SmmTask.js';

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
    let task = await SmmTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    task = await SmmTask.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: task });
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

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('Error deleting SMM task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
