import TargetTemplate from "../models/TargetTemplate.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import TrackedVideo from "../models/TrackedVideo.js";
import SeoActivityTemplate from "../models/SeoActivityTemplate.js";
import User from "../models/User.js";
import SmmTask from "../models/SmmTask.js";
import SeoTask from "../models/SeoTask.js";

const generateBatchTasks = async (employeeId, companyId, assignments, type) => {
  try {
    const user = await User.findById(employeeId);
    if (!user) return;
    
    // Clear previously automated tasks for these templates
    if (type === "SMM") {
       await SmmTask.deleteMany({ employeeId, companyId, isAutomated: true, status: 'notstarted' });
    } else {
       await SeoTask.deleteMany({ companyId, assignedTo: user.email, isAutomated: true, status: 'notstarted' });
    }
    
    const tasksToInsert = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
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
          for (let k = 0; k < targetGoal; k++) {
            dates.push(new Date(d));
          }
        }
      } else if (a.frequency === "Weekly") {
        const dayOfWeek = today.getDay() || 7; 
        const startDateOfWeek = new Date(today);
        startDateOfWeek.setDate(today.getDate() - dayOfWeek + 1); // Monday of this week
        
        if (targetGoal >= 7) {
          const base = Math.floor(targetGoal / 7);
          let rem = targetGoal % 7;
          for (let i = 0; i < 7; i++) {
             const d = new Date(startDateOfWeek);
             d.setDate(d.getDate() + i);
             const count = base + (i < rem ? 1 : 0);
             for(let k=0; k<count; k++) dates.push(new Date(d));
          }
        } else {
          const step = 7 / targetGoal;
          for (let i = 0; i < targetGoal; i++) {
            const offset = Math.floor(i * step);
            const d = new Date(startDateOfWeek);
            d.setDate(d.getDate() + offset);
            dates.push(new Date(d));
          }
        }
      } else if (a.frequency === "Monthly") {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const totalDaysInMonth = endOfMonth.getDate();
        
        if (targetGoal >= totalDaysInMonth) {
          const base = Math.floor(targetGoal / totalDaysInMonth);
          let rem = targetGoal % totalDaysInMonth;
          for (let i = 0; i < totalDaysInMonth; i++) {
             const d = new Date(startOfMonth);
             d.setDate(d.getDate() + i);
             const count = base + (i < rem ? 1 : 0);
             for(let k=0; k<count; k++) dates.push(new Date(d));
          }
        } else {
          const step = totalDaysInMonth / targetGoal;
          for (let i = 0; i < targetGoal; i++) {
            const offset = Math.floor(i * step);
            const d = new Date(startOfMonth);
            d.setDate(d.getDate() + offset);
            dates.push(new Date(d));
          }
        }
      }

      let templateName = 'Task';
      let templateType = 'Post';
      if (type === "SMM") {
        const template = await TargetTemplate.findById(a.templateId);
        templateName = template?.name || 'SMM Task';
        templateType = template?.name || 'Reel Post';
      } else {
        const template = await SeoActivityTemplate.findById(a.seoTemplateId);
        templateName = template?.activityName || 'SEO Task';
        templateType = template?.activityName || 'Blog Post';
      }
      
      for (const d of dates) {
         if (type === "SMM") {
           tasksToInsert.push({
             title: `${a.frequency} Target: ${templateName}`,
             type: templateType,
             platform: a.platform || 'Both',
             status: 'notstarted',
             employeeId,
             companyId,
             weekLabel: `Week ${Math.ceil(d.getDate() / 7)}`,
             date: d.toISOString().split('T')[0],
             dueDate: d,
             isAutomated: true,
           });
         } else {
           tasksToInsert.push({
             title: `${a.frequency} Target: ${templateName}`,
             type: templateType,
             status: 'notstarted',
             assignedTo: user.email,
             employeeId,
             companyId,
             weekLabel: `Week ${Math.ceil(d.getDate() / 7)}`,
             date: d.toISOString().split('T')[0],
             dueDate: d,
             isAutomated: true,
           });
         }
      }
    }
    
    if (tasksToInsert.length > 0) {
      if (type === "SMM") await SmmTask.insertMany(tasksToInsert);
      else await SeoTask.insertMany(tasksToInsert);
    }
  } catch (err) {
    console.error("Error generating tasks:", err);
  }
};

export const createTargetTemplate = async (req, res) => {
  try {
    const { companyId, name, description, metric, defaultGoalValue, isFixed, defaultFrequency, defaultTargetGoal, companyOverrides } =
      req.body;
    const template = await TargetTemplate.create({
      companyId: companyId || undefined,
      name,
      description,
      metric,
      defaultGoalValue,
      isFixed,
      defaultFrequency,
      defaultTargetGoal,
      companyOverrides,
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
    const { name, description, metric, defaultGoalValue, isFixed, defaultFrequency, defaultTargetGoal, companyOverrides } = req.body;
    const template = await TargetTemplate.findByIdAndUpdate(
      req.params.id,
      { name, description, metric, defaultGoalValue, isFixed, defaultFrequency, defaultTargetGoal, companyOverrides },
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
      .populate("seoTemplateId");
    res.status(200).json({ success: true, data: targets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanyEmployeeTargets = async (req, res) => {
  try {
    const targets = await EmployeeTarget.find()
      .populate("templateId")
      .populate("seoTemplateId");
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
    const { activityName, category, description, isFixed, defaultFrequency, defaultTargetGoal, companyOverrides } = req.body;
    const template = await SeoActivityTemplate.create({
      activityName,
      category,
      description,
      isFixed,
      defaultFrequency,
      defaultTargetGoal,
      companyOverrides,
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
    const { activityName, category, description, isFixed, defaultFrequency, defaultTargetGoal, companyOverrides } = req.body;
    const template = await SeoActivityTemplate.findByIdAndUpdate(
      req.params.id,
      { activityName, category, description, isFixed, defaultFrequency, defaultTargetGoal, companyOverrides },
      { new: true }
    );
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
