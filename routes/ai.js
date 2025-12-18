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

// Helper: Extract text from PDF using pdfjs-dist
async function extractTextFromPDF(buffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  let fullText = "";

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText.trim();
}

// UPDATED PROMPT: More explicit about text format
const generateResumePrompt = (resumeText, jobDescription) => {
  const basePrompt = `
    You are an expert AI resume analyzer. Your task is to analyze the provided resume text and return a structured JSON object with the following fields:

    1. "matching_analysis": A detailed paragraph (150-200 words) analyzing how well the resume matches the job description. Discuss strengths, gaps, and overall fit. Write in plain English, NOT as a JSON object.

    2. "description": A concise 2-3 sentence summary of the candidate's professional profile.

    3. "score": A numerical score (0-100) representing overall compatibility.

    4. "skill_match_score": A numerical score (0-100) for hard skills match. Set to null if no job description is provided.

    5. "recommendation": A bulleted list of 3-5 actionable recommendations to improve the resume. Format as a plain string with bullet points like this:
       - Recommendation 1
       - Recommendation 2
       - Recommendation 3

    IMPORTANT FORMATTING RULES:
    - "matching_analysis" must be a PLAIN TEXT paragraph, NOT a nested JSON object.
    - "recommendation" must be a PLAIN TEXT string with bullet points, NOT an array or nested object.
    - Output ONLY valid JSON with these exact field names.
    - Do NOT wrap the JSON in markdown code blocks.
  `;

  const context = jobDescription 
    ? `\n\nJob Description Provided:\n"${jobDescription}"\n\nAnalyze the resume against this specific job description.`
    : `\n\nNo job description was provided. Perform a general analysis of the resume's strengths and areas for improvement.`;

  return `
    ${basePrompt}
    ${context}

    Resume Text:
    ---
    ${resumeText}
    ---

    Return the JSON object now:
  `;
};

// --- ROUTES ---

// 1. Resume Analyzer Route
router.post("/upload-resume", upload.single("file"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || authHeader !== AUTH_SECRET) {
      return res.status(401).json({ error: "Unauthorized or invalid secret." });
    }

    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    let resumeText;
    try {
      resumeText = await extractTextFromPDF(req.file.buffer);
    } catch (pdfError) {
      console.error("PDF parsing error:", pdfError);
      return res.status(400).json({ error: "Failed to parse PDF file. It might be corrupted or password-protected." });
    }

    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract text from PDF. The file might be empty or image-based." });
    }

    console.log("✅ Extracted text length:", resumeText.length);

    const jobDescription = req.body.job_description;
    
    // Step 2: Generate the prompt with the extracted text
    const prompt = generateResumePrompt(resumeText, jobDescription);

    // Step 3: Call Groq API
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile", 
      temperature: 0.2,
      max_tokens: 2000, // Increased for longer analysis
    });

    let text = completion.choices[0]?.message?.content || "";

    // Step 4: Robust JSON Extraction
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    } else {
      // Fallback: remove markdown code blocks
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
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
