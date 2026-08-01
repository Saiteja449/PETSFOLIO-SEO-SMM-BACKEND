import TargetTemplate from "../models/TargetTemplate.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import TrackedVideo from "../models/TrackedVideo.js";
import SeoActivityTemplate from "../models/SeoActivityTemplate.js";
import User from "../models/User.js";
import SmmTask from "../models/SmmTask.js";
import SeoTask from "../models/SeoTask.js";
import ContentActivityTemplate from "../models/ContentActivityTemplate.js";
import SalesActivityTemplate from "../models/SalesActivityTemplate.js";
import CreativeActivityTemplate from "../models/CreativeActivityTemplate.js";
import ContentTask from "../models/ContentTask.js";
import SalesTask from "../models/SalesTask.js";
import CreativeTask from "../models/CreativeTask.js";
import Holiday from "../models/Holiday.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS for task generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Number of weekdays used for dividing the weekly target (Monday–Friday).
 * Saturday is a working day but gets its allocation separately (= base rate).
 */
const DIVISION_DAYS = 5;

/**
 * Total working days per week including Saturday (Mon–Sat).
 * Only the 2nd Saturday of each month is off.
 */
const TOTAL_WEEKDAYS = 6;

/**
 * Check if a given date is the 2nd Saturday of its month.
 * The 2nd Saturday falls between the 8th and 14th (inclusive).
 */
const isSecondSaturday = (d) => {
  if (d.getDay() !== 6) return false;
  const dateNum = d.getDate();
  return dateNum >= 8 && dateNum <= 14;
};

/**
 * Build a Set of holiday date strings (YYYY-MM-DD) for O(1) lookup.
 * This avoids scanning the holidays array for every single day check.
 */
const buildHolidaySet = (holidays) => {
  const set = new Set();
  for (const h of holidays) {
    set.add(h.date.toISOString().split("T")[0]);
  }
  return set;
};

/**
 * Determine if a date is a working day.
 * Skips: Sundays, 2nd Saturdays, and holidays.
 * All other Saturdays (1st, 3rd, 4th, 5th) are treated as working days.
 */
const isWorkingDay = (d, holidaySet) => {
  if (d.getDay() === 0) return false; // Sunday
  if (isSecondSaturday(d)) return false; // 2nd Saturday
  if (holidaySet.has(d.toISOString().split("T")[0])) return false; // Holiday
  return true;
};

/**
 * Get all working days in the current month, in order.
 * Returns an array of Date objects.
 */
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

/**
 * Get the ISO week number for a date.
 * Uses the standard ISO 8601 algorithm:
 * - Week 1 is the week containing the first Thursday of the year.
 * - Weeks start on Monday.
 */
const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Monday=1, Sunday=7)
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};

/**
 * Expand a daily target count into task entries for a single date.
 *
 * Rule:
 *   - If dailyTarget <= 5 → create `dailyTarget` individual tasks, each with targetQuantity=1
 *   - If dailyTarget > 5  → create 1 task with targetQuantity=dailyTarget
 */
const expandDailyTarget = (date, dailyTarget) => {
  const entries = [];
  if (dailyTarget <= 5 && dailyTarget > 0) {
    for (let k = 0; k < dailyTarget; k++) {
      entries.push({
        date: new Date(date),
        targetQuantity: 1,
        taskNumber: k + 1,
        totalTasks: dailyTarget,
      });
    }
  } else if (dailyTarget > 5) {
    entries.push({ date: new Date(date), targetQuantity: dailyTarget });
  }
  return entries;
};

/**
 * Generate task date entries for DAILY frequency.
 *
 * Daily target = per working day.
 * For each working day in the month, create task(s) with the full daily target.
 * Holidays simply produce no tasks — no redistribution.
 */
const generateDailyTasks = (targetGoal, workingDays) => {
  const entries = [];
  for (const d of workingDays) {
    entries.push(...expandDailyTarget(d, targetGoal));
  }
  return entries;
};

