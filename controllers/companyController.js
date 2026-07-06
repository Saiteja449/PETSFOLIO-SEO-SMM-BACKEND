import Company from '../models/Company.js';

// @desc    Get all companies
// @route   GET /api/companies
// @access  Private
const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ active: true });
    // Transform dates to string format expected by frontend (YYYY-MM-DD)
    const formatted = companies.map(c => ({
      _id: c._id,
      id: c.id,
      name: c.name,
      industry: c.industry,
      website: c.website,
      contacts: c.contacts,
      employeesCount: c.employeesCount,
      addedDate: c.addedDate ? c.addedDate.toISOString().split('T')[0] : null
    }));
    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching companies' });
  }
};

// @desc    Create a new company
// @route   POST /api/companies
// @access  Private/Admin
const createCompany = async (req, res) => {
  const { name, industry, website, contacts } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Company name is required' });
  }

  try {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    
    // Check if company with this ID already exists
    const existing = await Company.findOne({ id });
    if (existing) {
      return res.status(400).json({ message: 'Company with a similar name already exists.' });
    }

    const company = await Company.create({
      id,
      name,
      industry: industry || 'Miscellaneous',
      website: website || '',
      contacts: contacts || 'N/A',
      employeesCount: 0,
      addedDate: new Date()
    });

    res.status(201).json({
      _id: company._id,
      id: company.id,
      name: company.name,
      industry: company.industry,
      website: company.website,
      contacts: company.contacts,
      employeesCount: company.employeesCount,
      addedDate: company.addedDate.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error creating company' });
  }
};

// @desc    Delete a company
// @route   DELETE /api/companies/:id
// @access  Private/Admin
const deleteCompany = async (req, res) => {
  try {
    // Delete by internal `id` string (e.g., 'infasta') or Mongo `_id`. We'll use the string `id` since frontend uses it.
    const company = await Company.findOne({ id: req.params.id });

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    await Company.deleteOne({ _id: company._id });
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting company' });
  }
};

export { getCompanies, createCompany, deleteCompany };
