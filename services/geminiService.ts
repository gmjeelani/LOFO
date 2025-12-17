import { GoogleGenAI, Type } from "@google/genai";
import { ItemPost } from "../types";

// Initialize Gemini
// using process.env.API_KEY as required for secure execution
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const findPotentialMatch = async (newItem: ItemPost, existingItems: ItemPost[]): Promise<{ matchedId: string | null; confidence: number; reason: string }> => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key missing. Skipping intelligent matching.");
    return { matchedId: null, confidence: 0, reason: "API Key missing" };
  }

  // Filter only opposite types (Lost vs Found) and generally same city to save tokens/logic
  const candidates = existingItems.filter(
    (item) => item.type !== newItem.type && item.city === newItem.city && item.status === 'OPEN'
  );

  if (candidates.length === 0) {
    return { matchedId: null, confidence: 0, reason: "No candidates found in same city." };
  }

  const prompt = `
    I need to match a newly posted item with existing lost/found items.
    
    NEW ITEM:
    ${JSON.stringify({
      title: newItem.title,
      description: newItem.description,
      category: newItem.category,
      area: newItem.area,
      date: newItem.date
    })}

    EXISTING CANDIDATES:
    ${JSON.stringify(candidates.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      area: c.area,
      date: c.date
    })))}

    Compare the NEW ITEM against the CANDIDATES. 
    Look for similarities in item type, description details, and location.
    
    Return a JSON object with:
    - matchedId: string (ID of the best match, or null if no match > 50% probable)
    - confidence: number (0-100)
    - reason: string (Short explanation)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedId: { type: Type.STRING, nullable: true },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      return result;
    }
  } catch (error) {
    console.error("Gemini Matching Error:", error);
  }

  return { matchedId: null, confidence: 0, reason: "Error during analysis" };
};