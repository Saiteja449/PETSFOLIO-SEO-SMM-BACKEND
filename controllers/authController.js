import User from "../models/User.js";
import jwt from "jsonwebtoken";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "30d",
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
      const token = generateToken(user._id);
      user.currentToken = token;
      await user.save();

      res.json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        assignedCompanies: user.assignedCompanies,
        token,
      });
    } else {
      res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Logout user & clear active session token
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
  try {
    if (req.user) {
      req.user.currentToken = null;
      await req.user.save();
    }
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Setup first admin (One time only)
// @route   POST /api/auth/setup-admin
// @access  Public
const setupAdmin = async (req, res) => {
  try {
    // Check if any admin exists
    const adminExists = await User.findOne({ role: "manager" });
    if (adminExists) {
      return res.status(400).json({
        success: false,
        message: "Admin already exists. Setup disabled.",
      });
    }

    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, password, and name",
      });
    }

    const user = new User({
      name,
      email,
      password,
      role: "manager",
      department: ["seo"],
    });

    const jwtToken = generateToken(user._id);
    user.currentToken = jwtToken;
    await user.save();

    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: jwtToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a new employee
// @route   POST /api/auth/employees
// @access  Private/Admin
const createEmployee = async (req, res) => {
  const { name, email, role, department, password, assignedCompanies } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // Default password for new employees if not provided
    const defaultPassword = "Welcome123";

    const user = await User.create({
      name,
      email,
      password: password || defaultPassword,
      role: role || "employee",
      department: department || ["seo"],
      assignedCompanies: assignedCompanies || [],
    });

    // Don't send token for employee creation, just return success
    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      assignedCompanies: user.assignedCompanies,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all employees
// @route   GET /api/auth/employees
// @access  Private/Admin
const getEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: { $in: ["employee", "intern"] } })
      .select("-password")
      .populate("createdBy", "name email");
    res.json({ success: true, data: employees });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
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
      res.json({ success: true, message: "User removed" });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// @desc    Update employee password
// @route   PUT /api/auth/employees/:id/password
// @access  Private/Admin
const updateEmployeePassword = async (req, res) => {
  const { password } = req.body;

  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.password = password;
      await user.save();
      res.json({ success: true, message: "Password updated successfully" });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Change current user's password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  if (!newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Please provide both new password and confirmation password",
    });
  }

  if (newPassword !== confirmPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Passwords do not match" });
  }

  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.password = newPassword;
      await user.save();
      res.json({ success: true, message: "Password updated successfully" });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update employee profile
// @route   PUT /api/auth/employees/:id
// @access  Private/Admin
const updateEmployee = async (req, res) => {
  const { name, email, role, department, assignedCompanies } = req.body;

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;
    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(400).json({ success: false, message: "Email already in use" });
      }
      user.email = email;
    }
    if (role) user.role = role;
    if (department) user.department = department;
    if (assignedCompanies) user.assignedCompanies = assignedCompanies;

    const updatedUser = await user.save();

    res.json({
      success: true,
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      department: updatedUser.department,
      assignedCompanies: updatedUser.assignedCompanies,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a new intern (Employee Action)
// @route   POST /api/auth/my-interns
// @access  Private/Employee
const createIntern = async (req, res) => {
  const { name, email, department, password, assignedCompanies } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // Ensure employee only assigns companies they are assigned to
    const employee = await User.findById(req.user._id);
    let validAssignedCompanies = [];
    if (assignedCompanies && Array.isArray(assignedCompanies)) {
      validAssignedCompanies = assignedCompanies.filter(cId => 
        employee.assignedCompanies.includes(cId)
      );
    }

    let validDepartments = [];
    if (department && Array.isArray(department)) {
      validDepartments = department.filter(d => 
        employee.department.includes(d)
      );
    }

    const defaultPassword = "Welcome123";

    const intern = await User.create({
      name,
      email,
      password: password || defaultPassword,
      role: "intern", // Strictly intern
      department: validDepartments.length > 0 ? validDepartments : employee.department,
      assignedCompanies: validAssignedCompanies,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      _id: intern._id,
      name: intern.name,
      email: intern.email,
      role: intern.role,
      department: intern.department,
      assignedCompanies: intern.assignedCompanies,
      createdBy: intern.createdBy
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get interns created by current employee
// @route   GET /api/auth/my-interns
// @access  Private/Employee
const getMyInterns = async (req, res) => {
  try {
    const interns = await User.find({ 
      role: "intern", 
      createdBy: req.user._id 
    }).select("-password");
    res.json({ success: true, data: interns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update intern created by current employee
// @route   PUT /api/auth/my-interns/:id
// @access  Private/Employee
const updateMyIntern = async (req, res) => {
  const { name, email, department, assignedCompanies } = req.body;

  try {
    const intern = await User.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id,
      role: "intern"
    });

    if (!intern) {
      return res.status(404).json({ success: false, message: "Intern not found or not authorized" });
    }

    if (name) intern.name = name;
    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: intern._id } });
      if (emailExists) {
        return res.status(400).json({ success: false, message: "Email already in use" });
      }
      intern.email = email;
    }
    if (assignedCompanies || department) {
      const employee = await User.findById(req.user._id);
      
      if (assignedCompanies) {
        intern.assignedCompanies = assignedCompanies.filter(cId => 
          employee.assignedCompanies.includes(cId)
        );
      }
      
      if (department) {
        intern.department = department.filter(d => 
          employee.department.includes(d)
        );
      }
    }

    const updatedIntern = await intern.save();

    res.json({
      success: true,
      _id: updatedIntern._id,
      name: updatedIntern.name,
      email: updatedIntern.email,
      role: updatedIntern.role,
      department: updatedIntern.department,
      assignedCompanies: updatedIntern.assignedCompanies,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete intern created by current employee
// @route   DELETE /api/auth/my-interns/:id
// @access  Private/Employee
const deleteMyIntern = async (req, res) => {
  try {
    const intern = await User.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id,
      role: "intern"
    });

    if (!intern) {
      return res.status(404).json({ success: false, message: "Intern not found or not authorized" });
    }

    await User.deleteOne({ _id: intern._id });
    res.json({ success: true, message: "Intern removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update password for intern created by current employee
// @route   PUT /api/auth/my-interns/:id/password
// @access  Private/Employee
const updateMyInternPassword = async (req, res) => {
  const { password } = req.body;

  try {
    const intern = await User.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id,
      role: "intern"
    });

    if (!intern) {
      return res.status(404).json({ success: false, message: "Intern not found or not authorized" });
    }

    intern.password = password;
    await intern.save();
    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export {
  loginUser,
  logoutUser,
  setupAdmin,
  createEmployee,
  getEmployees,
  deleteEmployee,
  updateEmployeePassword,
  changePassword,
  updateEmployee,
  createIntern,
  getMyInterns,
  updateMyIntern,
  deleteMyIntern,
  updateMyInternPassword
};
