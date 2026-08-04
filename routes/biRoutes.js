import express from "express";
import axios from "axios";
import User from "../models/User.js";
import Company from "../models/Company.js";
import EmployeeTarget from "../models/EmployeeTarget.js";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    // Fetch context data
    const users = await User.find().select("-password -currentToken").lean();
    const companies = await Company.find().lean();
    const targets = await EmployeeTarget.find()
      .populate("employeeId", "name")
      .populate("managerId", "name")
      .lean();

    const context = {
      users,
      companies,
      targets,
    };

    const systemPrompt = `You are a Business Intelligence assistant for the GoalX CRM system. 
You have access to the following project data (Employees, Companies, and Targets):
${JSON.stringify(context)}

Your job is to answer questions about the employees, their targets, companies, and project details. 
You MUST ONLY respond using the data provided in this context. If the user asks about something not in the context, say you do not have that information.
Keep your responses professional, concise, and formatted clearly in Markdown. Do not expose sensitive IDs unless necessary, use the names of employees and companies.`;

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash:generateContent?key=${geminiApiKey}`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (
      response.data &&
      response.data.candidates &&
      response.data.candidates.length > 0
    ) {
      const aiMessage = response.data.candidates[0].content.parts[0].text;
      res.json({ reply: aiMessage });
    } else {
      res.status(500).json({ error: "No response from Gemini API" });
    }
  } catch (error) {
    console.error("Error in BI Chat:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
