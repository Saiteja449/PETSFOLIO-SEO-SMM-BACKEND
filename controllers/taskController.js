import Task from "../models/Task.js";
import TaskTemplate from "../models/TaskTemplate.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Company from "../models/Company.js";

// Helper to recalculate unified target progress
const recalculateTargetProgress = async (employeeId, taskType, department) => {
  try {
    const template = await TaskTemplate.findOne({ name: taskType, department });
    if (!template) return;

    // Get all targets for this employee and template
    const targets = await EmployeeTarget.find({
      employeeId,
      templateId: template._id,
    });

    for (const target of targets) {
      // Count completed tasks directly assigned OR completed subtasks assigned to this user
      const directCompletedTasks = await Task.find({
        employeeId,
        department,
        type: taskType,
        status: "completed",
        createdAt: { $gte: target.startDate, $lte: target.endDate },
      });
      let completedCount = directCompletedTasks.reduce(
        (acc, t) => acc + (t.completedQuantity || 1),
        0,
      );

      // Check subtasks assigned to this user as intern
      const subtaskTasks = await Task.find({
        department,
        type: taskType,
        "subTasks.assignedToInternId": employeeId,
        createdAt: { $gte: target.startDate, $lte: target.endDate },
      });
      subtaskTasks.forEach((tsk) => {
        const myCompletedSubs = (tsk.subTasks || []).filter(
          (st) =>
            String(st.assignedToInternId) === String(employeeId) &&
            (st.status === "completed" ||
              (st.targetQuantity > 0 &&
                (st.completedQuantity || 0) >= st.targetQuantity)),
        );
        myCompletedSubs.forEach((st) => {
          completedCount += st.completedQuantity || st.targetQuantity || 1;
        });
      });

      target.currentValue = completedCount;
      const goalValue =
        parseInt(target.targetGoal) ||
        target.weeklyTarget ||
        target.monthlyTarget ||
        0;
      if (target.currentValue >= goalValue) {
        target.status = "Completed";
      } else {
        target.status = "In Progress";
      }
      await target.save();
      console.log(
        `Recalculated target ${target._id}: currentValue=${target.currentValue}, status=${target.status}`,
      );
    }
  } catch (error) {
    console.error(
      `Error recalculating target progress for ${department}:`,
      error,
    );
  }
};

