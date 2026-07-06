import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        assignedCompanies: user.assignedCompanies,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Setup first admin (One time only)
// @route   POST /api/auth/setup-admin
// @access  Public
const setupAdmin = async (req, res) => {
  try {
    // Check if any admin exists
    const adminExists = await User.findOne({ role: 'manager' });
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists. Setup disabled.' });
    }

    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Please provide email, password, and name' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'manager',
      department: 'marketing',
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new employee
// @route   POST /api/auth/employees
// @access  Private/Admin
const createEmployee = async (req, res) => {
  const { name, email, role, department, assignedCompanies } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Default password for new employees
    const defaultPassword = 'Welcome123';

    const user = await User.create({
      name,
      email,
      password: defaultPassword,
      role: 'employee',
      department: department || 'general',
      assignedCompanies: assignedCompanies || [],
    });

    // Don't send token for employee creation, just return success
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      assignedCompanies: user.assignedCompanies,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all employees
// @route   GET /api/auth/employees
// @access  Private/Admin
const getEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).select('-password');
    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete employee
// @route   DELETE /api/auth/employees/:id
// @access  Private/Admin
const deleteEmployee = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      await User.deleteOne({ _id: user._id });
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {
  loginUser,
  setupAdmin,
  createEmployee,
  getEmployees,
  deleteEmployee
};
