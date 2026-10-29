import mongoose from "mongoose";
import TaskTemplate from "../models/TaskTemplate.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import TrackedVideo from "../models/TrackedVideo.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import Holiday from "../models/Holiday.js";
import Notification from "../models/Notification.js";
import Company from "../models/Company.js";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HELPER FUNCTIONS for task generation
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const isSecondSaturday = (d) => {
  if (d.getDay() !== 6) return false;
  const dateNum = d.getDate();
  return dateNum >= 8 && dateNum <= 14;
};

const formatLocalDateStr = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const buildHolidaySet = (holidays) => {
  const set = new Set();
  for (const h of holidays) {
    if (h.date) {
      set.add(formatLocalDateStr(h.date));
    }
  }
  return set;
};

const isWorkingDay = (d, holidaySet) => {
  if (d.getDay() === 0) return false; // Sunday
  if (isSecondSaturday(d)) return false; // 2nd Saturday
  const dateStr = formatLocalDateStr(d);
  if (holidaySet && holidaySet.has(dateStr)) return false; // Holiday
  return true;
};

const getWorkingDaysInMonth = (year, month, holidaySet) => {
  const endOfMonth = new Date(year, month + 1, 0);
  const totalDays = endOfMonth.getDate();
  const workingDays = [];

  for (let i = 1; i <= totalDays; i++) {
    // Setting 12:00:00 (midday) ensures safe timezone handling without any UTC date shift
    const d = new Date(year, month, i, 12, 0, 0);
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
  const actualTemplateId =
    assignment.templateId ||
    assignment.seoTemplateId ||
    assignment.contentTemplateId ||
    assignment.salesTemplateId ||
    assignment.creativeTemplateId;
  const template = actualTemplateId ? await TaskTemplate.findById(actualTemplateId) : null;
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
      date: formatLocalDateStr(entry.date),
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
          const dateStr = formatLocalDateStr(entry.date);
          return !tasksToKeep.some(t => {
            if (!t.dueDate) return false;
            return formatLocalDateStr(t.dueDate) === dateStr;
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

      // Fetch the corresponding EmployeeTarget to get any automated delegations
      const currentTarget = await EmployeeTarget.findOne({
        employeeId,
        companyId,
        templateId: assignment.templateId || assignment._id,
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart }
      });

      const newDocs = adjustedEntries.map((entry) => {
        const doc = buildDocument(entry);
        if (currentTarget && currentTarget.delegations && currentTarget.delegations.length > 0) {
          doc.subTasks = currentTarget.delegations.map(d => ({
            assignedToInternId: d.internId,
            assignedByEmployeeId: employeeId,
            targetQuantity: d.targetQuantity,
            notes: d.notes || '',
            status: 'notstarted'
          }));
        }
        return doc;
      });
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

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    if (employee.isBlocked) {
      return res.status(400).json({ success: false, message: "Cannot assign targets to a deactivated/blocked user." });
    }

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

    const company = await Company.findOne({ id: companyId });
    await Notification.create({
      title: `New Target Assigned`,
      message: `You have been assigned a new ${frequency.toLowerCase()} target for ${template?.name || targetType} with a goal of ${targetGoal}.`,
      category: 'target',
      severity: 'info',
      userId: employeeId,
      companyId: company?._id
    });

    res.status(201).json({ success: true, data: newTarget });
  } catch (error) {
    console.error("Error assigning target:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const assignBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    if (employee.isBlocked) {
      return res.status(400).json({ success: false, message: "Cannot assign targets to a deactivated/blocked user." });
    }

    const savedTargets = [];
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const allHolidays = await Holiday.find({});
    const holidaySet = buildHolidaySet(allHolidays);
    const fullMonthWorkingDays = getWorkingDaysInMonth(now.getFullYear(), now.getMonth(), holidaySet);

    for (const assignment of assignments) {
      const actualTemplateId =
        assignment.templateId ||
        assignment.seoTemplateId ||
        assignment.contentTemplateId ||
        assignment.salesTemplateId ||
        assignment.creativeTemplateId;

      const template = actualTemplateId ? await TaskTemplate.findById(actualTemplateId) : null;
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
        employeeId, managerId, companyId, templateId: actualTemplateId, targetType,
        customName: assignment.customName, platform: assignment.platform,
        metric: assignment.metric, monthlyTarget: calcMonthlyTarget,
        weeklyTarget: assignment.weeklyTarget, frequency: assignment.frequency,
        targetGoal: assignment.targetGoal, expected: assignment.expected,
        startDate: assignment.startDate ? new Date(assignment.startDate) : defaultStartDate,
        endDate: assignment.endDate ? new Date(assignment.endDate) : defaultEndDate,
      };

      const existingTarget = await EmployeeTarget.findOne({
        employeeId, companyId, templateId: actualTemplateId,
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

    const company = await Company.findOne({ id: companyId });
    await Notification.create({
      title: `Targets Updated`,
      message: `${assignments.length} targets have been assigned or updated for you.`,
      category: 'target',
      severity: 'info',
      userId: employeeId,
      companyId: company?._id
    });

    res.status(201).json({ success: true, data: savedTargets, message: "Batch targets assigned" });
  } catch (error) {
    console.error("Error assigning batch targets:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getEmployeeTargets = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { targetType, month, year, companyId, includeLegacy } = req.query;

    const query = {
      $or: [
        { employeeId },
        { "delegations.internId": employeeId }
      ]
    };
    
    const user = await User.findById(employeeId);
    const isIntern = user?.role === 'intern';

    if (includeLegacy !== 'true' && !isIntern) {
      query.isLegacyInternData = { $ne: true };
    }

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
    const { month, year, targetType, includeLegacy } = req.query;

    const query = { companyId };
    if (includeLegacy !== 'true') {
      query.isLegacyInternData = { $ne: true };
    }
    if (targetType) query.targetType = targetType;

    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      query.startDate = { $lte: endOfMonth };
      query.endDate = { $gte: startOfMonth };
    }

    const targets = await EmployeeTarget.find(query)
      .populate("employeeId", "name email")
      .populate("templateId", "name metric defaultGoalValue department");

    const groupedTargets = targets.reduce((acc, target) => {
      if (!target.employeeId) return acc;
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

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATED DELEGATION (Employee splits target to Intern)
// ─────────────────────────────────────────────────────────────────────────────

export const addDelegation = async (req, res) => {
  try {
    const { id } = req.params;
    const { internId, targetQuantity, notes } = req.body;
    
    if (!internId || !targetQuantity) {
      return res.status(400).json({ success: false, message: "Intern ID and target quantity are required." });
    }

    const target = await EmployeeTarget.findById(id).populate('templateId');
    if (!target) return res.status(404).json({ success: false, message: "Target not found" });

    // Ensure only the assigned employee (or admin) can delegate
    if (req.user && req.user.role === 'employee' && target.employeeId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to delegate this target" });
    }

    // Check if intern exists
    const intern = await User.findById(internId);
    if (!intern || intern.role !== 'intern') {
      return res.status(404).json({ success: false, message: "Intern not found" });
    }

    if (intern.isBlocked) {
      return res.status(400).json({ success: false, message: "Cannot delegate tasks to a deactivated/blocked intern." });
    }

    const requestedQty = Number(targetQuantity);
    if (isNaN(requestedQty) || requestedQty <= 0) {
      return res.status(400).json({ success: false, message: "Target quantity must be a positive number." });
    }

    const directGoal = Number(target.targetGoal);
    const freq = (target.frequency || "").toLowerCase();
    let maxTargetGoal = directGoal > 0 ? directGoal : 0;
    if (!maxTargetGoal) {
      if (freq === "daily" && target.monthlyTarget) {
        maxTargetGoal = Math.round(Number(target.monthlyTarget) / 25) || 1;
      } else if (freq === "weekly" && target.weeklyTarget) {
        maxTargetGoal = Number(target.weeklyTarget) || 0;
      } else {
        maxTargetGoal = Number(target.monthlyTarget) || Number(target.targetGoal) || 0;
      }
    }

    if (maxTargetGoal > 0 && requestedQty > maxTargetGoal) {
      return res.status(400).json({
        success: false,
        message: `Target quantity cannot exceed the per-${freq || 'task'} goal of ${maxTargetGoal}.`
      });
    }

    // Add or update delegation rule on the target
    const existingDelegationIndex = target.delegations.findIndex(d => d.internId === internId);
    if (existingDelegationIndex > -1) {
      target.delegations[existingDelegationIndex].targetQuantity = requestedQty;
      target.delegations[existingDelegationIndex].notes = notes;
    } else {
      target.delegations.push({ internId, targetQuantity: requestedQty, notes });
    }
    await target.save();

    // Retroactively inject subtasks into uncompleted tasks for this target's timeframe
    const employee = await User.findById(target.employeeId);
    const empIdStr = target.employeeId?.toString();

    let templateName = target.templateId?.name;
    if (!templateName && target.templateId) {
      const tmpl = await TaskTemplate.findById(target.templateId);
      if (tmpl) templateName = tmpl.name;
    }
    if (!templateName) {
      templateName = target.customName || target.title;
    }

    const department = target.templateId?.department || target.targetType || "SMM";

    const andConditions = [
      {
        $or: [
          { employeeId: empIdStr },
          { employeeId: target.employeeId },
          ...(employee?.email ? [{ assignedTo: employee.email }] : [])
        ]
      },
      { department: new RegExp(`^${department}$`, "i") }
    ];

    if (templateName) {
      andConditions.push({
        $or: [
          { title: new RegExp(templateName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i") },
          { type: new RegExp(templateName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i") }
        ]
      });
    }

    if (target.companyId && target.companyId !== "all") {
      const companyMatches = [
        { companyId: target.companyId },
        { companyId: new RegExp(`^${target.companyId}$`, "i") }
      ];
      try {
        const comp = await Company.findOne({
          $or: [
            { id: target.companyId },
            { id: new RegExp(`^${target.companyId}$`, "i") },
            ...(mongoose.Types.ObjectId.isValid(target.companyId) ? [{ _id: target.companyId }] : [])
          ]
        });
        if (comp) {
          if (comp.id) companyMatches.push({ companyId: comp.id }, { companyId: new RegExp(`^${comp.id}$`, "i") });
          if (comp._id) companyMatches.push({ companyId: comp._id.toString() });
          if (comp.name) companyMatches.push({ companyId: comp.name }, { companyId: new RegExp(`^${comp.name}$`, "i") });
        }
      } catch (e) {
        // ignore
      }
      andConditions.push({ $or: companyMatches });
    }

    if (department.toUpperCase() === 'SMM' && target.platform && target.platform !== 'Both') {
      andConditions.push({ platform: target.platform });
    }

    const todayISTStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const startOfTodayIST = new Date(todayISTStr + 'T00:00:00+05:30');
    // Buffer threshold for past tasks: 12 hours before start of today in IST
    const safePastThreshold = new Date(startOfTodayIST.getTime() - 12 * 60 * 60 * 1000);

    // Clean up any uncompleted subtasks mistakenly attached to past expired daily tasks for this intern
    await Task.updateMany(
      {
        $or: [
          { employeeId: target.employeeId },
          { employeeId: empIdStr },
          ...(employee?.email ? [{ assignedTo: employee.email }] : [])
        ],
        dailyExpiry: true,
        dueDate: { $lt: safePastThreshold },
        "subTasks.assignedToInternId": String(internId),
        "subTasks.status": { $ne: "completed" },
      },
      {
        $pull: {
          subTasks: {
            assignedToInternId: String(internId),
            status: { $ne: "completed" },
          },
        },
      }
    );

    // Only delegate to active tasks:
    // Daily tasks must be due today or in the future; past daily tasks are already expired.
    // Non-expiring rollover tasks (dailyExpiry: false) may start from target.startDate.
    const minActiveDate = target.startDate && new Date(target.startDate) > safePastThreshold
      ? new Date(target.startDate)
      : safePastThreshold;

    andConditions.push({
      $or: [
        { dailyExpiry: true, $or: [{ dueDate: { $gte: minActiveDate } }, { date: todayISTStr }] },
        { dailyExpiry: { $ne: true }, dueDate: { $gte: target.startDate ? new Date(target.startDate) : minActiveDate } }
      ]
    });

    if (target.endDate) {
      andConditions.push({ dueDate: { $lte: target.endDate } });
    }

    const tasksToUpdate = await Task.find({
      $and: andConditions,
      status: { $ne: 'completed' },
    });

    for (const task of tasksToUpdate) {
      // Heal date formatting if needed
      if (task.dueDate) {
        task.date = formatLocalDateStr(task.dueDate);
      }

      const remainingCapacity = Math.max(0, (task.targetQuantity || 0) - (task.completedQuantity || 0));
      const cappedQuantity = Math.min(requestedQty, remainingCapacity);

      const existingSubtask = task.subTasks.find(st => String(st.assignedToInternId) === String(internId));
      if (existingSubtask) {
        existingSubtask.targetQuantity = cappedQuantity;
        existingSubtask.notes = notes || existingSubtask.notes;
      } else {
        task.subTasks.push({
          assignedToInternId: String(internId),
          assignedByEmployeeId: String(target.employeeId),
          targetQuantity: cappedQuantity,
          notes: notes || '',
          status: 'notstarted'
        });
      }
      await task.save();
    }

    // Ensure daily tasks exist for Today and upcoming 7 days in the schedule
    if (!target.frequency || target.frequency === 'Daily') {
      const allHolidays = await Holiday.find({});
      const holidaySet = buildHolidaySet(allHolidays);

      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);
        targetDate.setHours(12, 0, 0, 0);

        if (target.endDate && targetDate > new Date(target.endDate)) continue;
        if (!isWorkingDay(targetDate, holidaySet)) continue;

        const dateStr = formatLocalDateStr(targetDate);
        const alreadyInTasksToUpdate = tasksToUpdate.some(t => {
          const tDate = t.date || (t.dueDate ? formatLocalDateStr(t.dueDate) : null);
          return tDate === dateStr;
        });

        if (alreadyInTasksToUpdate) continue;

        const existingTaskInDb = await Task.findOne({
          $and: [
            {
              $or: [
                { employeeId: empIdStr },
                { employeeId: target.employeeId },
                ...(employee?.email ? [{ assignedTo: employee.email }] : [])
              ]
            },
            {
              $or: [
                { date: dateStr },
                { dueDate: { $gte: new Date(dateStr + "T00:00:00.000Z"), $lte: new Date(dateStr + "T23:59:59.999Z") } }
              ]
            },
            {
              $or: [
                { title: new RegExp(`^${templateName.trim()}$`, "i") },
                { type: new RegExp(`^${templateName.trim()}$`, "i") }
              ]
            },
            ...(target.companyId && target.companyId !== "all" ? [{ companyId: target.companyId }] : [])
          ]
        });

        if (existingTaskInDb) {
          if (existingTaskInDb.status !== 'completed') {
            const remainingCapacity = Math.max(0, (existingTaskInDb.targetQuantity || 0) - (existingTaskInDb.completedQuantity || 0));
            const cappedQuantity = Math.min(requestedQty, remainingCapacity);
            const existingSubtask = existingTaskInDb.subTasks.find(st => String(st.assignedToInternId) === String(internId));
            if (existingSubtask) {
              existingSubtask.targetQuantity = cappedQuantity;
              existingSubtask.notes = notes || existingSubtask.notes;
            } else {
              existingTaskInDb.subTasks.push({
                assignedToInternId: String(internId),
                assignedByEmployeeId: String(target.employeeId),
                targetQuantity: cappedQuantity,
                notes: notes || '',
                status: 'notstarted'
              });
            }
            await existingTaskInDb.save();
          }
        } else {
          const newTask = new Task({
            title: templateName,
            type: templateName,
            department,
            platform: target.platform || "Both",
            status: "notstarted",
            assignedTo: employee?.email || "",
            employeeId: target.employeeId?.toString(),
            companyId: target.companyId || "petsfolio",
            weekLabel: `Week ${getWeekNumber(targetDate)}`,
            date: dateStr,
            dueDate: targetDate,
            startDate: targetDate,
            frequency: "Daily",
            targetQuantity: Number(target.targetGoal) || Number(target.monthlyTarget) || requestedQty || 1,
            dailyExpiry: true,
            isAutomated: true,
            subTasks: [
              {
                assignedToInternId: String(internId),
                assignedByEmployeeId: String(target.employeeId),
                targetQuantity: requestedQty,
                notes: notes || '',
                status: 'notstarted'
              }
            ]
          });
          await newTask.save();
        }
      }
    }

    // Resolve the string companyId (e.g. "ikc") to the Company's ObjectId
    let companyObjectId = null;
    if (target.companyId) {
      const company = await Company.findOne({ id: target.companyId });
      if (company) companyObjectId = company._id;
    }
    
    // Notify Intern
    const internNotif = {
      title: 'New Delegation',
      message: `${employee?.name || 'An employee'} delegated ${targetQuantity} tasks of ${templateName} to you.`,
      category: 'delegation',
      severity: 'info',
      userId: internId,
    };
    if (companyObjectId) internNotif.companyId = companyObjectId;
    await Notification.create(internNotif);

    // Notify Managers
    const managers = await User.find({ role: 'manager' });
    if (managers.length > 0) {
      const managerNotifications = managers.map(m => {
        const notif = {
          title: 'Delegation Created',
          message: `${employee?.name || 'An employee'} delegated ${targetQuantity} ${templateName} tasks to intern ${intern.name}.`,
          category: 'delegation',
          severity: 'info',
          userId: m._id,
        };
        if (companyObjectId) notif.companyId = companyObjectId;
        return notif;
      });
      await Notification.insertMany(managerNotifications);
    }

    res.status(200).json({ success: true, data: target, message: `Delegated ${targetQuantity} tasks to intern successfully` });
  } catch (error) {
    console.error("Error adding delegation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const removeDelegation = async (req, res) => {
  try {
    const { id, internId } = req.params;
    
    const target = await EmployeeTarget.findById(id).populate('templateId');
    if (!target) return res.status(404).json({ success: false, message: "Target not found" });

    // Ensure only the assigned employee (or admin) can delegate
    if (req.user && req.user.role === 'employee' && target.employeeId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to modify this target" });
    }

    target.delegations = target.delegations.filter(d => d.internId !== internId);
    await target.save();

    // Remove subtasks from uncompleted tasks
    const employee = await User.findById(target.employeeId);
    const empIdStr = target.employeeId?.toString();

    let templateName = target.templateId?.name;
    if (!templateName && target.templateId) {
      const tmpl = await TaskTemplate.findById(target.templateId);
      if (tmpl) templateName = tmpl.name;
    }
    if (!templateName) {
      templateName = target.customName || target.title;
    }

    const department = target.templateId?.department || target.targetType || "SMM";

    const andConditions = [
      {
        $or: [
          { employeeId: empIdStr },
          { employeeId: target.employeeId },
          ...(employee?.email ? [{ assignedTo: employee.email }] : [])
        ]
      },
      { department: new RegExp(`^${department}$`, "i") }
    ];

    if (templateName) {
      andConditions.push({
        $or: [
          { title: new RegExp(templateName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i") },
          { type: new RegExp(templateName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i") }
        ]
      });
    }

    if (target.companyId && target.companyId !== "all") {
      andConditions.push({
        companyId: new RegExp(`^${target.companyId}$`, "i")
      });
    }

    if (department.toUpperCase() === 'SMM' && target.platform && target.platform !== 'Both') {
      andConditions.push({ platform: target.platform });
    }

    if (target.startDate) {
      andConditions.push({ dueDate: { $gte: target.startDate } });
    }
    if (target.endDate) {
      andConditions.push({ dueDate: { $lte: target.endDate } });
    }

    const tasksToUpdate = await Task.find({
      $and: andConditions,
      status: { $ne: 'completed' },
    });

    for (const task of tasksToUpdate) {
      // Only remove unstarted/pending subtasks for this intern; preserve completed subtask work
      task.subTasks = task.subTasks.filter(st => {
        if (st.assignedToInternId !== internId) return true;
        return st.status === 'completed' || (st.completedQuantity > 0);
      });
      
      const totalCompleted = task.subTasks.reduce((acc, st) => acc + (st.completedQuantity || 0), 0);
      task.completedQuantity = Math.max(task.completedQuantity || 0, totalCompleted);
      if (task.completedQuantity >= task.targetQuantity) {
        task.status = 'completed';
      } else if (task.completedQuantity > 0) {
        task.status = 'inprogress';
      }
      await task.save();
    }
    const intern = await User.findById(internId);

    // Resolve the string companyId (e.g. "ikc") to the Company's ObjectId
    let companyObjectId = null;
    if (target.companyId) {
      const company = await Company.findOne({ id: target.companyId });
      if (company) companyObjectId = company._id;
    }
    
    // Notify Intern
    const internNotif = {
      title: 'Delegation Removed',
      message: `Your delegation for ${templateName} has been removed.`,
      category: 'delegation',
      severity: 'warning',
      userId: internId,
    };
    if (companyObjectId) internNotif.companyId = companyObjectId;
    await Notification.create(internNotif);

    // Notify Managers
    const managers = await User.find({ role: 'manager' });
    if (managers.length > 0) {
      const managerNotifications = managers.map(m => {
        const notif = {
          title: 'Delegation Removed',
          message: `${employee?.name || 'An employee'} removed ${intern?.name || 'intern'}'s delegation for ${templateName}.`,
          category: 'delegation',
          severity: 'info',
          userId: m._id,
        };
        if (companyObjectId) notif.companyId = companyObjectId;
        return notif;
      });
      await Notification.insertMany(managerNotifications);
    }

    res.status(200).json({ success: true, data: target, message: "Delegation removed successfully" });
  } catch (error) {
    console.error("Error removing delegation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
