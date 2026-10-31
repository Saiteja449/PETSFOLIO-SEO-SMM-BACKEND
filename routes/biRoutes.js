import express from "express";
import axios from "axios";
import User from "../models/User.js";
import Company from "../models/Company.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import BIChatSession from "../models/BIChatSession.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  sendMonthlyPerformanceReports,
  compileUserMonthlyPerformance,
  generateMonthlyReportHTML,
  getPreviousMonthDateRange,
} from "../services/monthlyReportService.js";
import {
  getBiOverview,
  getBiProductivity,
  getBiSuggestions,
} from "../controllers/biAnalyticsController.js";

const router = express.Router();

// Apply authentication to all BI routes
router.use(protect);

// --- Phase 1: Core BI Dashboard & Productivity Analytics ---
router.get("/overview", getBiOverview);
router.get("/productivity", getBiProductivity);
router.get("/suggestions", getBiSuggestions);

// 1. Get all chat sessions for the logged in user
router.get("/sessions", async (req, res) => {
  try {
    const sessions = await BIChatSession.find({ userId: req.user._id })
      .select("title createdAt updatedAt")
      .sort({ updatedAt: -1 });
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ error: "Failed to fetch chat sessions" });
  }
});

// 2. Get a specific chat session with its messages
router.get("/sessions/:id", async (req, res) => {
  try {
    const session = await BIChatSession.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!session) {
      return res.status(404).json({ error: "Chat session not found" });
    }
    res.json(session);
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({ error: "Failed to fetch chat session" });
  }
});

// 3. Delete a chat session
router.delete("/sessions/:id", async (req, res) => {
  try {
    const session = await BIChatSession.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!session) {
      return res.status(404).json({ error: "Chat session not found" });
    }
    res.json({ message: "Chat session deleted successfully" });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "Failed to delete chat session" });
  }
});

// --- Whitelist Filter Builder ---
async function buildFilter(collection, params = {}) {
  const filter = {};
  const {
    role,
    department,
    taskType,
    employeeName,
    companyName,
    status,
    isBlocked,
  } = params;

  if (collection === "users") {
    if (role && role !== "all") {
      filter.role = role.toLowerCase();
    }
    if (department && department !== "all") {
      filter.department = { $in: [new RegExp(`^${department}$`, "i")] };
    }
    if (typeof isBlocked === "boolean") {
      filter.isBlocked = isBlocked;
    }
    if (employeeName) {
      filter.name = { $regex: new RegExp(employeeName, "i") };
    }
  } else if (collection === "companies") {
    if (companyName) {
      filter.name = { $regex: new RegExp(companyName, "i") };
    }
  } else if (collection === "tasks") {
    const dept = (department || taskType || "all").toLowerCase();
    if (dept !== "all") {
      filter.department = new RegExp(`^${dept}$`, "i");
    }
    if (status && status !== "all") {
      filter.status = status.toLowerCase();
    }
    if (employeeName) {
      const user = await User.findOne({
        name: { $regex: new RegExp(employeeName, "i") },
      });
      if (user) filter.employeeId = user._id.toString();
    }
    if (companyName) {
      const comp = await Company.findOne({
        name: { $regex: new RegExp(companyName, "i") },
      });
      if (comp) filter.companyId = comp._id.toString();
    }
  } else if (collection === "targets") {
    if (employeeName) {
      const user = await User.findOne({
        name: { $regex: new RegExp(employeeName, "i") },
      });
      if (user) filter.employeeId = user._id;
    }
    if (department && department !== "all") {
      filter.targetType = new RegExp(`^${department}$`, "i");
    }
  }

  return filter;
}