// @desc    Get all Tasks based on filters
// @route   GET /api/tasks
// @access  Public
export const getTasks = async (req, res) => {
  try {
    const { companyId, employeeId, weekLabel, department } = req.query;

    const query = {};
    if (companyId && companyId !== "all") {
      query.companyId = new RegExp(`^${companyId}$`, "i");
    }
    if (employeeId && employeeId !== "all") {
      const orConditions = [
        { employeeId: employeeId },
        { assignedTo: employeeId },
        { "subTasks.assignedToInternId": String(employeeId) },
      ];
      if (mongoose.Types.ObjectId.isValid(employeeId)) {
        const objId = new mongoose.Types.ObjectId(employeeId);
        orConditions.push(
          { employeeId: objId },
          { "subTasks.assignedToInternId": objId }
        );
      }
      query.$or = orConditions;
    }
    if (weekLabel) query.weekLabel = weekLabel;
    if (department) query.department = department; // SMM, SEO, Content, Sales, Creative

    query.isArchived = { $ne: true };

    const tasks = await Task.find(query).sort({ createdAt: -1 });

    // Auto-update legacy tasks if needed
    await Promise.all(
      tasks
        .filter(
          (task) =>
            task.completedQuantity > 0 && task.updates.length === 0 && task.url,
        )
        .map(async (task) => {
          task.updates.push({
            quantityAdded: task.completedQuantity,
            description: task.url,
            date: task.updatedAt || task.createdAt,
          });
          await task.save();
        }),
    );

    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a new Task
// @route   POST /api/tasks
// @access  Public
export const createTask = async (req, res) => {
  try {
    const {
      title,
      url,
      type,
      status,
      employeeId,
      companyId,
      weekLabel,
      date,
      department,
      assignedTo,
    } = req.body;

    if (!title || !companyId || (!employeeId && !assignedTo) || !department) {
      return res.status(400).json({
        success: false,
        message:
          "Title, companyId, employeeId/assignedTo, and department are required",
      });
    }

    const newTask = await Task.create({
      title,
      url,
      type,
      status,
      employeeId,
      assignedTo,
      companyId,
      weekLabel,
      date,
      department,
      platform: req.body.platform, // Optional, for SMM
    });

    // Notify employee (using employeeId or resolving from assignedTo if legacy)
    const empId =
      employeeId || (await User.findOne({ email: assignedTo }))?._id;

    if (empId) {
      const company = await Company.findOne({ id: companyId });
      const notificationData = {
        title: `New ${department} Task Assigned`,
        message: `You have been assigned a new ${department} task: ${title}`,
        category: "task",
        severity: "info",
        userId: empId,
      };
      if (company) {
        notificationData.companyId = company._id;
      }
      await Notification.create(notificationData);
    }

    if (status === "completed" && empId) {
      await recalculateTargetProgress(empId, type, department);
    }

    res.status(201).json({ success: true, data: newTask });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update a Task
// @route   PUT /api/tasks/:id
// @access  Public
export const updateTask = async (req, res) => {
  try {
    const originalTask = await Task.findById(req.params.id);

    if (!originalTask) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    const { newUpdate, ...taskFields } = req.body;
    let updatedTask;
    const hasLegacyQuantityUpdate =
      originalTask.targetQuantity > 1 &&
      taskFields.completedQuantity !== undefined;

    if (newUpdate || hasLegacyQuantityUpdate) {
      const requestedQuantity = newUpdate
        ? Number(newUpdate.quantityAdded)
        : Number(taskFields.completedQuantity);
      const quantityAdded = newUpdate
        ? requestedQuantity
        : requestedQuantity - (originalTask.completedQuantity || 0);
      const description = String(
        newUpdate?.description ||
          taskFields.url ||
          taskFields.description ||
          "",
      ).trim();
      const remaining = Math.max(
        (originalTask.targetQuantity || 1) -
          (originalTask.completedQuantity || 0),
        0,
      );

      if (
        !Number.isInteger(quantityAdded) ||
        quantityAdded < 1 ||
        quantityAdded > remaining ||
        !description
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid task update or quantity exceeds the remaining target",
        });
      }

      originalTask.completedQuantity =
        (originalTask.completedQuantity || 0) + quantityAdded;
      originalTask.status =
        originalTask.completedQuantity >= originalTask.targetQuantity
          ? "completed"
          : "inprogress";
      originalTask.updates.push({
        quantityAdded,
        description,
        url: newUpdate?.url || taskFields.url || "",
      });

      if (!newUpdate && taskFields.url) originalTask.url = taskFields.url;
      else if (newUpdate && newUpdate.url) originalTask.url = newUpdate.url;

      updatedTask = await originalTask.save();
    } else {
      updatedTask = await Task.findByIdAndUpdate(req.params.id, taskFields, {
        new: true,
        runValidators: true,
      });
    }

    // Recalculate target progress if status, type, or employee changed, or if it was completed
    if (
      originalTask.status === "completed" ||
      updatedTask.status === "completed"
    ) {
      const originalEmpId =
        originalTask.employeeId ||
        (await User.findOne({ email: originalTask.assignedTo }))?._id;
      const updatedEmpId =
        updatedTask.employeeId ||
        (await User.findOne({ email: updatedTask.assignedTo }))?._id;

      if (originalEmpId)
        await recalculateTargetProgress(
          originalEmpId,
          originalTask.type,
          originalTask.department,
        );
      if (
        originalEmpId !== updatedEmpId ||
        originalTask.type !== updatedTask.type
      ) {
        if (updatedEmpId)
          await recalculateTargetProgress(
            updatedEmpId,
            updatedTask.type,
            updatedTask.department,
          );
      }
    }

    // Send notification if newly completed
    if (
      originalTask.status !== "completed" &&
      updatedTask.status === "completed"
    ) {
      const managers = await User.find({ role: "manager" });

      let employeeName = "An employee";
      const empId =
        updatedTask.employeeId ||
        (await User.findOne({ email: updatedTask.assignedTo }))?._id;
      if (empId) {
        const emp = await User.findById(empId);
        if (emp) employeeName = emp.name;
      }

      const company = await Company.findOne({ id: updatedTask.companyId });

      const notifications = managers.map((manager) => {
        const notif = {
          title: `${updatedTask.department} Task Completed`,
          message: `${employeeName} completed the ${updatedTask.department} task: ${updatedTask.title}`,
          category: updatedTask.department.toLowerCase(),
          severity: "success",
          userId: manager._id,
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
    console.error("Error updating task:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a Task
// @route   DELETE /api/tasks/:id
// @access  Public
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    await Task.findByIdAndDelete(req.params.id);

    if (task.status === "completed") {
      const empId =
        task.employeeId ||
        (await User.findOne({ email: task.assignedTo }))?._id;
      if (empId) {
        await recalculateTargetProgress(empId, task.type, task.department);
      }
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Split a task into sub-tasks for interns
// @route   POST /api/tasks/:id/split
// @access  Public
export const splitTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignments } = req.body;

    const task = await Task.findById(id);
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    if (task.isLegacyInternData)
      return res
        .status(400)
        .json({ success: false, message: "Cannot split legacy task" });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Prevent delegating expired daily tasks to interns
    if (task.dailyExpiry && task.dueDate && new Date(task.dueDate) < todayStart) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot assign expired daily tasks to an intern." });
    }

    // Ensure dueDate and date are synchronized
    if (!task.dueDate) {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      task.dueDate = now;
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      task.date = `${yyyy}-${mm}-${dd}`;
    } else {
      const d = new Date(task.dueDate);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        task.date = `${yyyy}-${mm}-${dd}`;
      }
    }

    const company = task.companyId
      ? await Company.findOne({ id: task.companyId })
      : null;
    const notificationCompanyId = company?._id;

    for (const assign of assignments) {
      task.subTasks.push({
        assignedToInternId: assign.assignedToInternId,
        assignedByEmployeeId: task.employeeId || req.user?._id,
        targetQuantity: assign.targetQuantity,
        notes: assign.notes || "",
        status: "notstarted",
      });

      // Notifications
      try {
        await Notification.create({
          title: "New Subtask",
          message: `You've been assigned ${assign.targetQuantity} tasks for ${task.title}.`,
          category: "task",
          severity: "info",
          userId: assign.assignedToInternId,
          ...(notificationCompanyId
            ? { companyId: notificationCompanyId }
            : {}),
        });
      } catch (notifErr) {
        console.error("Error creating splitTask notification:", notifErr);
      }
    }

    await task.save();
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error("Error splitting task:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

// @desc    Update a sub-task
// @route   PUT /api/tasks/:id/subtasks/:subTaskId
// @access  Public
export const updateSubTask = async (req, res) => {
  try {
    const { id, subTaskId } = req.params;
    const { status, proofUrl, quantityAdded, completedBy, notes } = req.body;

    const task = await Task.findById(id);
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });

    const subTask = task.subTasks.id(subTaskId);
    if (!subTask)
      return res
        .status(404)
        .json({ success: false, message: "SubTask not found" });

    if (status) subTask.status = status;
    if (proofUrl) subTask.proofUrl = proofUrl;
    if (notes) subTask.notes = notes;

    // Track update timestamp
    subTask.updatedAt = new Date();

    if (quantityAdded) {
      subTask.completedQuantity =
        (subTask.completedQuantity || 0) + Number(quantityAdded);
      task.completedQuantity =
        (task.completedQuantity || 0) + Number(quantityAdded);

      if (subTask.completedQuantity >= subTask.targetQuantity) {
        subTask.status = "completed";
      } else if (subTask.completedQuantity > 0) {
        subTask.status = "inprogress";
      }

      subTask.submissions.push({
        quantityAdded: Number(quantityAdded),
        proofUrl: proofUrl || "",
        notes: notes || "",
        submittedAt: new Date(),
      });
    }

    let justCompleted = false;
    if (subTask.status === "completed" && !subTask.completedAt) {
      subTask.completedAt = new Date();
      if (completedBy) subTask.completedBy = completedBy;
      justCompleted = true;
    }

    if (task.completedQuantity >= task.targetQuantity) {
      task.completedQuantity = task.targetQuantity;
      task.status = "completed";
    } else if (task.completedQuantity > 0) {
      task.status = "inprogress";
    }

    await task.save();

    if (task.status === "completed") {
      const empId =
        task.employeeId ||
        (await User.findOne({ email: task.assignedTo }))?._id;
      if (empId) {
        await recalculateTargetProgress(empId, task.type, task.department);
      }
    }

    if (subTask.assignedToInternId) {
      await recalculateTargetProgress(
        subTask.assignedToInternId,
        task.type,
        task.department,
      );
    }

    // Notifications (wrapped in try/catch to avoid breaking the subtask update if a notification fails)
    try {
      const intern = await User.findById(subTask.assignedToInternId);
      const parentEmployeeId =
        task.employeeId ||
        (await User.findOne({ email: task.assignedTo }))?._id;
      const company = task.companyId
        ? await Company.findOne({ id: task.companyId })
        : null;
      const notificationCompanyId = company?._id;

      if (quantityAdded && parentEmployeeId) {
        await Notification.create({
          title: "Intern Progress",
          message: `${intern?.name || "An intern"} updated progress on ${task.title} (+${quantityAdded}).`,
          category: "task",
          severity: "info",
          userId: parentEmployeeId,
          ...(notificationCompanyId
            ? { companyId: notificationCompanyId }
            : {}),
        });
      }

      if (justCompleted) {
        if (parentEmployeeId) {
          await Notification.create({
            title: "Subtask Completed",
            message: `${intern?.name || "An intern"} completed their portion of ${task.title}.`,
            category: "task",
            severity: "success",
            userId: parentEmployeeId,
            ...(notificationCompanyId
              ? { companyId: notificationCompanyId }
              : {}),
          });
        }

        const managers = await User.find({ role: "manager" });
        if (managers.length > 0) {
          const managerNotifications = managers.map((m) => ({
            title: "Subtask Completed",
            message: `${intern?.name || "An intern"} completed their portion of ${task.title}.`,
            category: "task",
            severity: "success",
            userId: m._id,
            ...(notificationCompanyId
              ? { companyId: notificationCompanyId }
              : {}),
          }));
          await Notification.insertMany(managerNotifications);
        }
      }
    } catch (notifErr) {
      console.error("Error creating subtask update notifications:", notifErr);
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error("Error updating subtask:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

// @desc    Reassign a sub-task
// @route   POST /api/tasks/:id/reassign-subtask
// @access  Public
export const reassignSubTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { subTaskId, newInternId } = req.body;

    const task = await Task.findById(id);
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });

    const subTask = task.subTasks.id(subTaskId);
    if (!subTask)
      return res
        .status(404)
        .json({ success: false, message: "SubTask not found" });

    const oldInternId = subTask.assignedToInternId;
    subTask.assignedToInternId = newInternId;
    await task.save();

    // Notifications
    try {
      const newIntern = await User.findById(newInternId);
      const oldIntern = await User.findById(oldInternId);
      const parentEmployeeId =
        task.employeeId ||
        (await User.findOne({ email: task.assignedTo }))?._id;
      const company = task.companyId
        ? await Company.findOne({ id: task.companyId })
        : null;
      const notificationCompanyId = company?._id;

      if (oldInternId) {
        await Notification.create({
          title: "Task Reassigned",
          message: `Your subtask for ${task.title} has been reassigned to another intern.`,
          category: "task",
          severity: "warning",
          userId: oldInternId,
          ...(notificationCompanyId
            ? { companyId: notificationCompanyId }
            : {}),
        });
      }

      if (newInternId) {
        await Notification.create({
          title: "New Subtask Assigned",
          message: `You've been assigned a subtask for ${task.title}.`,
          category: "task",
          severity: "info",
          userId: newInternId,
          ...(notificationCompanyId
            ? { companyId: notificationCompanyId }
            : {}),
        });
      }

      if (parentEmployeeId) {
        await Notification.create({
          title: "Subtask Reassigned",
          message: `${task.title} subtask reassigned from ${oldIntern?.name || "intern"} to ${newIntern?.name || "intern"}.`,
          category: "task",
          severity: "info",
          userId: parentEmployeeId,
          ...(notificationCompanyId
            ? { companyId: notificationCompanyId }
            : {}),
        });
      }
    } catch (notifErr) {
      console.error("Error creating reassign notifications:", notifErr);
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error("Error reassigning subtask:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
