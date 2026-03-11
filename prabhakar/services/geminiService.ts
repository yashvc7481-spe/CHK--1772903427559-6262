import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GrievanceCategory } from "../types";

// In Vite/browser builds, use a VITE_ prefixed env var (import.meta.env) instead of process.env.
// Create a `.env` file with: VITE_API_KEY=your_key_here
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Refines a rough draft of a grievance into a professional complaint.
 */
export const refineGrievanceText = async (draft: string): Promise<string> => {
  if (!draft || draft.trim().length < 10) return draft;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Rewrite the following student grievance text to be professional, clear, and concise, suitable for submission to a university administration. Maintain the original meaning and facts. Text: "${draft}"`,
    });
    return response.text || draft;
  } catch (error) {
    console.error("Error refining text:", error);
    return draft;
  }
};

/**
 * Analyzes a grievance to provide summary, sentiment, and suggested priority.
 */
export const analyzeGrievance = async (title: string, description: string) => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analyze this student grievance. Title: "${title}". Description: "${description}". Provide a brief summary, sentiment (Positive, Neutral, Negative, Urgent), and suggested priority (High, Medium, Low).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative", "Urgent"] },
            suggestedPriority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
          },
          required: ["summary", "sentiment", "suggestedPriority"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No text returned from Gemini");
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error analyzing grievance:", error);
    return {
      summary: "Analysis unavailable",
      sentiment: "Neutral",
      suggestedPriority: "Medium",
    };
  }
};

/**
 * Suggests a category based on the content.
 */
export const suggestCategory = async (text: string): Promise<GrievanceCategory> => {
  try {
    const categories = Object.values(GrievanceCategory);
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Classify the following grievance text into exactly one of these categories: ${categories.join(', ')}. Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, enum: categories },
          },
        },
      },
    });
    
    const result = JSON.parse(response.text || "{}");
    return result.category as GrievanceCategory || GrievanceCategory.OTHER;
  } catch (error) {
    console.error("Error suggesting category:", error);
    return GrievanceCategory.OTHER;
  }
};
