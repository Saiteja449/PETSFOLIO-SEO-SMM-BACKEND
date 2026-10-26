import User from "../models/User.js";
import Company from "../models/Company.js";
import Task from "../models/Task.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";

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
      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message:
            "Your account is currently deactivated/blocked. Please contact your administrator.",
        });
      }

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
        isBlocked: user.isBlocked,
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
  const { name, email, role, department, password, assignedCompanies } =
    req.body;

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

    // Notify Managers
    const managers = await User.find({ role: "manager" });
    if (managers.length > 0) {
      const managerNotifications = managers.map((m) => ({
        title: "New Employee",
        message: `${name} has been added to the team.`,
        category: "system",
        severity: "info",
        userId: m._id,
      }));
      await Notification.insertMany(managerNotifications);
    }

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
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;
    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailExists) {
        return res
          .status(400)
          .json({ success: false, message: "Email already in use" });
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

const resolveValidCompanies = async (assignedCompanies, user) => {
  if (!assignedCompanies || !Array.isArray(assignedCompanies)) return [];

  const allCompanies = await Company.find({ active: true });

  // If user is manager or admin, or has no restricted companies, allow all valid selected companies
  if (user.role === "manager" || !user.assignedCompanies || user.assignedCompanies.length === 0) {
    return assignedCompanies.map((cId) => {
      const match = allCompanies.find(
        (c) =>
          String(c.id).toLowerCase() === String(cId).toLowerCase() ||
          String(c._id) === String(cId) ||
          String(c.name).toLowerCase() === String(cId).toLowerCase()
      );
      return match ? match.id : cId;
    });
  }

  // Build a set of allowed keys from user.assignedCompanies
  const allowedKeys = new Set();
  user.assignedCompanies.forEach((compKey) => {
    const match = allCompanies.find(
      (c) =>
        String(c.id).toLowerCase() === String(compKey).toLowerCase() ||
        String(c._id) === String(compKey) ||
        String(c.name).toLowerCase() === String(compKey).toLowerCase()
    );
    if (match) {
      allowedKeys.add(match.id.toLowerCase());
      allowedKeys.add(String(match._id));
      allowedKeys.add(match.name.toLowerCase());
    } else {
      allowedKeys.add(String(compKey).toLowerCase());
    }
  });

  const valid = [];
  assignedCompanies.forEach((cId) => {
    const match = allCompanies.find(
      (c) =>
        String(c.id).toLowerCase() === String(cId).toLowerCase() ||
        String(c._id) === String(cId) ||
        String(c.name).toLowerCase() === String(cId).toLowerCase()
    );
    const key = match ? match.id : cId;
    const isAllowed =
      allowedKeys.has(String(cId).toLowerCase()) ||
      (match &&
        (allowedKeys.has(match.id.toLowerCase()) ||
          allowedKeys.has(String(match._id)) ||
          allowedKeys.has(match.name.toLowerCase())));
    if (isAllowed) {
      valid.push(key);
    }
  });

  return valid;
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

    const employee = await User.findById(req.user._id);
    const validAssignedCompanies = await resolveValidCompanies(
      assignedCompanies,
      employee || req.user
    );

    let validDepartments = [];
    if (department && Array.isArray(department)) {
      validDepartments = department.filter((d) =>
        employee.department.includes(d),
      );
    }

    const defaultPassword = "Welcome123";

    const intern = await User.create({
      name,
      email,
      password: password || defaultPassword,
      role: "intern", // Strictly intern
      department:
        validDepartments.length > 0 ? validDepartments : employee.department,
      assignedCompanies: validAssignedCompanies,
      createdBy: req.user._id,
    });

    // Notify Managers
    const managers = await User.find({ role: "manager" });
    if (managers.length > 0) {
      const managerNotifications = managers.map((m) => ({
        title: "New Intern",
        message: `${employee?.name || "An employee"} added intern ${intern.name}.`,
        category: "intern",
        severity: "info",
        userId: m._id,
      }));
      await Notification.insertMany(managerNotifications);
    }

    res.status(201).json({
      success: true,
      _id: intern._id,
      name: intern.name,
      email: intern.email,
      role: intern.role,
      department: intern.department,
      assignedCompanies: intern.assignedCompanies,
      createdBy: intern.createdBy,
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
      role: "intern",
    });

    if (!intern) {
      return res.status(404).json({
        success: false,
        message: "Intern not found or not authorized",
      });
    }

    if (name) intern.name = name;
    if (email) {
      const emailExists = await User.findOne({
        email,
        _id: { $ne: intern._id },
      });
      if (emailExists) {
        return res
          .status(400)
          .json({ success: false, message: "Email already in use" });
      }
      intern.email = email;
    }
    if (assignedCompanies || department) {
      const employee = await User.findById(req.user._id);

      if (assignedCompanies) {
        intern.assignedCompanies = await resolveValidCompanies(
          assignedCompanies,
          employee || req.user
        );
      }

      if (department) {
        intern.department = department.filter((d) =>
          employee ? employee.department.includes(d) : true,
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
      role: "intern",
    });

    if (!intern) {
      return res.status(404).json({
        success: false,
        message: "Intern not found or not authorized",
      });
    }

    const internName = intern.name;
    await User.deleteOne({ _id: intern._id });

    // Notify Managers
    const employee = await User.findById(req.user._id);
    const managers = await User.find({ role: "manager" });
    if (managers.length > 0) {
      const managerNotifications = managers.map((m) => ({
        title: "Intern Removed",
        message: `${employee?.name || "An employee"} removed intern ${internName}.`,
        category: "intern",
        severity: "info",
        userId: m._id,
      }));
      await Notification.insertMany(managerNotifications);
    }

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
      role: "intern",
    });

    if (!intern) {
      return res.status(404).json({
        success: false,
        message: "Intern not found or not authorized",
      });
    }

    intern.password = password;
    await intern.save();
    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Reassign tasks from intern to another intern, then delete the intern
// @route   POST /api/auth/my-interns/:id/reassign-and-delete
// @access  Private/Employee
const reassignAndDeleteIntern = async (req, res) => {
  const { newInternId } = req.body;
  const internIdToDelete = req.params.id;

  try {
    const internToDelete = await User.findOne({
      _id: internIdToDelete,
      role: "intern",
    });

    if (!internToDelete) {
      return res.status(404).json({
        success: false,
        message: "Intern to delete not found or not authorized",
      });
    }

    // Helper to safely update a task model if it exists
    const safeUpdate = async (modelName, filter, update, options) => {
      if (mongoose.modelNames().includes(modelName)) {
        return await mongoose
          .model(modelName)
          .updateMany(filter, update, options);
      } else {
        console.warn(`Model ${modelName} not found, skipping update.`);
        return null;
      }
    };

    if (newInternId) {
      const newIntern = await User.findOne({
        _id: newInternId,
        role: "intern",
      });

      if (!newIntern) {
        return res.status(404).json({
          success: false,
          message: "New intern not found or not authorized",
        });
      }

      // Reassign subtasks
      await safeUpdate(
        "Task",
        { "subTasks.assignedToInternId": internIdToDelete },
        { $set: { "subTasks.$[elem].assignedToInternId": newInternId } },
        { arrayFilters: [{ "elem.assignedToInternId": internIdToDelete }] },
      );
    } else {
      // Delete subtasks
      await safeUpdate(
        "Task",
        { "subTasks.assignedToInternId": internIdToDelete },
        { $pull: { subTasks: { assignedToInternId: internIdToDelete } } },
      );
    }

    const internName = internToDelete.name;
    await User.deleteOne({ _id: internIdToDelete });

    // Notifications
    const employee = await User.findById(req.user._id);
    const managers = await User.find({ role: "manager" });

    if (newInternId) {
      const newIntern = await User.findById(newInternId);

      // Notify New Intern
      await Notification.create({
        title: "Tasks Reassigned",
        message: `You have been assigned tasks from ${internName}.`,
        category: "task",
        severity: "info",
        userId: newInternId,
      });

      // Notify Managers
      if (managers.length > 0) {
        const managerNotifications = managers.map((m) => ({
          title: "Intern Replaced",
          message: `${internName}'s tasks reassigned to ${newIntern?.name || "another intern"} and account removed.`,
          category: "intern",
          severity: "info",
          userId: m._id,
        }));
        await Notification.insertMany(managerNotifications);
      }
    } else {
      // Notify Managers
      if (managers.length > 0) {
        const managerNotifications = managers.map((m) => ({
          title: "Intern Removed",
          message: `${employee?.name || "An employee"} removed intern ${internName}.`,
          category: "intern",
          severity: "info",
          userId: m._id,
        }));
        await Notification.insertMany(managerNotifications);
      }
    }

    res.json({ success: true, message: "Intern removed and tasks handled" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Toggle Block/Unblock status for an Employee or Intern
// @route   PUT /api/auth/employees/:id/toggle-block (or /my-interns/:id/toggle-block)
// @access  Private (Admin or Employee for their intern)
const toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Role check: Employees can only block interns they manage or created
    if (req.user.role === "employee" && user.role !== "intern") {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to modify this user" });
    }

    user.isBlocked = !user.isBlocked;
    user.blockedAt = user.isBlocked ? new Date() : null;

    if (user.isBlocked) {
      user.currentToken = null; // Invalidate active session immediately
    }

    await user.save();

    // When blocking, handle optional task & delegation reassignment
    if (user.isBlocked) {
      const { reassignTo, newInternId } = req.body || {};
      const targetUserId = reassignTo || newInternId;

      if (user.role === "intern") {
        if (targetUserId) {
          const targetIntern = await User.findOne({
            _id: targetUserId,
            role: "intern",
            isBlocked: { $ne: true },
          });

          if (targetIntern) {
            // Find all active/uncompleted tasks with subtasks assigned to the blocked intern
            const activeTasks = await Task.find({
              "subTasks.assignedToInternId": user._id.toString(),
              status: { $ne: "completed" },
            });

            for (const task of activeTasks) {
              let modified = false;
              const updatedSubTasks = [];

              for (const st of task.subTasks) {
                if (st.assignedToInternId === user._id.toString()) {
                  if (
                    st.status === "completed" ||
                    (st.completedQuantity >= st.targetQuantity &&
                      st.targetQuantity > 0)
                  ) {
                    // Fully completed subtask: preserve under blocked intern
                    updatedSubTasks.push(st);
                  } else if (
                    st.completedQuantity > 0 &&
                    st.completedQuantity < st.targetQuantity
                  ) {
                    // Partially completed subtask: preserve completed portion under blocked intern
                    const remainingQty =
                      st.targetQuantity - st.completedQuantity;
                    st.targetQuantity = st.completedQuantity;
                    st.status = "completed";
                    updatedSubTasks.push(st);

                    // Create remainder subtask for target intern
                    updatedSubTasks.push({
                      assignedToInternId: targetIntern._id.toString(),
                      assignedByEmployeeId:
                        st.assignedByEmployeeId || req.user._id.toString(),
                      targetQuantity: remainingQty,
                      completedQuantity: 0,
                      status: "notstarted",
                    });
                    modified = true;
                  } else {
                    // Unstarted subtask: transfer directly to target intern
                    st.assignedToInternId = targetIntern._id.toString();
                    updatedSubTasks.push(st);
                    modified = true;
                  }
                } else {
                  updatedSubTasks.push(st);
                }
              }

              if (modified) {
                task.subTasks = updatedSubTasks;
                await task.save();
              }
            }

            // Reassign automated delegation rules in EmployeeTarget
            await EmployeeTarget.updateMany(
              { "delegations.internId": user._id.toString() },
              {
                $set: {
                  "delegations.$[elem].internId": targetIntern._id.toString(),
                },
              },
              { arrayFilters: [{ "elem.internId": user._id.toString() }] },
            );

            // Notify newly assigned intern
            await Notification.create({
              title: "Tasks Reassigned",
              message: `Pending tasks from ${user.name} have been reassigned to you.`,
              category: "task",
              severity: "info",
              userId: targetIntern._id,
            });
          }
        } else {
          // No reassignment: remove unstarted/pending subtasks from active tasks (keep completed work)
          const activeTasks = await Task.find({
            "subTasks.assignedToInternId": user._id.toString(),
            status: { $ne: "completed" },
          });

          for (const task of activeTasks) {
            task.subTasks = task.subTasks.filter((st) => {
              if (st.assignedToInternId !== user._id.toString()) return true;
              return st.status === "completed" || st.completedQuantity > 0;
            });
            const totalCompleted = task.subTasks.reduce(
              (acc, st) => acc + (st.completedQuantity || 0),
              0,
            );
            task.completedQuantity = Math.max(
              task.completedQuantity || 0,
              totalCompleted,
            );
            if (task.completedQuantity >= task.targetQuantity) {
              task.status = "completed";
            } else if (task.completedQuantity > 0) {
              task.status = "inprogress";
            }
            await task.save();
          }

          // Clean up delegation rules in EmployeeTarget
          await EmployeeTarget.updateMany(
            {},
            { $pull: { delegations: { internId: user._id.toString() } } },
          );
        }
      } else if (user.role === "employee" && targetUserId) {
        // Employee block with reassignment
        const targetEmployee = await User.findOne({
          _id: targetUserId,
          isBlocked: { $ne: true },
        });

        if (targetEmployee) {
          await Task.updateMany(
            { employeeId: user._id.toString(), status: { $ne: "completed" } },
            {
              $set: {
                employeeId: targetEmployee._id.toString(),
                assignedTo: targetEmployee.name,
              },
            },
          );

          await EmployeeTarget.updateMany(
            { employeeId: user._id, status: "In Progress" },
            { $set: { employeeId: targetEmployee._id } },
          );

          await Notification.create({
            title: "Tasks Reassigned",
            message: `Active tasks from ${user.name} have been reassigned to you.`,
            category: "task",
            severity: "info",
            userId: targetEmployee._id,
          });
        }
      }
    }

    // Notify Managers
    const managers = await User.find({ role: "manager" });
    if (managers.length > 0) {
      const managerNotifications = managers.map((m) => ({
        title: user.isBlocked ? "User Blocked" : "User Unblocked",
        message: `${req.user?.name || "Administrator"} ${user.isBlocked ? "blocked" : "unblocked"} ${user.role} ${user.name}.`,
        category: "system",
        severity: user.isBlocked ? "warning" : "info",
        userId: m._id,
      }));
      await Notification.insertMany(managerNotifications);
    }

    res.json({
      success: true,
      message: user.isBlocked
        ? "User blocked successfully"
        : "User unblocked successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked,
        blockedAt: user.blockedAt,
      },
    });
  } catch (error) {
    console.error("Error toggling block user:", error);
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
  updateMyInternPassword,
  reassignAndDeleteIntern,
  toggleBlockUser,
};
