// routes/ai.js
import express from "express";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import dns from "node:dns";

// Force IPv4 to prevent fetch failures on some networks
dns.setDefaultResultOrder("ipv4first");

dotenv.config();
const router = express.Router();

// Configure Multer (5MB limit)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Environment Check
const { AUTH_SECRET, GROQ_API_KEY, GOOGLE_GEMINI_API_KEY } = process.env;

if (!AUTH_SECRET || !GROQ_API_KEY || !GOOGLE_GEMINI_API_KEY) {
  console.error("❌ Missing API Keys in .env file");
}

// Initialize Clients
const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);

// Use the model that appeared in your list
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Helper: Generate Prompt
const generatePrompt = (jobDescription) => {
  const basePrompt = `
    You are an advanced AI model designed to analyze the compatibility between a CV and a job description. 
    Your task is to output a structured JSON format.
    
    1. matching_analysis: Analyze the CV against the job description (strengths & gaps).
    2. description: Summary of relevance.
    3. score: Numerical compatibility score (0-100).
    4. skill_match_score: Numerical score (0-100) for hard skills.
    5. recommendation: Actionable advice.
  `;

  const context = jobDescription 
    ? `Here is the Job Description: ${jobDescription}`
    : `As no job description is provided, analyze the CV generally.`;

  return `
    ${basePrompt}
    ${context}
    The CV is attached. Output ONLY valid JSON inside a code block.
  `;
};

// Helper: Retry Logic for Google AI
const generateContentWithRetry = async (parts, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await model.generateContent(parts);
    } catch (error) {
      // Retry on Rate Limit (429) or Server Error (503)
      if ((error.status === 429 || error.status === 503) && i < retries - 1) {
        console.log(`⚠️ Google AI busy (Attempt ${i + 1}/${retries}). Retrying in 4s...`);
        await new Promise((resolve) => setTimeout(resolve, 4000));
      } else {
        throw error;
      }
    }
  }
};

// --- ROUTES ---

// 1. Resume Analyzer Route
router.post("/upload-resume", upload.single("file"), async (req, res) => {
  try {
    // Auth Check
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || authHeader !== AUTH_SECRET) {
      return res.status(401).json({ error: "Unauthorized or invalid secret." });
    }

    // File Check
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    if (req.file.mimetype !== "application/pdf") return res.status(400).json({ error: "Only PDF files are supported." });

    const jobDescription = req.body.job_description;
    const pdfBase64 = req.file.buffer.toString("base64");
    const prompt = generatePrompt(jobDescription);

    // Call AI with Retry
    const result = await generateContentWithRetry([
      prompt,
      {
        inlineData: {
          data: pdfBase64,
          mimeType: "application/pdf",
        },
      },
    ]);

    const response = await result.response;
    let text = response.text();

    // FIX: Robust JSON Extraction
    // Finds the first { and last } to ignore Markdown wrappers
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        text = jsonMatch[0];
    } else {
        // Fallback cleanup
        text = text.replace(/``````/g, "").trim();
    }

    try {
      const summaryJson = JSON.parse(text);
      return res.json({ summary: summaryJson });
    } catch (e) {
      console.error("❌ JSON Parse Error. Raw Text:", text);
      return res.status(500).json({ error: "Failed to parse AI response as JSON." });
    }

  } catch (error) {
    console.error("❌ Error processing resume:", error);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
});

// 2. Chatbot Route (Genie)
router.post("/genie", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || authHeader !== AUTH_SECRET) {
      return res.status(401).json({ error: "Unauthorized or invalid secret." });
    }

    const { query, chat_history } = req.body;
    if (!query) return res.status(400).json({ error: "Query parameter is required." });
    if (!Array.isArray(chat_history)) return res.status(400).json({ error: "chat_history must be a list." });

    // System Prompt
    const systemMessage = {
      role: "system",
      content: `You are Talx, an AI-powered assistant for the Talx job portal platform.
      
      Key Features:
      1. Talx Platform Guidance: Help users navigate home, login, search, etc.
      2. Career Guidance: Provide expert advice on career paths and resumes.
      3. Irrelevant Queries: Politely decline non-career topics.
      
      Direct users to these links:
      - Home: https://talx.vercel.app/
      - Search: https://talx.vercel.app/search
      - Resume AI: https://talx.vercel.app/resume
      
      Maintain a professional, helpful tone.`
    };

    const messages = [
      systemMessage,
      ...chat_history,
      { role: "user", content: query }
    ];

    // Streaming Headers
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.6,
      max_tokens: 1500,
      top_p: 0.9,
      stream: true,
    });

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || "";
      res.write(content);
    }

    res.end();

  } catch (error) {
    console.error("❌ Error in Chatbot:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
    res.end();
  }
});

export default router;
