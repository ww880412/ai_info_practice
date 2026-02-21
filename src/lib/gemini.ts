import { GoogleGenerativeAI } from "@google/generative-ai";

function getApiKey(): string {
  // First check localStorage (user configured)
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("ai-practice-config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.geminiApiKey) {
          return parsed.geminiApiKey;
        }
      } catch {
        // Ignore
      }
    }
  }
  // Fallback to environment variable
  return process.env.GEMINI_API_KEY || "";
}

function getModel(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("ai-practice-config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.geminiModel) {
          return parsed.geminiModel;
        }
      } catch {
        // Ignore
      }
    }
  }
  return process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
}

let genAI: GoogleGenerativeAI | null = null;
let currentModel: string = "";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = getApiKey();
  if (!genAI || apiKey !== process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export function getGeminiModel() {
  const model = getModel();
  if (currentModel !== model || !genAI) {
    genAI = getGenAI();
    currentModel = model;
  }
  return genAI.getGenerativeModel({ model });
}

/**
 * Generate structured JSON output from text prompt.
 */
export async function generateJSON<T>(prompt: string): Promise<T> {
  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
  return JSON.parse(result.response.text());
}

/**
 * Generate structured JSON output from file (PDF/image) + text prompt.
 */
export async function generateFromFile<T>(
  prompt: string,
  fileData: { base64: string; mimeType: string }
): Promise<T> {
  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: fileData.base64,
              mimeType: fileData.mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
  return JSON.parse(result.response.text());
}
