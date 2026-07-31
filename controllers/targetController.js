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

const generateBatchTasks = async (employeeId, companyId, assignments, type) => {
  try {
    const user = await User.findById(employeeId);
    if (!user) return;
    
    // Clear previously automated tasks for these templates
    if (type === "SMM") {
       await SmmTask.deleteMany({ employeeId, companyId, isAutomated: true, status: 'notstarted' });
    } else if (type === "SEO") {
       await SeoTask.deleteMany({ companyId, assignedTo: user.email, isAutomated: true, status: 'notstarted' });
    } else if (type === "Content") {
       await ContentTask.deleteMany({ companyId, assignedTo: user.email, isAutomated: true, status: 'notstarted' });
    } else if (type === "Sales") {
       await SalesTask.deleteMany({ companyId, assignedTo: user.email, isAutomated: true, status: 'notstarted' });
    } else if (type === "Creative") {
       await CreativeTask.deleteMany({ companyId, assignedTo: user.email, isAutomated: true, status: 'notstarted' });
    }
    
    const tasksToInsert = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allHolidays = await Holiday.find({});
    const isWorkingDay = (d) => {
      if (d.getDay() === 0) return false; // Skip Sundays
      if (d.getDay() === 6) {
        const dateNum = d.getDate();
        if (dateNum >= 8 && dateNum <= 14) return false; // Skip 2nd Saturday
      }
      const dString = d.toISOString().split('T')[0];
      for (const h of allHolidays) {
        if (h.date.toISOString().split('T')[0] === dString) return false;
      }
      return true;
    };
    
    for (const a of assignments) {
      if (!a.frequency) continue;
      const targetGoal = parseInt(a.targetGoal) || 1;
      
      let dates = [];
      
      if (a.frequency === "Daily") {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const totalDaysInMonth = endOfMonth.getDate();
        
        for (let i = 0; i < totalDaysInMonth; i++) {
          const d = new Date(startOfMonth);
          d.setDate(d.getDate() + i);
          if (isWorkingDay(d)) {
            if (targetGoal > 5) {
              dates.push({ date: new Date(d), targetQuantity: targetGoal });
            } else {
              for (let k = 0; k < targetGoal; k++) {
                dates.push({ date: new Date(d), targetQuantity: 1 });
              }
            }
          }
        }
      } else if (a.frequency === "Weekly") {
        // Generate tasks for EVERY week in the current month
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        // Find Monday of the week containing the 1st of the month
        let cursor = new Date(startOfMonth);
        const cursorDay = cursor.getDay() || 7; // 1=Mon...7=Sun
        cursor.setDate(cursor.getDate() - cursorDay + 1); // Go back to Monday
        
        while (cursor <= endOfMonth) {
          // Collect working days for this week that fall within the current month
          let weekWorkingDays = [];
          for (let i = 0; i < 7; i++) {
            const d = new Date(cursor);
            d.setDate(d.getDate() + i);
            // Only include days that belong to the current month
            if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
              if (isWorkingDay(d)) weekWorkingDays.push(d);
            }
          }
          
          const W = weekWorkingDays.length;
          if (W > 0) {
            if (targetGoal >= W) {
              const base = Math.floor(targetGoal / W);
              let rem = targetGoal % W;
              for (let i = 0; i < W; i++) {
                const count = base + (i < rem ? 1 : 0);
                const d = weekWorkingDays[i];
                if (count > 5) {
                  dates.push({ date: new Date(d), targetQuantity: count });
                } else {
                  for (let k = 0; k < count; k++) dates.push({ date: new Date(d), targetQuantity: 1 });
                }
              }
            } else {
              const step = W / targetGoal;
              for (let i = 0; i < targetGoal; i++) {
                const offset = Math.floor(i * step);
                const d = weekWorkingDays[offset];
                dates.push({ date: new Date(d), targetQuantity: 1 });
              }
            }
          }
          
          // Move to next Monday
          cursor.setDate(cursor.getDate() + 7);
        }
      } else if (a.frequency === "Monthly") {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const totalDaysInMonth = endOfMonth.getDate();
        
        let workingDays = [];
        for (let i = 0; i < totalDaysInMonth; i++) {
          const d = new Date(startOfMonth);
          d.setDate(d.getDate() + i);
          if (isWorkingDay(d)) workingDays.push(d);
        }
        
        const W = workingDays.length;
        if (W > 0) {
          if (targetGoal >= W) {
            const base = Math.floor(targetGoal / W);
            let rem = targetGoal % W;
            for (let i = 0; i < W; i++) {
               const count = base + (i < rem ? 1 : 0);
               const d = workingDays[i];
               if (count > 5) {
                 dates.push({ date: new Date(d), targetQuantity: count });
               } else {
                 for(let k=0; k<count; k++) dates.push({ date: new Date(d), targetQuantity: 1 });
               }
            }
          } else {
            const step = W / targetGoal;
            for (let i = 0; i < targetGoal; i++) {
              const offset = Math.floor(i * step);
              const d = workingDays[offset];
              dates.push({ date: new Date(d), targetQuantity: 1 });
            }
          }
        }
      }

      let templateName = 'Task';
      let templateType = 'Post';
      if (type === "SMM") {
        const template = await TargetTemplate.findById(a.templateId);
        templateName = template?.name || 'SMM Task';
        templateType = template?.name || 'Reel Post';
      } else if (type === "SEO") {
        const template = await SeoActivityTemplate.findById(a.seoTemplateId);
        templateName = template?.activityName || 'SEO Task';
        templateType = template?.activityName || 'Blog Post';
      } else if (type === "Content") {
        const template = await ContentActivityTemplate.findById(a.contentTemplateId);
        templateName = template?.activityName || 'Content Task';
        templateType = template?.activityName || 'Content Task';
      } else if (type === "Sales") {
        const template = await SalesActivityTemplate.findById(a.salesTemplateId);
        templateName = template?.activityName || 'Sales Task';
        templateType = template?.activityName || 'Sales Task';
      } else if (type === "Creative") {
        const template = await CreativeActivityTemplate.findById(a.creativeTemplateId);
        templateName = template?.activityName || 'Creative Task';
        templateType = template?.activityName || 'Creative Task';
      }
      
      for (const dObj of dates) {
         const d = dObj.date;
         const qty = dObj.targetQuantity;
         if (type === "SMM") {
           tasksToInsert.push({
             title: qty > 1 ? `${a.frequency} Target: ${templateName} (Goal: ${qty})` : `${a.frequency} Target: ${templateName}`,
             type: templateType,
             platform: a.platform || 'Both',
             status: 'notstarted',
             employeeId,
             companyId,
             weekLabel: `Week ${Math.ceil(d.getDate() / 7)}`,
             date: d.toISOString().split('T')[0],
             dueDate: d,
             targetQuantity: qty,
             isAutomated: true,
           });
         } else {
           tasksToInsert.push({
             title: qty > 1 ? `${a.frequency} Target: ${templateName} (Goal: ${qty})` : `${a.frequency} Target: ${templateName}`,
             type: templateType,
             status: 'notstarted',
             assignedTo: user.email,
             employeeId,
             companyId,
             weekLabel: `Week ${Math.ceil(d.getDate() / 7)}`,
             date: d.toISOString().split('T')[0],
             dueDate: d,
             targetQuantity: qty,
             isAutomated: true,
           });
         }
      }
    }
    
    if (tasksToInsert.length > 0) {
      if (type === "SMM") await SmmTask.insertMany(tasksToInsert);
      else if (type === "SEO") await SeoTask.insertMany(tasksToInsert);
      else if (type === "Content") await ContentTask.insertMany(tasksToInsert);
      else if (type === "Sales") await SalesTask.insertMany(tasksToInsert);
      else if (type === "Creative") await CreativeTask.insertMany(tasksToInsert);
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
      { new: true }
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
      endDate: endDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    });

    res.status(201).json({ success: true, data: target });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;
    
    await EmployeeTarget.deleteMany({ employeeId, companyId, templateId: { $exists: true } });

    const newTargets = assignments.map(a => ({
      employeeId,
      managerId,
      companyId,
      templateId: a.templateId,
      platform: a.platform,
      metric: a.metric || "PostCount", // Defaulting metric as templates don't strictly define it right now
      frequency: a.frequency,
      targetGoal: a.targetGoal,
      expected: a.expected,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    }));

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
    
    await EmployeeTarget.deleteMany({ employeeId, companyId, seoTemplateId: { $exists: true } });

    const newTargets = assignments.map(a => ({
      employeeId,
      managerId,
      companyId,
      seoTemplateId: a.seoTemplateId,
      targetType: "SEO",
      frequency: a.frequency,
      targetGoal: a.targetGoal,
      expected: a.expected,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    }));

    if (newTargets.length > 0) {
      await EmployeeTarget.insertMany(newTargets);
      await generateBatchTasks(employeeId, companyId, assignments, "SEO");
    }

    res.status(201).json({ success: true, message: "SEO Batch assignments saved" });
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
      { new: true }
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
    const template = await ContentActivityTemplate.create({ activityName, category, description, isFixed });
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
    const template = await ContentActivityTemplate.findByIdAndUpdate(req.params.id, { activityName, category, description, isFixed }, { new: true });
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const assignContentBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;
    await EmployeeTarget.deleteMany({ employeeId, companyId, targetType: "Content" });
    const bulkOps = assignments.map(a => ({
      insertOne: {
        document: {
          employeeId, managerId, companyId,
          contentTemplateId: a.contentTemplateId,
          targetType: "Content",
          frequency: a.frequency, targetGoal: a.targetGoal, expected: a.expected,
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        }
      }
    }));
    if (bulkOps.length > 0) {
      await EmployeeTarget.bulkWrite(bulkOps);
      await generateBatchTasks(employeeId, companyId, assignments, "Content");
    }
    res.status(200).json({ success: true, message: "Content batch targets assigned" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sales Outreach Templates
export const createSalesActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await SalesActivityTemplate.create({ activityName, category, description, isFixed });
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
    const template = await SalesActivityTemplate.findByIdAndUpdate(req.params.id, { activityName, category, description, isFixed }, { new: true });
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const assignSalesBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;
    await EmployeeTarget.deleteMany({ employeeId, companyId, targetType: "Sales" });
    const bulkOps = assignments.map(a => ({
      insertOne: {
        document: {
          employeeId, managerId, companyId,
          salesTemplateId: a.salesTemplateId,
          targetType: "Sales",
          frequency: a.frequency, targetGoal: a.targetGoal, expected: a.expected,
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        }
      }
    }));
    if (bulkOps.length > 0) {
      await EmployeeTarget.bulkWrite(bulkOps);
      await generateBatchTasks(employeeId, companyId, assignments, "Sales");
    }
    res.status(200).json({ success: true, message: "Sales batch targets assigned" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Creative Production Templates
export const createCreativeActivityTemplate = async (req, res) => {
  try {
    const { activityName, category, description, isFixed } = req.body;
    const template = await CreativeActivityTemplate.create({ activityName, category, description, isFixed });
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
    const template = await CreativeActivityTemplate.findByIdAndUpdate(req.params.id, { activityName, category, description, isFixed }, { new: true });
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const assignCreativeBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, companyId, assignments } = req.body;
    await EmployeeTarget.deleteMany({ employeeId, companyId, targetType: "Creative" });
    const bulkOps = assignments.map(a => ({
      insertOne: {
        document: {
          employeeId, managerId, companyId,
          creativeTemplateId: a.creativeTemplateId,
          targetType: "Creative",
          frequency: a.frequency, targetGoal: a.targetGoal, expected: a.expected,
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        }
      }
    }));
    if (bulkOps.length > 0) {
      await EmployeeTarget.bulkWrite(bulkOps);
      await generateBatchTasks(employeeId, companyId, assignments, "Creative");
    }
    res.status(200).json({ success: true, message: "Creative batch targets assigned" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
