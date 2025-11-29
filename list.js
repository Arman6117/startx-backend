import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ Error: GOOGLE_GEMINI_API_KEY is missing in .env file");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listAvailableModels() {
  try {
    console.log("🔄 Fetching available models for your API key...");
    
    // Direct fetch to the API endpoint to bypass SDK version issues
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log("\n✅ AVAILABLE MODELS:");
    console.log("------------------------------------------------");
    
    const contentModels = data.models.filter(m => 
      m.supportedGenerationMethods.includes("generateContent")
    );

    if (contentModels.length === 0) {
      console.log("⚠️ No models found that support 'generateContent'. Your API key might be restricted.");
    } else {
      contentModels.forEach(model => {
        console.log(`Name: ${model.name.replace("models/", "")}`);
        console.log(`Description: ${model.displayName}`);
        console.log("------------------------------------------------");
      });
    }

  } catch (error) {
    console.error("❌ Failed to list models:", error.message);
  }
}

listAvailableModels();
