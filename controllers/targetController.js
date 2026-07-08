import TargetTemplate from "../models/TargetTemplate.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import TrackedVideo from "../models/TrackedVideo.js";
import SeoActivityTemplate from "../models/SeoActivityTemplate.js";

export const createTargetTemplate = async (req, res) => {
  try {
    const { companyId, name, description, platform, metric, defaultGoalValue } =
      req.body;
    const template = await TargetTemplate.create({
      companyId: companyId || undefined,
      name,
      description,
      platform,
      metric,
      defaultGoalValue,
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
    const { employeeId, managerId, assignments } = req.body;
    
    await EmployeeTarget.deleteMany({ employeeId, templateId: { $exists: true } });

    const newTargets = assignments.map(a => ({
      employeeId,
      managerId,
      templateId: a.templateId,
      platform: a.platform,
      metric: a.metric || "PostCount", // Defaulting metric as templates don't strictly define it right now
      monthlyTarget: a.monthlyTarget,
      weeklyTarget: a.weeklyTarget,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    }));

    if (newTargets.length > 0) {
      await EmployeeTarget.insertMany(newTargets);
    }

    res.status(201).json({ success: true, message: "Batch assignments saved" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignSeoBatchTargets = async (req, res) => {
  try {
    const { employeeId, managerId, assignments } = req.body;
    
    await EmployeeTarget.deleteMany({ employeeId, seoTemplateId: { $exists: true } });

    const newTargets = assignments.map(a => ({
      employeeId,
      managerId,
      seoTemplateId: a.seoTemplateId,
      targetType: "SEO",
      frequency: a.frequency,
      targetGoal: a.targetGoal,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    }));

    if (newTargets.length > 0) {
      await EmployeeTarget.insertMany(newTargets);
    }

    res.status(201).json({ success: true, message: "SEO Batch assignments saved" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeTargets = async (req, res) => {
  try {
    const targets = await EmployeeTarget.find({
      employeeId: req.params.employeeId,
    }).populate("templateId");
    res.status(200).json({ success: true, data: targets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanyEmployeeTargets = async (req, res) => {
  try {
    const targets = await EmployeeTarget.find().populate("templateId");
    // filter targets where the template belongs to the requested company
    // or is a global template (no companyId)
    // we also should ensure the user actually belongs to this company, but for SMM aggregation this works
    const companyTargets = targets.filter(t => 
      t.templateId && 
      (t.templateId.companyId?.toString() === req.params.companyId || !t.templateId.companyId)
    );
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
    const { activityName, category } = req.body;
    const template = await SeoActivityTemplate.create({
      activityName,
      category,
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
    res.status(200).json({ success: true, message: "SEO Template deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
