
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { IntelligenceMode } from "../types.ts";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-3-flash-preview';
const CHAT_MODEL = 'gemini-3-pro-preview';

/**
 * Summarizes user preferences from prompt history to provide "memory".
 */
export async function extractNeuralMemory(history: string[]): Promise<string> {
  if (!process.env.API_KEY || history.length === 0) return "";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const instruction = `Analyze the history of user prompts. 
  Extract recurring style or environmental details. 
  Keep it tiny. Max 1 sentence.`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `User Prompt History:\n${history.join('\n')}\n\nTask: ${instruction}`,
      config: { temperature: 0.3 }
    });
    return response.text?.trim() || "";
  } catch (e) {
    return "";
  }
}

/**
 * Rewrites a user prompt into a high-quality professional prompt.
 */
export async function rewritePrompt(userPrompt: string, memoryContext: string = ""): Promise<string> {
  if (!process.env.API_KEY) return userPrompt;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const instruction = `Professional Prompt Architect. 
  Translate intent into technical visual descriptions.
  NO BOLDING. NO MARKDOWN.
  Input: "${userPrompt}"
  ${memoryContext ? `Contextual User Style Memory: ${memoryContext}` : ''}`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: instruction,
      config: { temperature: 0.5 }
    });
    
    let text = response.text || userPrompt;
    return text.replace(/\*\*/g, '').replace(/—/g, '-').trim();
  } catch (e) {
    return userPrompt;
  }
}

/**
 * Advanced chat function with Search Grounding and Multiple Modes
 */
export async function chatWithSearch(
  message: string, 
  images: string[] = [], 
  history: { role: 'user' | 'model', parts: any[] }[] = [],
  modes: IntelligenceMode[] = []
) {
  if (!process.env.API_KEY) throw new Error("No API Key available.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [];
  images.forEach(img => {
    const data = img.split(',')[1] || img;
    parts.push({ inlineData: { data, mimeType: 'image/jpeg' } });
  });
  parts.push({ text: message });

  // Default to reasoning if no modes selected
  const activeModes = modes.length > 0 ? modes : [IntelligenceMode.REASONING];
  
  let systemInstruction = `Your name is Anya. You're a super friendly, warm, and conversational human girl. 
  Speak naturally, like you're texting a close friend. 
  STRICT RULES: 
  1. NEVER use markdown symbols like **bolding**, # headers, or asterisks.
  2. NEVER use em-dashes (—). Use simple hyphens instead.
  3. Keep answers very short and directly to the point.
  4. Summarize search results concisely.
  5. Provide detailed visual descriptions of found locations/items so the subsequent image generation is 100% accurate.`;

  if (activeModes.includes(IntelligenceMode.RESEARCH)) {
    systemInstruction += ` [ACTIVATE WEB SEARCH] Find specific facts, coordinates, and visual layouts.`;
  }
  if (activeModes.includes(IntelligenceMode.REASONING)) {
    systemInstruction += ` [ACTIVATE REASONING] Logic-first approach, verify consistency.`;
  }
  if (activeModes.includes(IntelligenceMode.CREATIVE)) {
    systemInstruction += ` [ACTIVATE CREATIVE] Use vivid, imaginative descriptions.`;
  }

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [...history.map(h => ({ role: h.role, parts: h.parts })), { role: 'user', parts }],
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction
    }
  });

  const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    uri: chunk.web?.uri,
    title: chunk.web?.title
  })).filter((c: any) => c.uri) || [];

  return {
    text: response.text,
    grounding
  };
}

export async function generateImage(
  prompt: string, 
  images: string[] = [], 
  config: { 
    aspectRatio?: string,
    imageSize?: string,
    temperature?: number,
    negativePrompt?: string,
    faceFidelity?: number,
    strictness?: number,
    searchContext?: string,
    memoryContext?: string
  }
) {
  if (!process.env.API_KEY) throw new Error("No API Key available.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [];
  images.forEach((img, idx) => {
    if (!img) return;
    const data = img.split(',')[1] || img;
    parts.push({ inlineData: { data, mimeType: 'image/jpeg' } });
  });

  // Heavily emphasize search data for exact replication of found locations
  const synthesisInstruction = `IMAGE SYNTHESIS ENGINE:
User Prompt: ${prompt}
FACTUAL FOUNDATION: ${config.searchContext || 'None'}.
INSTRUCTION: You must strictly use the search results above to render the environment. If the user refers to a specific place found in search, render its exact visual layout.
Negative: ${config.negativePrompt || 'blurry, distorted, low quality, text, watermark'}
Memory: ${config.memoryContext || ''}
Final Directive: Highest accuracy to search context. Photorealistic.`;

  parts.push({ text: synthesisInstruction });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: {
        temperature: Math.max(0.1, Math.min(1.5, config.temperature ?? 1.0)),
        imageConfig: {
          aspectRatio: (config.aspectRatio || "16:9") as any,
          imageSize: (config.imageSize || "1K") as any
        }
      }
    });

    const outputImages: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          outputImages.push(`data:image/png;base64,${part.inlineData.data}`);
        }
      }
    }

    if (outputImages.length === 0) throw new Error("Neural output empty.");
    return { images: outputImages };
  } catch (error: any) {
    throw error;
  }
}