// Tool 1: Exact Headcount and Breakdown by Role/Status/Department
async function executeGetUserSummary(params = {}) {
  try {
    const match = {};
    if (params.role && params.role !== "all") {
      match.role = params.role.toLowerCase();
    }
    if (params.department && params.department !== "all") {
      match.department = { $in: [new RegExp(`^${params.department}$`, "i")] };
    }

    const roleStats = await User.aggregate([
      { $match: match },
      {
        $group: {
          _id: { role: "$role", isBlocked: { $ifNull: ["$isBlocked", false] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const deptStats = await User.aggregate([
      { $match: match },
      { $unwind: "$department" },
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
        },
      },
    ]);

    let totalUsers = 0;
    let activeUsers = 0;
    let blockedUsers = 0;
    const byRole = {
      employee: { total: 0, active: 0, blocked: 0 },
      intern: { total: 0, active: 0, blocked: 0 },
      manager: { total: 0, active: 0, blocked: 0 },
    };

    roleStats.forEach((item) => {
      const role = item._id.role || "employee";
      const isBlocked = Boolean(item._id.isBlocked);
      const count = item.count;

      totalUsers += count;
      if (isBlocked) {
        blockedUsers += count;
      } else {
        activeUsers += count;
      }

      if (!byRole[role]) {
        byRole[role] = { total: 0, active: 0, blocked: 0 };
      }
      byRole[role].total += count;
      if (isBlocked) {
        byRole[role].blocked += count;
      } else {
        byRole[role].active += count;
      }
    });

    const byDepartment = {};
    deptStats.forEach((item) => {
      if (item._id) byDepartment[item._id] = item.count;
    });

    return {
      message: "Exact user counts directly calculated from MongoDB aggregation",
      totalUsers,
      activeUsers,
      blockedUsers,
      breakdownByRole: byRole,
      byDepartment,
    };
  } catch (err) {
    console.error("Error in executeGetUserSummary:", err);
    return { error: err.message };
  }
}

// Tool 2: Count Documents in Any Collection
async function executeCountDocuments(params) {
  try {
    const { collection } = params;
    const filter = await buildFilter(collection, params);

    let count = 0;
    if (collection === "users") {
      count = await User.countDocuments(filter);
    } else if (collection === "companies") {
      count = await Company.countDocuments(filter);
    } else if (collection === "targets") {
      count = await EmployeeTarget.countDocuments(filter);
    } else if (collection === "tasks") {
      const Task = (await import("../models/Task.js")).default;
      count = await Task.countDocuments(filter);
    } else {
      return { error: `Unknown collection: ${collection}` };
    }

    return {
      collection,
      filterApplied: filter,
      count,
    };
  } catch (err) {
    console.error("Error in executeCountDocuments:", err);
    return { error: err.message };
  }
}

// Tool 3: Query Database with Pagination Metadata
async function executeQueryDatabase(params) {
  try {
    const { collection, limit = 20 } = params;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const filter = await buildFilter(collection, params);

    let totalMatching = 0;
    let data = [];

    if (collection === "users") {
      totalMatching = await User.countDocuments(filter);
      data = await User.find(filter)
        .select("-password -currentToken")
        .limit(safeLimit)
        .lean();
    } else if (collection === "companies") {
      totalMatching = await Company.countDocuments(filter);
      data = await Company.find(filter).limit(safeLimit).lean();
    } else if (collection === "targets") {
      totalMatching = await EmployeeTarget.countDocuments(filter);
      data = await EmployeeTarget.find(filter)
        .populate("employeeId", "name role")
        .populate("managerId", "name")
        .limit(safeLimit)
        .lean();
    } else if (collection === "tasks") {
      const Task = (await import("../models/Task.js")).default;
      totalMatching = await Task.countDocuments(filter);
      data = await Task.find(filter)
        .select("-description -url")
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .populate("employeeId", "name role")
        .lean();
    } else {
      return { error: `Unknown collection: ${collection}` };
    }

    return {
      totalMatching,
      returned: data.length,
      hasMore: totalMatching > data.length,
      filterApplied: filter,
      data,
    };
  } catch (err) {
    console.error("Error executing query:", err);
    return { error: err.message };
  }
}

// --- Tools Declarations for Gemini Function Calling ---
const tools = [
  {
    functionDeclarations: [
      {
        name: "get_user_summary",
        description:
          "Get exact headcount and breakdown of users in GoalX CRM grouped by role (employee, intern, manager), status (active vs blocked), and department. ALWAYS use this tool when the user asks 'how many employees', 'how many interns', 'how many managers', 'how many users', or for any staff headcount summary.",
        parameters: {
          type: "OBJECT",
          properties: {
            role: {
              type: "STRING",
              description:
                "Optional role filter: 'employee', 'intern', 'manager', or 'all'.",
            },
            department: {
              type: "STRING",
              description:
                "Optional department filter: 'seo', 'smm', 'content', 'sales', 'creative', or 'all'.",
            },
          },
        },
      },
      {
        name: "count_documents",
        description:
          "Count the exact total number of records in any collection matching specified criteria. ALWAYS use this tool for count or 'how many' questions (e.g., tasks completed, pending tasks, companies) instead of listing records.",
        parameters: {
          type: "OBJECT",
          properties: {
            collection: {
              type: "STRING",
              description:
                "Collection to count: 'users', 'companies', 'targets', 'tasks'",
            },
            role: {
              type: "STRING",
              description: "For users: 'employee', 'intern', 'manager', or 'all'",
            },
            department: {
              type: "STRING",
              description:
                "Department filter: 'smm', 'seo', 'content', 'sales', 'creative', or 'all'",
            },
            status: {
              type: "STRING",
              description:
                "Status filter (e.g. 'completed', 'inprogress', 'pending', 'notstarted')",
            },
            isBlocked: {
              type: "BOOLEAN",
              description:
                "For users: true to count blocked users, false for active users",
            },
            employeeName: {
              type: "STRING",
              description: "Optional name of employee",
            },
            companyName: {
              type: "STRING",
              description: "Optional name of company/brand",
            },
          },
          required: ["collection"],
        },
      },
      {
        name: "query_database",
        description:
          "Search and inspect specific records in the database. Returns matching records with pagination metadata (totalMatching, returned, hasMore, data). Maximum 50 records returned.",
        parameters: {
          type: "OBJECT",
          properties: {
            collection: {
              type: "STRING",
              description:
                "Which collection to query: 'users', 'companies', 'targets', 'tasks'",
            },
            role: {
              type: "STRING",
              description: "For users: 'employee', 'intern', 'manager', or 'all'",
            },
            department: {
              type: "STRING",
              description:
                "Department: 'smm', 'seo', 'content', 'sales', 'creative', or 'all'",
            },
            taskType: {
              type: "STRING",
              description: "If collection is tasks, alias for department",
            },
            employeeName: {
              type: "STRING",
              description: "Optional name of employee to filter by",
            },
            companyName: {
              type: "STRING",
              description: "Optional name of company to filter by",
            },
            status: {
              type: "STRING",
              description:
                "Optional status to filter by (e.g. 'completed', 'inprogress', 'pending')",
            },
            isBlocked: {
              type: "BOOLEAN",
              description: "For users: filter active (false) or blocked (true)",
            },
            limit: {
              type: "INTEGER",
              description: "Number of records to return. Defaults to 20, max 50.",
            },
          },
          required: ["collection"],
        },
      },
    ],
  },
];

// Core BI Chat Handler Function
export async function handleBiChat({ message, history = [], userId, sessionId = null, isTest = false }) {
  const systemPrompt = `You are a Business Intelligence assistant for the GoalX CRM system.

CRITICAL DATA ACCURACY RULES:
1. NEVER COUNT LIST ITEMS: When the user asks "how many", "count", "total", or asks for quantities, ALWAYS use the 'get_user_summary' or 'count_documents' tool. NEVER query a list of documents and count rows yourself.
2. DISTINGUISH USER ROLES: In GoalX, users have three distinct roles:
   - "employee": Full-time staff (role: 'employee')
   - "intern": Interns / Trainees (role: 'intern')
   - "manager": Admins / Managers (role: 'manager')
   When asked "How many employees are there?", report the count of role='employee'. Break down or mention the intern and manager counts separately so the distinction is crystal clear. Do NOT say "there are X individuals registered" when asked about employees.
3. REPORT TOTAL VS DISPLAYED: If you display records and 'hasMore' is true, explicitly state "Showing X of Y total matching records".
4. ACTIVE VS BLOCKED STATUS: Always specify active vs. blocked users when reporting headcounts.
5. NO HALLUCINATION: If a tool returns no data or fails, state that clearly. Never guess or fabricate numbers.
6. FORMATTING: Format numerical breakdowns with clean markdown bullet points or tables. Do not expose raw MongoDB ObjectIDs.`;

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error("Gemini API key is missing");
  }

  // Format history for Gemini
  const formattedHistory = (history || []).map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.text }],
  }));

  // Append latest message
  formattedHistory.push({
    role: "user",
    parts: [{ text: message }],
  });

  const requestBody = {
    system_instruction: {
      parts: { text: systemPrompt },
    },
    contents: formattedHistory,
    tools: tools,
    generationConfig: {
      temperature: 0.1,
    },
  };

  const modelEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

  let response = await axios.post(modelEndpoint, requestBody, {
    headers: { "Content-Type": "application/json" },
  });

  let aiMessageText = "";

  // Check if the model decided to call a function
  if (
    response.data &&
    response.data.candidates &&
    response.data.candidates.length > 0 &&
    response.data.candidates[0].content.parts[0].functionCall
  ) {
    const functionCall = response.data.candidates[0].content.parts[0].functionCall;

    const startTime = Date.now();
    let queryResult;

    if (functionCall.name === "get_user_summary") {
      queryResult = await executeGetUserSummary(functionCall.args);
    } else if (functionCall.name === "count_documents") {
      queryResult = await executeCountDocuments(functionCall.args);
    } else if (functionCall.name === "query_database") {
      queryResult = await executeQueryDatabase(functionCall.args);
    } else {
      queryResult = { error: `Function ${functionCall.name} not found` };
    }

    const durationMs = Date.now() - startTime;
    console.log(`[BI Tool Call] ${functionCall.name} executed in ${durationMs}ms`, {
      params: functionCall.args,
      resultSummary:
        queryResult?.count !== undefined
          ? { count: queryResult.count }
          : queryResult?.totalUsers !== undefined
            ? { totalUsers: queryResult.totalUsers }
            : { returned: queryResult?.returned, totalMatching: queryResult?.totalMatching },
    });

    // Add functionCall to conversation context
    formattedHistory.push(response.data.candidates[0].content);

    // Add functionResponse to context
    formattedHistory.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            name: functionCall.name,
            response: { result: queryResult },
          },
        },
      ],
    });

    // Call Gemini follow-up
    const followUpBody = {
      system_instruction: { parts: { text: systemPrompt } },
      contents: formattedHistory,
      tools: tools,
      generationConfig: {
        temperature: 0.1,
      },
    };

    const followUpResponse = await axios.post(modelEndpoint, followUpBody, {
      headers: { "Content-Type": "application/json" },
    });

    if (
      followUpResponse.data &&
      followUpResponse.data.candidates &&
      followUpResponse.data.candidates.length > 0
    ) {
      aiMessageText = followUpResponse.data.candidates[0].content.parts[0].text;
    }
  } else if (
    response.data &&
    response.data.candidates &&
    response.data.candidates.length > 0
  ) {
    aiMessageText = response.data.candidates[0].content.parts[0].text;
  }

  if (!aiMessageText) {
    throw new Error("No response generated from Gemini API");
  }

  // Skip session saving if running automated tests
  if (isTest || !userId) {
    return { reply: aiMessageText, sessionId: null };
  }

  // Save to database session
  let chatSession;
  if (sessionId) {
    chatSession = await BIChatSession.findOne({
      _id: sessionId,
      userId,
    });
  }

  if (!chatSession) {
    const title = message.substring(0, 30) + (message.length > 30 ? "..." : "");
    chatSession = new BIChatSession({
      userId,
      title,
      messages: [],
    });

    const fullMessages = (history || []).map((msg) => ({
      role: msg.role,
      text: msg.text,
    }));
    fullMessages.push({ role: "user", text: message });
    fullMessages.push({ role: "model", text: aiMessageText });

    chatSession.messages = fullMessages;
    await chatSession.save();
  } else {
    chatSession.messages.push({ role: "user", text: message });
    chatSession.messages.push({ role: "model", text: aiMessageText });
    await chatSession.save();
  }

  return { reply: aiMessageText, sessionId: chatSession._id };
}

