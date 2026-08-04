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

// 4. Chat with BI Assistant (and save to session)
router.post("/chat", async (req, res) => {
  try {
    const { message, history, sessionId } = req.body;

    // --- Dynamic Context Fetching ---
    // Combine history and current message to detect what data is needed
    const combinedText = (history || []).map(m => m.text).concat(message).join(" ").toLowerCase();

    const context = {};

    if (combinedText.includes("employee") || combinedText.includes("user") || combinedText.includes("staff")) {
      context.users = await User.find().select("-password -currentToken").limit(100).lean();
    }

    if (combinedText.includes("company") || combinedText.includes("companies") || combinedText.includes("brand")) {
      context.companies = await Company.find().limit(100).lean();
    }

    if (combinedText.includes("target")) {
      context.targets = await EmployeeTarget.find()
        .populate("employeeId", "name")
        .populate("managerId", "name")
        .limit(100)
        .lean();
    }

    if (combinedText.includes("task")) {
      // Dynamic imports for all task models to avoid heavy memory load unless needed
      const [SmmTask, SeoTask, ContentTask, SalesTask, CreativeTask] = await Promise.all([
        import("../models/SmmTask.js").then(m => m.default),
        import("../models/SeoTask.js").then(m => m.default),
        import("../models/ContentTask.js").then(m => m.default),
        import("../models/SalesTask.js").then(m => m.default),
        import("../models/CreativeTask.js").then(m => m.default)
      ]);

      const [smm, seo, content, sales, creative] = await Promise.all([
        SmmTask.find().select("-description -url").sort({createdAt: -1}).limit(50).populate("employeeId", "name").lean(),
        SeoTask.find().select("-description -url").sort({createdAt: -1}).limit(50).populate("employeeId", "name").lean(),
        ContentTask.find().select("-description -url").sort({createdAt: -1}).limit(50).populate("employeeId", "name").lean(),
        SalesTask.find().select("-description -url").sort({createdAt: -1}).limit(50).populate("employeeId", "name").lean(),
        CreativeTask.find().select("-description -url").sort({createdAt: -1}).limit(50).populate("employeeId", "name").lean()
      ]);

      context.tasks = { smm, seo, content, sales, creative };
    }

    const systemPrompt = `You are a Business Intelligence assistant for the GoalX CRM system. 
Based on the conversation, here is the relevant project data fetched from the database:
${JSON.stringify(context)}

If the context above is empty ({}), it means no relevant keywords (employee, company, target, task) were detected. In that case, ask the user to clarify what they want to know about.
Your job is to answer questions strictly using the data provided in this context. If the user asks about something not in the context, say you do not have that information.
Keep your responses professional, concise, and formatted clearly in Markdown. Do not expose raw MongoDB IDs unless necessary, use the names of employees and companies.`;

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
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (
      response.data &&
      response.data.candidates &&
      response.data.candidates.length > 0
    ) {
      const aiMessageText = response.data.candidates[0].content.parts[0].text;
      
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
    } else {
      res.status(500).json({ error: "No response from Gemini API" });
    }
  } catch (error) {
    console.error("Error in BI Chat:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
