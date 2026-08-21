import TaskTemplate from "../models/TaskTemplate.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import TrackedVideo from "../models/TrackedVideo.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import Holiday from "../models/Holiday.js";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HELPER FUNCTIONS for task generation
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const isSecondSaturday = (d) => {
  if (d.getDay() !== 6) return false;
  const dateNum = d.getDate();
  return dateNum >= 8 && dateNum <= 14;
};

const buildHolidaySet = (holidays) => {
  const set = new Set();
  for (const h of holidays) {
    set.add(h.date.toISOString().split("T")[0]);
  }
  return set;
};

const isWorkingDay = (d, holidaySet) => {
  if (d.getDay() === 0) return false; // Sunday
  if (isSecondSaturday(d)) return false; // 2nd Saturday
  if (holidaySet && holidaySet.has(d.toISOString().split("T")[0])) return false; // Holiday
  return true;
};

const getWorkingDaysInMonth = (year, month, holidaySet) => {
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const totalDays = endOfMonth.getDate();
  const workingDays = [];

  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    if (isWorkingDay(d, holidaySet)) {
      workingDays.push(d);
    }
  }
  return workingDays;
};

const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};

const expandDailyTarget = (date, dailyTarget) => {
  return dailyTarget > 0 ? [{ date: new Date(date), targetQuantity: dailyTarget }] : [];
};

const generateDailyTasks = (targetGoal, placementWorkingDays) => {
  return placementWorkingDays.map(date => ({
    date,
    startDate: date,
    targetQuantity: targetGoal
  }));
};

const generateWeeklyTasks = (targetGoal, placementWorkingDays) => {
  if (placementWorkingDays.length === 0) return [];
  
  const totalDays = placementWorkingDays.length;
  // Calculate exact required mathematical target for this placement window
  const exactTarget = Math.round((targetGoal * totalDays) / 6);
  if (exactTarget === 0) return [];

  // Group days by week number
  const weeks = {};
  for (const day of placementWorkingDays) {
    const weekNum = getWeekNumber(day);
    if (!weeks[weekNum]) {
      weeks[weekNum] = [];
    }
    weeks[weekNum].push(day);
  }

  const weekKeys = Object.keys(weeks);
  
  // Calculate proportional targets using the Largest Remainder Method
  let unallocated = exactTarget;
  const weekAllocations = weekKeys.map(weekNum => {
    const daysInWeek = weeks[weekNum];
    const exactShare = (daysInWeek.length / totalDays) * exactTarget;
    const baseShare = Math.floor(exactShare);
    unallocated -= baseShare;
    return {
      weekNum,
      daysInWeek,
      baseShare,
      remainder: exactShare - baseShare
    };
  });

  // Sort by highest remainder to distribute the unallocated targets
  weekAllocations.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < unallocated; i++) {
    weekAllocations[i % weekAllocations.length].baseShare += 1;
  }

  // Restore chronological order
  weekAllocations.sort((a, b) => a.daysInWeek[0] - b.daysInWeek[0]);

  const entries = [];
  weekAllocations.forEach((allocation) => {
    const { daysInWeek, baseShare } = allocation;
    daysInWeek.sort((a, b) => a - b);
    
    if (baseShare > 0) {
      entries.push({
        date: daysInWeek[daysInWeek.length - 1], // due on the last working day of this week
        startDate: daysInWeek[0],
        targetQuantity: baseShare
      });
    }
  });
  
  return entries;
};

const generateMonthlyTasks = (targetGoal, placementWorkingDays) => {
  if (placementWorkingDays.length === 0) return [];
  const firstDay = placementWorkingDays[0];
  const lastDay = placementWorkingDays[placementWorkingDays.length - 1];
  return [{
    date: lastDay,
    startDate: firstDay,
    targetQuantity: targetGoal
  }];
};