// 4. Chat with BI Assistant (and save to session)
router.post("/chat", async (req, res) => {
  try {
    const { message, history, sessionId } = req.body;
    const result = await handleBiChat({
      message,
      history,
      sessionId,
      userId: req.user._id,
    });
    res.json(result);
  } catch (error) {
    console.error("Error in BI Chat:", error.response?.data || error.message);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// --- Monthly Performance Report Trigger & Preview Endpoints ---
// 5. Trigger or Preview Monthly Performance Reports
router.post("/send-monthly-reports", async (req, res) => {
  try {
    const { referenceDate, previewOnly, targetUserId, sendToEmail } = req.body;

    if (req.user.role !== "manager" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden. Manager or admin access required.",
      });
    }

    const reportSummary = await sendMonthlyPerformanceReports({
      referenceDate: referenceDate ? new Date(referenceDate) : new Date(),
      previewOnly: Boolean(previewOnly),
      targetUserId: targetUserId || null,
      sendToEmail: sendToEmail || null,
    });

    res.json({
      success: true,
      data: reportSummary,
    });
  } catch (error) {
    console.error("Error sending monthly reports:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Preview single user HTML report in browser
router.get("/monthly-report-preview/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    const { startDate, endDate, monthLabel } = getPreviousMonthDateRange(
      req.query.date ? new Date(req.query.date) : new Date(),
    );
    const performanceData = await compileUserMonthlyPerformance(
      user,
      startDate,
      endDate,
      monthLabel,
    );

    if (!performanceData) {
      return res
        .status(400)
        .send("User is blocked or has no report data available.");
    }

    const html = generateMonthlyReportHTML(performanceData);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error rendering preview:", error);
    res.status(500).send(`Error rendering report preview: ${error.message}`);
  }
});

export default router;
