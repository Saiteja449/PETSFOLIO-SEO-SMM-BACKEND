import Lead from "../models/Lead.js";

// 1. Create a Lead
export async function createLead(req, res) {
  try {
    const { name, email, phone, companyId, source, status, dealValue, notes, assignedTo } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Lead name is required" });
    }

    const lead = new Lead({
      name,
      email: email || "",
      phone: phone || "",
      companyId: companyId || "",
      source: (source || "website").toLowerCase(),
      status: (status || "new").toLowerCase(),
      dealValue: Number(dealValue) || 0,
      notes: notes || "",
      assignedTo: assignedTo || null,
      convertedAt: (status || "").toLowerCase() === "converted" ? new Date() : null,
    });

    await lead.save();
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    console.error("Error creating lead:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 2. Get All Leads with Filters
export async function getLeads(req, res) {
  try {
    const { status, source, companyId, search } = req.query;

    const filter = {};
    if (status && status !== "all") filter.status = status.toLowerCase();
    if (source && source !== "all") filter.source = source.toLowerCase();
    if (companyId && companyId !== "all") filter.companyId = companyId;
    if (search) {
      filter.$or = [
        { name: { $regex: new RegExp(search, "i") } },
        { email: { $regex: new RegExp(search, "i") } },
        { phone: { $regex: new RegExp(search, "i") } },
      ];
    }

    const leads = await Lead.find(filter)
      .populate("assignedTo", "name role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: leads.length, data: leads });
  } catch (err) {
    console.error("Error fetching leads:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 3. Update Lead Status / Notes
export async function updateLead(req, res) {
  try {
    const { status, dealValue, notes, assignedTo } = req.body;
    const update = {};

    if (status) {
      update.status = status.toLowerCase();
      if (update.status === "converted") {
        update.convertedAt = new Date();
      }
    }
    if (dealValue !== undefined) update.dealValue = Number(dealValue) || 0;
    if (notes !== undefined) update.notes = notes;
    if (assignedTo !== undefined) update.assignedTo = assignedTo || null;

    const lead = await Lead.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    res.json({ success: true, data: lead });
  } catch (err) {
    console.error("Error updating lead:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 4. Delete Lead
export async function deleteLead(req, res) {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Lead deleted successfully" });
  } catch (err) {
    console.error("Error deleting lead:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 5. Aggregate Lead Funnel Analytics
export async function getLeadAnalytics(req, res) {
  try {
    const { startDate, endDate, companyId } = req.query;

    const filter = {};
    if (companyId && companyId !== "all") filter.companyId = companyId;
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const leads = await Lead.find(filter).lean();

    const totalLeads = leads.length;
    const newLeads = leads.filter((l) => l.status === "new").length;
    const contactedLeads = leads.filter((l) => ["contacted", "follow_up"].includes(l.status)).length;
    const qualifiedLeads = leads.filter((l) => ["interested", "qualified"].includes(l.status)).length;
    const convertedLeads = leads.filter((l) => l.status === "converted").length;
    const lostLeads = leads.filter((l) => l.status === "lost").length;

    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    const totalPipelineValue = leads.reduce((sum, l) => sum + (l.dealValue || 0), 0);
    const convertedValue = leads.filter((l) => l.status === "converted").reduce((sum, l) => sum + (l.dealValue || 0), 0);

    // Funnel Steps for Chart
    const funnelSteps = [
      { step: "Total Leads", count: totalLeads },
      { step: "Contacted", count: contactedLeads + qualifiedLeads + convertedLeads },
      { step: "Qualified", count: qualifiedLeads + convertedLeads },
      { step: "Converted", count: convertedLeads },
    ];

    // Source Breakdown
    const sources = ["seo", "instagram", "facebook", "linkedin", "whatsapp", "website", "ads", "referral", "direct"];
    const sourceBreakdown = sources.map((s) => {
      const sLeads = leads.filter((l) => (l.source || "").toLowerCase() === s);
      const sConverted = sLeads.filter((l) => l.status === "converted").length;
      const rate = sLeads.length > 0 ? Math.round((sConverted / sLeads.length) * 100) : 0;
      return {
        source: s.toUpperCase(),
        totalLeads: sLeads.length,
        converted: sConverted,
        conversionRate: rate,
      };
    }).sort((a, b) => b.totalLeads - a.totalLeads);

    res.json({
      success: true,
      data: {
        totalLeads,
        newLeads,
        contactedLeads,
        qualifiedLeads,
        convertedLeads,
        lostLeads,
        conversionRate,
        totalPipelineValue,
        convertedValue,
        funnelSteps,
        sourceBreakdown,
      },
    });
  } catch (err) {
    console.error("Error in getLeadAnalytics:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
