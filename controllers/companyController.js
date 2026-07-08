import Company from "../models/Company.js";
import InstagramAccount from "../models/InstagramAccount.js";
import YoutubeAccount from "../models/YoutubeAccount.js";

const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ active: true });
    const formatted = companies.map((c) => ({
      _id: c._id,
      id: c.id,
      name: c.name,
      industry: c.industry,
      website: c.website,
      employeesCount: c.employeesCount,
      addedDate: c.addedDate ? c.addedDate.toISOString().split("T")[0] : null,
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching companies" });
  }
};

const createCompany = async (req, res) => {
  const { name, industry, website } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "Company name is required" });
  }

  try {
    const id = name.toLowerCase().replace(/\s+/g, "_");

    const existing = await Company.findOne({ id });
    if (existing) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Company with a similar name already exists.",
        });
    }

    const company = await Company.create({
      id,
      name,
      industry: industry || "Miscellaneous",
      website: website || "",
      employeesCount: 0,
      addedDate: new Date(),
    });

    res.status(201).json({
      success: true,
      _id: company._id,
      id: company.id,
      name: company.name,
      industry: company.industry,
      website: company.website,
      employeesCount: company.employeesCount,
      addedDate: company.addedDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error creating company" });
  }
};

const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findOne({ id: req.params.id });

    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }

    await Company.deleteOne({ _id: company._id });
    res.json({ success: true, message: "Company deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error deleting company" });
  }
};

const getCompanyIntegrations = async (req, res) => {
  try {
    const { id } = req.params;

    // Check Meta (Instagram/Facebook)
    const metaAccount = await InstagramAccount.findOne({ companyId: id });

    // Check Google (YouTube)
    const googleAccount = await YoutubeAccount.findOne({ companyId: id });

    res.json({
      success: true,
      metaConnected: !!metaAccount,
      fbConnected: metaAccount ? !!metaAccount.facebookPageId : false,
      igConnected: metaAccount
        ? !!metaAccount.instagramBusinessAccountId
        : false,
      googleConnected: !!googleAccount,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error fetching company integrations",
      });
  }
};

export { getCompanies, createCompany, deleteCompany, getCompanyIntegrations };
