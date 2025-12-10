// routes/ai.js
import express from "express";
import multer from "multer";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
dotenv.config();

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const { AUTH_SECRET, GROQ_API_KEY } = process.env;
if (!AUTH_SECRET || !GROQ_API_KEY) {
  console.error("❌ Missing Groq API Key or Auth Secret in .env file");
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

const generateResumePrompt = (resumeText, jobDescription) => {
  const basePrompt = `
    You are an expert AI resume analyzer. Your task is to analyze the provided resume text and return a structured JSON object.
    
    1. matching_analysis: Analyze the resume against the job description (strengths & gaps). If no job description is provided, give a general analysis.
    2. description: A concise summary of the candidate's professional profile based on the resume.
    3. score: A general compatibility score (0-100) for a typical role matching the skills.
    4. skill_match_score: If a job description is provided, a score (0-100) for how well skills match. Otherwise, set to null.
    5. recommendation: Actionable advice to improve the resume.

    Output ONLY the valid JSON object. Do not include any other text or markdown formatting.
  `;

  const context = jobDescription 
    ? `A job description is provided for context: "${jobDescription}"`
    : `No job description was provided. Perform a general analysis.`;

  return `
    ${basePrompt}
    ${context}

    Here is the extracted text from the user's CV:
    ---
    ${resumeText}
    ---
  `;
};

// --- ROUTES ---

// 1. Resume Analyzer Route (Using Groq with dynamic pdf-parse import)
router.post("/upload-resume", upload.single("file"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || authHeader !== AUTH_SECRET) {
      return res.status(401).json({ error: "Unauthorized or invalid secret." });
    }

    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    // DYNAMIC IMPORT FIX: Import pdf-parse at runtime
    const pdf = (await import("pdf-parse")).default;

    // Step 1: Extract text from the PDF buffer
    const pdfData = await pdf(req.file.buffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract text from PDF. The file might be empty or image-based." });
    }

    const jobDescription = req.body.job_description;
    
    // Step 2: Generate the prompt with the extracted text
    const prompt = generateResumePrompt(resumeText, jobDescription);

    // Step 3: Call Groq API (non-streaming for a single JSON response)
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-70b-versatile",
      temperature: 0.2,
    });

    let text = completion.choices[0]?.message?.content || "";

    // Step 4: Robust JSON Extraction
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    } else {
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
    console.error("❌ Error processing resume with Groq:", error);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
});

// 2. Chatbot Route (Genie - No change needed)
router.post("/genie", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || authHeader !== AUTH_SECRET) {
      return res.status(401).json({ error: "Unauthorized or invalid secret." });
    }

    const { query, chat_history } = req.body;
    if (!query) return res.status(400).json({ error: "Query parameter is required." });
    if (!Array.isArray(chat_history)) return res.status(400).json({ error: "chat_history must be a list." });

    const systemMessage = {
      role: "system",
      content: `You are StartX, an AI-powered assistant for the StartX job portal platform.
      
      Key Features:
      1. StartX Platform Guidance: Help users navigate home, login, search, etc.
      2. Career Guidance: Provide expert advice on career paths and resumes.
      3. Irrelevant Queries: Politely decline non-career topics.
      
      Direct users to these links:
      - Home: https://startx-frontend.vercel.app/
      - Search: https://startx-frontend.vercel.app/search
      - Resume AI: https://startx-frontend.vercel.app/resume
      
      Maintain a professional, helpful tone.`
    };

    const messages = [
      systemMessage,
      ...chat_history,
      { role: "user", content: query }
    ];

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