/**
 * Generate task date entries for WEEKLY frequency.
 *
 * Weekly target = for every calendar week (Mon–Sat), NOT per month.
 *
 * Algorithm:
 *   1. Divide the weekly target by 5 (Mon–Fri) to get the per-day rate.
 *   2. Distribute remainder to earlier days (Mon gets extra first, then Tue, etc.).
 *   3. Saturday gets the base rate (floor value), same as a regular weekday.
 *   4. For each calendar week that overlaps the current month:
 *      - For each day Mon–Sat, if the day is in the current month AND
 *        is a working day, create task(s) with the assigned per-day target.
 *      - If the day is a holiday or 2nd-Saturday, skip it entirely.
 *        DO NOT redistribute the skipped target.
 *
 * Example: Weekly=5  → Mon=1, Tue=1, Wed=1, Thu=1, Fri=1, Sat=1
 * Example: Weekly=12 → Mon=3, Tue=3, Wed=2, Thu=2, Fri=2, Sat=2
 * Example: Weekly=100→ Mon=20,Tue=20,Wed=20,Thu=20,Fri=20, Sat=20
 *          If Wednesday is a holiday → Mon=20,Tue=20,Skip,Thu=20,Fri=20,Sat=20
 */
const generateWeeklyTasks = (targetGoal, year, month, holidaySet) => {
  const entries = [];

  // Step 1: Divide weekly target by 5 (Mon–Fri) to get per-day rate
  const base = Math.floor(targetGoal / DIVISION_DAYS);
  const remainder = targetGoal % DIVISION_DAYS;

  // Step 2: Build per-weekday distribution for Mon–Fri (indices 0–4)
  // Remainder is front-loaded: Mon gets extra first, then Tue, etc.
  const perWeekday = [];
  for (let i = 0; i < DIVISION_DAYS; i++) {
    perWeekday.push(base + (i < remainder ? 1 : 0));
  }
  // Saturday (index 5) gets the base rate — same workload as a regular day
  perWeekday.push(base || (targetGoal > 0 ? 1 : 0));

  // Step 3: Find the Monday of the week containing the 1st of the month
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  let cursor = new Date(startOfMonth);
  const dayOfWeek = cursor.getDay() || 7; // Convert Sun=0 to 7 for ISO
  cursor.setDate(cursor.getDate() - dayOfWeek + 1); // Go back to Monday

  // Step 4: Iterate week by week
  while (cursor <= endOfMonth) {
    // For each day Mon(0) through Sat(5)
    for (let i = 0; i < TOTAL_WEEKDAYS; i++) {
      const d = new Date(cursor);
      d.setDate(d.getDate() + i); // Mon+0, Tue+1, Wed+2, Thu+3, Fri+4, Sat+5

      // Only create tasks for days within the current month
      if (d.getMonth() !== month || d.getFullYear() !== year) continue;

      // Skip non-working days (holidays, 2nd Saturdays)
      if (!isWorkingDay(d, holidaySet)) continue;

      const dailyTarget = perWeekday[i];
      if (dailyTarget > 0) {
        entries.push(...expandDailyTarget(d, dailyTarget));
      }
    }

    // Move to next Monday
    cursor.setDate(cursor.getDate() + 7);
  }

  return entries;
};

/**
 * Generate task date entries for MONTHLY frequency.
 *
 * Monthly target = for the entire month.
 *
 * Algorithm:
 *   1. Find all working days in the month.
 *   2. If targetGoal >= workingDays:
 *      - Distribute evenly: base = floor(target / workingDays), remainder front-loaded.
 *      - Example: 100 target, 22 days → first 12 days get 5, remaining 10 get 4 (total=100).
 *   3. If targetGoal < workingDays:
 *      - Pick `targetGoal` evenly spaced working days.
 *      - Each selected day gets 1 task with targetQuantity=1.
 *      - Example: 15 target, 22 days → place 1 task on 15 evenly spread working days.
 *   4. Apply <=5 rule on the per-day count for individual vs. bundled tasks.
 *   5. No redistribution for holidays — they already reduced the working days count.
 */
