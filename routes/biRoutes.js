import express from "express";
import axios from "axios";
import User from "../models/User.js";
import Company from "../models/Company.js";
import EmployeeTarget from "../models/EmployeeTarget.js";
import BIChatSession from "../models/BIChatSession.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication to all BI routes
router.use(protect);

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
    const session = await BIChatSession.findOne({ _id: req.params.id, userId: req.user._id });
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
    const session = await BIChatSession.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!session) {
      return res.status(404).json({ error: "Chat session not found" });
    }
    res.json({ message: "Chat session deleted successfully" });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "Failed to delete chat session" });
  }
});

// --- Tools for Gemini Function Calling ---
const tools = [{
  functionDeclarations: [{
    name: "query_database",
    description: "Search the database for specific data to answer the user's question.",
    parameters: {
      type: "OBJECT",
      properties: {
        collection: {
          type: "STRING",
          description: "Which collection to query: 'users', 'companies', 'targets', 'tasks'"
        },
        taskType: {
          type: "STRING",
          description: "If collection is tasks, specify 'smm', 'seo', 'content', 'sales', 'creative', or 'all'. Defaults to 'all'"
        },
        employeeName: {
          type: "STRING",
          description: "Optional name of the employee to filter by"
        },
        status: {
          type: "STRING",
          description: "Optional status to filter by (e.g. 'completed', 'inprogress', 'notstarted')"
        },
        limit: {
          type: "INTEGER",
          description: "Limit the number of records returned. Default is 20."
        }
      },
      required: ["collection"]
    }
  }]
}];

// Helper function to execute the query
async function executeQueryDatabase(params) {
  try {
    const { collection, taskType, employeeName, status, limit = 20 } = params;
    
    // Build query filter
    let filter = {};
    if (employeeName) {
      // Find employee first
      const user = await User.findOne({ name: { $regex: new RegExp(employeeName, "i") } });
      if (user) filter.employeeId = user._id.toString(); 
    }
    if (status) {
      filter.status = status;
    }

    if (collection === 'users') {
      return await User.find(filter).select("-password -currentToken").limit(limit).lean();
    } else if (collection === 'companies') {
      return await Company.find(filter).limit(limit).lean();
    } else if (collection === 'targets') {
      return await EmployeeTarget.find(filter).populate("employeeId", "name").populate("managerId", "name").limit(limit).lean();
    } else if (collection === 'tasks') {
      let results = {};
      const loadTasks = async (modelPath) => {
          const Model = (await import(modelPath)).default;
          return await Model.find(filter).select("-description -url").sort({createdAt: -1}).limit(limit).populate("employeeId", "name").lean();
      };
      
      const t = (taskType || 'all').toLowerCase();
      if (t === 'smm' || t === 'all') results.smm = await loadTasks("../models/SmmTask.js");
      if (t === 'seo' || t === 'all') results.seo = await loadTasks("../models/SeoTask.js");
      if (t === 'content' || t === 'all') results.content = await loadTasks("../models/ContentTask.js");
      if (t === 'sales' || t === 'all') results.sales = await loadTasks("../models/SalesTask.js");
      if (t === 'creative' || t === 'all') results.creative = await loadTasks("../models/CreativeTask.js");
      
      return results;
    }
    return { error: "Unknown collection or no data found" };
  } catch (err) {
    console.error("Error executing query:", err);
    return { error: err.message };
  }
}

// 4. Chat with BI Assistant (and save to session)
router.post("/chat", async (req, res) => {
  try {
    const { message, history, sessionId } = req.body;

    const systemPrompt = `You are a Business Intelligence assistant for the GoalX CRM system. 
You have access to a database via the 'query_database' tool. 
If the user asks a question requiring data, use the tool to fetch it first. Do not guess information.
Keep your responses professional and formatted clearly in Markdown. By default, keep responses short and concise. However, if the user explicitly asks for a detailed review or complete details, provide a comprehensive and detailed summary. Do not expose raw MongoDB IDs unless necessary, use the names of employees and companies.`;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: "Gemini API key is missing" });
    }

    // Format history for Gemini
    const formattedHistory = (history || []).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    // Append the latest message
    formattedHistory.push({
      role: "user",
      parts: [{ text: message }],
    });

    const requestBody = {
      system_instruction: {
        parts: { text: systemPrompt },
      },
      contents: formattedHistory,
      tools: tools
    };

    let response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`,
      requestBody,
      { headers: { "Content-Type": "application/json" } }
    );

    let aiMessageText = "";

    // Check if the model decided to call a function
    if (
      response.data &&
      response.data.candidates &&
      response.data.candidates.length > 0 &&
      response.data.candidates[0].content.parts[0].functionCall
    ) {
      const functionCall = response.data.candidates[0].content.parts[0].functionCall;
      
      let queryResult;
      if (functionCall.name === "query_database") {
        queryResult = await executeQueryDatabase(functionCall.args);
      } else {
        queryResult = { error: "Function not found" };
      }

      // Add the model's functionCall to context
      formattedHistory.push(response.data.candidates[0].content);

      // Add the functionResponse to context
      formattedHistory.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: functionCall.name,
            response: { result: queryResult }
          }
        }]
      });

      // Call Gemini again
      const followUpBody = {
        system_instruction: { parts: { text: systemPrompt } },
        contents: formattedHistory,
        tools: tools
      };

      const followUpResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`,
        followUpBody,
        { headers: { "Content-Type": "application/json" } }
      );
      
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
      // Model returned text directly
      aiMessageText = response.data.candidates[0].content.parts[0].text;
    }

    if (!aiMessageText) {
      return res.status(500).json({ error: "No response from Gemini API" });
    }

    // Save to database session
    let chatSession;
    if (sessionId) {
      chatSession = await BIChatSession.findOne({ _id: sessionId, userId: req.user._id });
    }

    if (!chatSession) {
      // Generate a title based on the first user message (up to 30 chars)
      const title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
      chatSession = new BIChatSession({
        userId: req.user._id,
        title: title,
        messages: [] 
      });
      
      // Populate full messages array
      const fullMessages = (history || []).map(msg => ({ role: msg.role, text: msg.text }));
      fullMessages.push({ role: 'user', text: message });
      fullMessages.push({ role: 'model', text: aiMessageText });
      
      chatSession.messages = fullMessages;
      await chatSession.save();
    } else {
      // Append only the latest exchange
      chatSession.messages.push({ role: 'user', text: message });
      chatSession.messages.push({ role: 'model', text: aiMessageText });
      await chatSession.save();
    }

    res.json({ reply: aiMessageText, sessionId: chatSession._id });

  } catch (error) {
    console.error("Error in BI Chat:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