const getCurrentMonthRange = (referenceDate) => {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getTaskGenerationContext = async (assignment, user, employeeId, companyId) => {
  const template = await TaskTemplate.findById(assignment.templateId);
  const department = template?.department || assignment.targetType || "SMM";
  const templateName = template?.name || `${department} Task`;
  const templateType = template?.name || `${department} Task`;
  const platform = assignment.platform || "Both";

  return {
    model: Task,
    templateName,
    templateType,
    department,
    baseQuery: {
      employeeId,
      companyId,
      isAutomated: true,
      department,
      title: templateName,
      type: templateType,
      ...(department === 'SMM' && { platform })
    },
    buildDocument: (entry) => ({
      title: templateName,
      type: templateType,
      department,
      platform,
      status: "notstarted",
      assignedTo: user.email,
      employeeId,
      companyId,
      weekLabel: `Week ${getWeekNumber(entry.date)}`,
      date: entry.date.toISOString().split("T")[0],
      dueDate: entry.date,
      startDate: entry.startDate,
      frequency: assignment.frequency,
      targetQuantity: entry.targetQuantity,
      dailyExpiry: template?.dailyExpiry || false,
      isAutomated: true,
    }),
  };
};

export const generateBatchTasks = async (employeeId, companyId, assignments) => {
  try {
    const user = await User.findById(employeeId);
    if (!user) return;

    const tasksToInsert = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const { start: monthStart, end: monthEnd } = getCurrentMonthRange(today);

    const allHolidays = await Holiday.find({});
    const holidaySet = buildHolidaySet(allHolidays);

    const placementWorkingDays = getWorkingDaysInMonth(currentYear, currentMonth, holidaySet);
    const futurePlacementDays = placementWorkingDays.filter((day) => day >= today);

    for (const assignment of assignments) {
      if (!assignment.frequency) continue;

      const targetGoal = Number.parseInt(assignment.targetGoal, 10) || 0;
      if (targetGoal <= 0) continue;

      const { model, baseQuery, buildDocument } = await getTaskGenerationContext(assignment, user, employeeId, companyId);

      const existingTasks = await model.find({ ...baseQuery, dueDate: { $gte: monthStart, $lte: monthEnd } }).lean();

      const tasksToKeep = existingTasks.filter((task) => {
        const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isTodayOrLater = taskDueDate ? taskDueDate >= today : false;
        if (!isTodayOrLater) return true;
        return task.status === 'completed' || task.status === 'inprogress';
      });

      const tasksToDelete = existingTasks.filter((task) => {
        const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isTodayOrLater = taskDueDate ? taskDueDate >= today : false;
        return isTodayOrLater && task.status === 'notstarted';
      });

      if (tasksToDelete.length > 0) {
        await model.deleteMany({ _id: { $in: tasksToDelete.map((task) => task._id) } });
      }

      let taskEntries = [];

      if (assignment.frequency === 'Daily') {
        taskEntries = generateDailyTasks(targetGoal, futurePlacementDays);
        // Filter out days that already have an in-progress or completed task
        taskEntries = taskEntries.filter(entry => {
          const dateStr = entry.date.toISOString().split("T")[0];
          return !tasksToKeep.some(t => {
            if (!t.dueDate) return false;
            return new Date(t.dueDate).toISOString().split("T")[0] === dateStr;
          });
        });

      } else if (assignment.frequency === 'Weekly') {
        taskEntries = generateWeeklyTasks(targetGoal, futurePlacementDays);
        // Filter out weeks that already have an in-progress or completed task
        taskEntries = taskEntries.filter(entry => {
          const weekLbl = `Week ${getWeekNumber(entry.date)}`;
          return !tasksToKeep.some(t => t.weekLabel === weekLbl);
        });

      } else if (assignment.frequency === 'Monthly') {
        taskEntries = generateMonthlyTasks(targetGoal, futurePlacementDays);
        // If there's ANY task to keep for this month, don't generate another monthly task
        if (tasksToKeep.length > 0) {
          taskEntries = [];
        }
      }

      const adjustedEntries = taskEntries.filter((e) => e.targetQuantity > 0);

      const newDocs = adjustedEntries.map(buildDocument);
      tasksToInsert.push(...newDocs);
    }

    if (tasksToInsert.length > 0) {
      await Task.insertMany(tasksToInsert);
    }
  } catch (error) {
    console.error("Error in generateBatchTasks:", error);
  }
};


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TEMPLATES (Unified)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const createTargetTemplate = async (req, res) => {
  try {
    const { name, department, category, description, isFixed, companyId, metric, defaultGoalValue, dailyExpiry } = req.body;
    if (!department) return res.status(400).json({ success: false, message: "Department is required." });

    const newTemplate = new TaskTemplate({
      name, department, category, description, isFixed, companyId, metric, defaultGoalValue, dailyExpiry
    });
    await newTemplate.save();
    res.status(201).json({ success: true, data: newTemplate });
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTargetTemplates = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { department } = req.query;
    const query = { companyId: { $in: [companyId, null, undefined] } };
    if (department) query.department = department;

    const templates = await TaskTemplate.find(query);
    res.status(200).json({ success: true, count: templates.length, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getGlobalTargetTemplates = async (req, res) => {
  try {
    const { department } = req.query;
    const query = { isFixed: true };
    if (department) query.department = department;

    const templates = await TaskTemplate.find(query);
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteTargetTemplate = async (req, res) => {
  try {
    const template = await TaskTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });

    const targetExists = await EmployeeTarget.findOne({ templateId: req.params.id });
    if (targetExists) return res.status(400).json({ success: false, message: "Template is linked to existing targets." });

    await TaskTemplate.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateTargetTemplate = async (req, res) => {
  try {
    const template = await TaskTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });

    const updated = await TaskTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ASSIGN TARGETS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const assignTarget = async (req, res) => {
  try {
    const {
      employeeId, managerId, companyId, templateId,
      customName, platform, metric, monthlyTarget, weeklyTarget,
      frequency, targetGoal, expected, startDate, endDate,
    } = req.body;

    const template = await TaskTemplate.findById(templateId);
    const targetType = template?.department || req.body.targetType || 'SMM';

    const newTarget = new EmployeeTarget({
      employeeId, managerId, companyId, templateId, targetType,
      customName, platform, metric, monthlyTarget, weeklyTarget,
      frequency, targetGoal, expected,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    await newTarget.save();

    await generateBatchTasks(employeeId, companyId, [{
      frequency, targetGoal, templateId, targetType, platform, expected
    }]);

    res.status(201).json({ success: true, data: newTarget });
  } catch (error) {
    console.error("Error assigning target:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const assignBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;

    const savedTargets = [];
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const allHolidays = await Holiday.find({});
    const holidaySet = buildHolidaySet(allHolidays);
    const fullMonthWorkingDays = getWorkingDaysInMonth(now.getFullYear(), now.getMonth(), holidaySet);

    for (const assignment of assignments) {
      const template = await TaskTemplate.findById(assignment.templateId);
      const targetType = template?.department || assignment.targetType || 'SMM';
      
      const targetGoal = Number.parseInt(assignment.targetGoal, 10) || 0;
      let calcMonthlyTarget = assignment.monthlyTarget || targetGoal;

      if (assignment.frequency === 'Daily') {
        calcMonthlyTarget = targetGoal * fullMonthWorkingDays.length;
      } else if (assignment.frequency === 'Weekly') {
        calcMonthlyTarget = Math.round((targetGoal * fullMonthWorkingDays.length) / 6);
      } else if (assignment.frequency === 'Monthly') {
        calcMonthlyTarget = targetGoal;
      }

      const targetData = {
        employeeId, managerId, companyId, templateId: assignment.templateId, targetType,
        customName: assignment.customName, platform: assignment.platform,
        metric: assignment.metric, monthlyTarget: calcMonthlyTarget,
        weeklyTarget: assignment.weeklyTarget, frequency: assignment.frequency,
        targetGoal: assignment.targetGoal, expected: assignment.expected,
        startDate: assignment.startDate ? new Date(assignment.startDate) : defaultStartDate,
        endDate: assignment.endDate ? new Date(assignment.endDate) : defaultEndDate,
      };

      const existingTarget = await EmployeeTarget.findOne({
        employeeId, companyId, templateId: assignment.templateId,
        startDate: targetData.startDate, endDate: targetData.endDate,
      });

      if (existingTarget) {
        existingTarget.set(targetData);
        await existingTarget.save();
        savedTargets.push(existingTarget);
      } else {
        const newTarget = new EmployeeTarget(targetData);
        await newTarget.save();
        savedTargets.push(newTarget);
      }
    }

    await generateBatchTasks(employeeId, companyId, assignments);

    res.status(201).json({ success: true, data: savedTargets, message: "Batch targets assigned" });
  } catch (error) {
    console.error("Error assigning batch targets:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getEmployeeTargets = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { targetType, month, year, companyId } = req.query;

    const query = { employeeId };
    if (companyId) {
      query.companyId = companyId;
    }
    if (targetType) {
      query.targetType = targetType;
    }

    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      query.startDate = { $lte: endOfMonth };
      query.endDate = { $gte: startOfMonth };
    }

    const targets = await EmployeeTarget.find(query).populate("templateId");
    res.status(200).json({ success: true, count: targets.length, data: targets });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCompanyEmployeeTargets = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, year, targetType } = req.query;

    const query = { companyId };
    if (targetType) query.targetType = targetType;

    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      query.startDate = { $lte: endOfMonth };
      query.endDate = { $gte: startOfMonth };
    }

    const targets = await EmployeeTarget.find(query)
      .populate("employeeId", "name email")
      .populate("templateId", "name metric defaultGoalValue");

    const groupedTargets = targets.reduce((acc, target) => {
      const empId = target.employeeId._id.toString();
      if (!acc[empId]) {
        acc[empId] = {
          employeeId: target.employeeId._id,
          employeeName: target.employeeId.name,
          employeeEmail: target.employeeId.email,
          targets: [],
        };
      }
      acc[empId].targets.push(target);
      return acc;
    }, {});

    res.status(200).json({ success: true, data: Object.values(groupedTargets) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// SMM Tracked Videos logic remains intact
export const getTrackedVideos = async (req, res) => {
  try {
    const { companyId } = req.params;
    const videos = await TrackedVideo.find({ companyId }).sort({ publishedAt: -1 }).limit(50);
    res.status(200).json({ success: true, count: videos.length, data: videos });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const claimVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { employeeId } = req.body;

    const video = await TrackedVideo.findOne({ videoId });
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });

    if (video.claimedBy) return res.status(400).json({ success: false, message: "Video already claimed" });

    video.claimedBy = employeeId;
    video.claimedAt = new Date();
    await video.save();

    res.status(200).json({ success: true, data: video });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