const generateMonthlyTasks = (targetGoal, workingDays) => {
  const entries = [];
  const W = workingDays.length;
  if (W === 0) return entries;

  if (targetGoal >= W) {
    // Distribute target across all working days
    const base = Math.floor(targetGoal / W);
    const remainder = targetGoal % W;

    for (let i = 0; i < W; i++) {
      const dailyTarget = base + (i < remainder ? 1 : 0);
      entries.push(...expandDailyTarget(workingDays[i], dailyTarget));
    }
  } else {
    // Fewer tasks than working days — spread evenly
    // Use even spacing: pick indices at regular intervals
    const step = W / targetGoal;
    for (let i = 0; i < targetGoal; i++) {
      const index = Math.floor(i * step);
      entries.push({ date: new Date(workingDays[index]), targetQuantity: 1 });
    }
  }

  return entries;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION: generateBatchTasks
// ─────────────────────────────────────────────────────────────────────────────

const generateBatchTasks = async (employeeId, companyId, assignments, type) => {
  try {
    const user = await User.findById(employeeId);
    if (!user) return;

    // Clear previously automated tasks for these templates
    if (type === "SMM") {
      await SmmTask.deleteMany({
        employeeId,
        companyId,
        isAutomated: true,
        status: "notstarted",
      });
    } else if (type === "SEO") {
      await SeoTask.deleteMany({
        companyId,
        assignedTo: user.email,
        isAutomated: true,
        status: "notstarted",
      });
    } else if (type === "Content") {
      await ContentTask.deleteMany({
        companyId,
        assignedTo: user.email,
        isAutomated: true,
        status: "notstarted",
      });
    } else if (type === "Sales") {
      await SalesTask.deleteMany({
        companyId,
        assignedTo: user.email,
        isAutomated: true,
        status: "notstarted",
      });
    } else if (type === "Creative") {
      await CreativeTask.deleteMany({
        companyId,
        assignedTo: user.email,
        isAutomated: true,
        status: "notstarted",
      });
    }

    const tasksToInsert = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Fetch holidays ONCE for the entire batch — avoid repeated DB queries
    const allHolidays = await Holiday.find({});
    const holidaySet = buildHolidaySet(allHolidays);

    // Pre-compute working days for the current month (used by Daily and Monthly)
    const workingDays = getWorkingDaysInMonth(
      currentYear,
      currentMonth,
      holidaySet,
    );

    for (const a of assignments) {
      if (!a.frequency) continue;
      const targetGoal = parseInt(a.targetGoal) || 1;

      // ─── Generate date entries based on frequency ───
      let dateEntries = [];

      if (a.frequency === "Daily") {
        // Daily: target is per working day
        dateEntries = generateDailyTasks(targetGoal, workingDays);
      } else if (a.frequency === "Weekly") {
        // Weekly: target is per week, divided across Mon–Fri (standard 5-day week)
        dateEntries = generateWeeklyTasks(
          targetGoal,
          currentYear,
          currentMonth,
          holidaySet,
        );
      } else if (a.frequency === "Monthly") {
        // Monthly: target is for the entire month
        dateEntries = generateMonthlyTasks(targetGoal, workingDays);
      }

      // ─── Resolve template name for task title/type ───
      let templateName = "Task";
      let templateType = "Post";
      if (type === "SMM") {
        const template = await TargetTemplate.findById(a.templateId);
        templateName = template?.name || "SMM Task";
        templateType = template?.name || "Reel Post";
      } else if (type === "SEO") {
        const template = await SeoActivityTemplate.findById(a.seoTemplateId);
        templateName = template?.activityName || "SEO Task";
        templateType = template?.activityName || "Blog Post";
      } else if (type === "Content") {
        const template = await ContentActivityTemplate.findById(
          a.contentTemplateId,
        );
        templateName = template?.activityName || "Content Task";
        templateType = template?.activityName || "Content Task";
      } else if (type === "Sales") {
        const template = await SalesActivityTemplate.findById(
          a.salesTemplateId,
        );
        templateName = template?.activityName || "Sales Task";
        templateType = template?.activityName || "Sales Task";
      } else if (type === "Creative") {
        const template = await CreativeActivityTemplate.findById(
          a.creativeTemplateId,
        );
        templateName = template?.activityName || "Creative Task";
        templateType = template?.activityName || "Creative Task";
      }

      // ─── Build task objects from date entries ───
      for (const entry of dateEntries) {
        const d = entry.date;
        const qty = entry.targetQuantity;
        const weekLabel = `Week ${getWeekNumber(d)}`;

        let title = `${a.frequency} Target: ${templateName}`;
        if (qty > 1) {
          title += ` (Goal: ${qty})`;
        } else if (entry.totalTasks > 1 && entry.taskNumber) {
          title += ` - Task (${entry.taskNumber})`;
        }

        if (type === "SMM") {
          tasksToInsert.push({
            title,
            type: templateType,
            platform: a.platform || "Both",
            status: "notstarted",
            employeeId,
            companyId,
            weekLabel,
            date: d.toISOString().split("T")[0],
            dueDate: d,
            targetQuantity: qty,
            isAutomated: true,
          });
        } else {
          tasksToInsert.push({
            title,
            type: templateType,
            status: "notstarted",
            assignedTo: user.email,
            employeeId,
            companyId,
            weekLabel,
            date: d.toISOString().split("T")[0],
            dueDate: d,
            targetQuantity: qty,
            isAutomated: true,
          });
        }
      }
    }

    // ─── Bulk insert all generated tasks ───
    if (tasksToInsert.length > 0) {
      if (type === "SMM") await SmmTask.insertMany(tasksToInsert);
      else if (type === "SEO") await SeoTask.insertMany(tasksToInsert);
      else if (type === "Content") await ContentTask.insertMany(tasksToInsert);
      else if (type === "Sales") await SalesTask.insertMany(tasksToInsert);
      else if (type === "Creative")
        await CreativeTask.insertMany(tasksToInsert);
    }
  } catch (err) {
    console.error("Error generating tasks:", err);
  }
};

export const createTargetTemplate = async (req, res) => {
  try {
    const { companyId, name, description, metric, defaultGoalValue, isFixed } =
      req.body;
    const template = await TargetTemplate.create({
      companyId: companyId || undefined,
      name,
      description,
      metric,
      defaultGoalValue,
      isFixed,
    });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTargetTemplates = async (req, res) => {
  try {
    const templates = await TargetTemplate.find({
      companyId: req.params.companyId,
    });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGlobalTargetTemplates = async (req, res) => {
  try {
    const templates = await TargetTemplate.find({
      companyId: { $exists: false },
    });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTargetTemplate = async (req, res) => {
  try {
    await TargetTemplate.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Template deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTargetTemplate = async (req, res) => {
  try {
    const { name, description, metric, defaultGoalValue, isFixed } = req.body;
    const template = await TargetTemplate.findByIdAndUpdate(
      req.params.id,
      { name, description, metric, defaultGoalValue, isFixed },
      { new: true },
    );
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignTarget = async (req, res) => {
  try {
    const {
      employeeId,
      managerId,
      templateId,
      customName,
      platform,
      metric,
      monthlyTarget,
      weeklyTarget,
      startDate,
      endDate,
    } = req.body;

    const target = await EmployeeTarget.create({
      employeeId,
      managerId,
      templateId,
      customName,
      platform,
      metric,
      monthlyTarget,
      weeklyTarget,
      startDate: startDate || new Date(),
      endDate:
        endDate ||
        new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    });

    res.status(201).json({ success: true, data: target });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;

    await EmployeeTarget.deleteMany({
      employeeId,
      companyId,
      templateId: { $exists: true },
    });

    const newTargets = assignments.map((a) => {
      let weeklyTarget = 0;
      let monthlyTarget = 0;

      const goal = parseInt(a.targetGoal) || 0;
      if (a.frequency === "Daily") {
        weeklyTarget = goal * 5;
        monthlyTarget = goal * 20;
      } else if (a.frequency === "Weekly") {
        weeklyTarget = goal;
        monthlyTarget = goal * 4;
      } else if (a.frequency === "Monthly") {
        weeklyTarget = Math.max(1, Math.round(goal / 4));
        monthlyTarget = goal;
      }

      return {
        employeeId,
        managerId,
        companyId,
        templateId: a.templateId,
        seoTemplateId: a.seoTemplateId,
        contentTemplateId: a.contentTemplateId,
        salesTemplateId: a.salesTemplateId,
        creativeTemplateId: a.creativeTemplateId,
        platform: a.platform,
        metric: a.metric || "PostCount",
        frequency: a.frequency,
        targetGoal: a.targetGoal,
        weeklyTarget,
        monthlyTarget,
        expected: a.expected,
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      };
    });

    if (newTargets.length > 0) {
      await EmployeeTarget.insertMany(newTargets);
      await generateBatchTasks(employeeId, companyId, assignments, "SMM");
    }

    res.status(201).json({ success: true, message: "Batch assignments saved" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignSeoBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;

    await EmployeeTarget.deleteMany({
      employeeId,
      companyId,
      seoTemplateId: { $exists: true },
    });

    const newTargets = assignments.map((a) => {
      let weeklyTarget = 0;
      let monthlyTarget = 0;
      const goal = parseInt(a.targetGoal) || 0;
      if (a.frequency === "Daily") {
        weeklyTarget = goal * 5;
        monthlyTarget = goal * 20;
      } else if (a.frequency === "Weekly") {
        weeklyTarget = goal;
        monthlyTarget = goal * 4;
      } else if (a.frequency === "Monthly") {
        weeklyTarget = Math.max(1, Math.round(goal / 4));
        monthlyTarget = goal;
      }
      return {
        employeeId,
        managerId,
        companyId,
        seoTemplateId: a.seoTemplateId,
        targetType: "SEO",
        frequency: a.frequency,
        targetGoal: a.targetGoal,
        weeklyTarget,
        monthlyTarget,
        expected: a.expected,
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      };
    });

    if (newTargets.length > 0) {
      await EmployeeTarget.insertMany(newTargets);
      await generateBatchTasks(employeeId, companyId, assignments, "SEO");
    }

    res
      .status(201)
      .json({ success: true, message: "SEO Batch assignments saved" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeTargets = async (req, res) => {
  try {
    const query = { employeeId: req.params.employeeId };
    if (req.query.companyId) {
      query.companyId = req.query.companyId;
    }
    const targets = await EmployeeTarget.find(query)
      .populate("templateId")
      .populate("seoTemplateId")
      .populate("contentTemplateId")
      .populate("salesTemplateId")
      .populate("creativeTemplateId");
    res.status(200).json({ success: true, data: targets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanyEmployeeTargets = async (req, res) => {
  try {
    const targets = await EmployeeTarget.find()
      .populate("templateId")
      .populate("seoTemplateId")
      .populate("contentTemplateId")
      .populate("salesTemplateId")
      .populate("creativeTemplateId");
    const companyTargets = targets.filter((t) => {
      if (req.params.companyId === "all") return true;
      return t.companyId === req.params.companyId || !t.companyId;
    });
    res.status(200).json({ success: true, data: companyTargets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTrackedVideos = async (req, res) => {
  try {
    const videos = await TrackedVideo.find({ companyId: req.params.companyId })
      .sort({ publishedAt: -1 })
      .limit(50);
    res.status(200).json({ success: true, data: videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const claimVideo = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const video = await TrackedVideo.findByIdAndUpdate(
      req.params.videoId,
      { employeeId, isClaimed: true },
      { new: true },
    );

    res.status(200).json({ success: true, data: video });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSeoActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await SeoActivityTemplate.create({
      activityName,
      category,
      description,
      isFixed,
    });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSeoActivityTemplates = async (req, res) => {
  try {
    const templates = await SeoActivityTemplate.find();
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSeoActivityTemplate = async (req, res) => {
  try {
    await SeoActivityTemplate.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Template deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSeoActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await SeoActivityTemplate.findByIdAndUpdate(
      req.params.id,
      { activityName, category, description, isFixed },
      { new: true },
    );
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Content Creation Templates
export const createContentActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await ContentActivityTemplate.create({
      activityName,
      category,
      description,
      isFixed,
    });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getContentActivityTemplates = async (req, res) => {
  try {
    const templates = await ContentActivityTemplate.find();
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const deleteContentActivityTemplate = async (req, res) => {
  try {
    await ContentActivityTemplate.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Template deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const updateContentActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await ContentActivityTemplate.findByIdAndUpdate(
      req.params.id,
      { activityName, category, description, isFixed },
      { new: true },
    );
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const assignContentBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;
    await EmployeeTarget.deleteMany({
      employeeId,
      companyId,
      targetType: "Content",
    });
    const bulkOps = assignments.map((a) => {
      let weeklyTarget = 0;
      let monthlyTarget = 0;
      const goal = parseInt(a.targetGoal) || 0;
      if (a.frequency === "Daily") {
        weeklyTarget = goal * 5;
        monthlyTarget = goal * 20;
      } else if (a.frequency === "Weekly") {
        weeklyTarget = goal;
        monthlyTarget = goal * 4;
      } else if (a.frequency === "Monthly") {
        weeklyTarget = Math.max(1, Math.round(goal / 4));
        monthlyTarget = goal;
      }
      return {
        insertOne: {
          document: {
            employeeId,
            managerId,
            companyId,
            contentTemplateId: a.contentTemplateId,
            targetType: "Content",
            frequency: a.frequency,
            targetGoal: a.targetGoal,
            weeklyTarget,
            monthlyTarget,
            expected: a.expected,
            startDate: new Date(),
            endDate: new Date(
              new Date().setFullYear(new Date().getFullYear() + 1),
            ),
          },
        },
      };
    });
    if (bulkOps.length > 0) {
      await EmployeeTarget.bulkWrite(bulkOps);
      await generateBatchTasks(employeeId, companyId, assignments, "Content");
    }
    res
      .status(200)
      .json({ success: true, message: "Content batch targets assigned" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sales Outreach Templates
export const createSalesActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await SalesActivityTemplate.create({
      activityName,
      category,
      description,
      isFixed,
    });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getSalesActivityTemplates = async (req, res) => {
  try {
    const templates = await SalesActivityTemplate.find();
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const deleteSalesActivityTemplate = async (req, res) => {
  try {
    await SalesActivityTemplate.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Template deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const updateSalesActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await SalesActivityTemplate.findByIdAndUpdate(
      req.params.id,
      { activityName, category, description, isFixed },
      { new: true },
    );
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const assignSalesBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;
    await EmployeeTarget.deleteMany({
      employeeId,
      companyId,
      targetType: "Sales",
    });
    const bulkOps = assignments.map((a) => {
      let weeklyTarget = 0;
      let monthlyTarget = 0;
      const goal = parseInt(a.targetGoal) || 0;
      if (a.frequency === "Daily") {
        weeklyTarget = goal * 5;
        monthlyTarget = goal * 20;
      } else if (a.frequency === "Weekly") {
        weeklyTarget = goal;
        monthlyTarget = goal * 4;
      } else if (a.frequency === "Monthly") {
        weeklyTarget = Math.max(1, Math.round(goal / 4));
        monthlyTarget = goal;
      }
      return {
        insertOne: {
          document: {
            employeeId,
            managerId,
            companyId,
            salesTemplateId: a.salesTemplateId,
            targetType: "Sales",
            frequency: a.frequency,
            targetGoal: a.targetGoal,
            weeklyTarget,
            monthlyTarget,
            expected: a.expected,
            startDate: new Date(),
            endDate: new Date(
              new Date().setFullYear(new Date().getFullYear() + 1),
            ),
          },
        },
      };
    });
    if (bulkOps.length > 0) {
      await EmployeeTarget.bulkWrite(bulkOps);
      await generateBatchTasks(employeeId, companyId, assignments, "Sales");
    }
    res
      .status(200)
      .json({ success: true, message: "Sales batch targets assigned" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Creative Production Templates
export const createCreativeActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await CreativeActivityTemplate.create({
      activityName,
      category,
      description,
      isFixed,
    });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getCreativeActivityTemplates = async (req, res) => {
  try {
    const templates = await CreativeActivityTemplate.find();
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const deleteCreativeActivityTemplate = async (req, res) => {
  try {
    await CreativeActivityTemplate.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Template deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const updateCreativeActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await CreativeActivityTemplate.findByIdAndUpdate(
      req.params.id,
      { activityName, category, description, isFixed },
      { new: true },
    );
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const assignCreativeBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;
    await EmployeeTarget.deleteMany({
      employeeId,
      companyId,
      targetType: "Creative",
    });
    const bulkOps = assignments.map((a) => {
      let weeklyTarget = 0;
      let monthlyTarget = 0;
      const goal = parseInt(a.targetGoal) || 0;
      if (a.frequency === "Daily") {
        weeklyTarget = goal * 5;
        monthlyTarget = goal * 20;
      } else if (a.frequency === "Weekly") {
        weeklyTarget = goal;
        monthlyTarget = goal * 4;
      } else if (a.frequency === "Monthly") {
        weeklyTarget = Math.max(1, Math.round(goal / 4));
        monthlyTarget = goal;
      }
      return {
        insertOne: {
          document: {
            employeeId,
            managerId,
            companyId,
            creativeTemplateId: a.creativeTemplateId,
            targetType: "Creative",
            frequency: a.frequency,
            targetGoal: a.targetGoal,
            weeklyTarget,
            monthlyTarget,
            expected: a.expected,
            startDate: new Date(),
            endDate: new Date(
              new Date().setFullYear(new Date().getFullYear() + 1),
            ),
          },
        },
      };
    });
    if (bulkOps.length > 0) {
      await EmployeeTarget.bulkWrite(bulkOps);
      await generateBatchTasks(employeeId, companyId, assignments, "Creative");
    }
    res
      .status(200)
      .json({ success: true, message: "Creative batch targets assigned" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
