import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { IntelligenceMode, AppMode } from "../types.ts";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-3-flash-preview';
const REASONING_MODEL = 'gemini-3-pro-preview'; 

export async function extractNeuralMemory(history: string[]): Promise<string> {
  const key = process.env.API_KEY;
  if (!key || history.length === 0) return "Awaiting input for latent extraction...";
  const ai = new GoogleGenAI({ apiKey: key });
  
  const instruction = `SYSTEM: BIOMETRIC ANCHOR
  Analyze history for identity traits. Focus on preservation of names and facial structure.
  DATA: ${history.join(' | ')}
  OUTPUT: Technical summary of identity constraints.`;

  try {
    const response = await ai.models.generateContent({
      model: REASONING_MODEL,
      contents: instruction,
      config: { temperature: 0.1, thinkingConfig: { thinkingBudget: 2048 } }
    });
    return response.text?.trim() || "Biometric pattern locked.";
  } catch (e) {
    return "Neural buffer sync error.";
  }
}

async function optimizePromptWithReasoning(
  userPrompt: string, 
  memory: string, 
  settings: { strictness: number; faceFidelity: number; temperature: number; variation: number; stylePreset?: string }
): Promise<string> {
  const key = process.env.API_KEY;
  if (!key) return userPrompt;
  const ai = new GoogleGenAI({ apiKey: key });

  // UPDATED LOGIC: Strict Spatial & Identity Enforcement
  const instruction = `SYSTEM: SPATIAL DIRECTOR & IDENTITY GUARDIAN
  USER REQUEST: "${userPrompt}"
  ENGINE PARAMS: Face Fidelity: ${settings.faceFidelity}, Strictness: ${settings.strictness}

  CRITICAL OBJECTIVES:
  1. SPATIAL OBEDIENCE (HIGHEST PRIORITY): 
     - If user says "Left", place subject on the LEFT side of the frame.
     - If user says "Right", place subject on the RIGHT side of the frame.
     - If user says "Far" or "Distance", scale the subject DOWN to simulate depth. Do NOT place them in the foreground.
     - If user says "Close", place them in foreground.
     - IF A SPATIAL INSTRUCTION EXISTS, IT IS LAW. Do not auto-center the subject.

  2. IDENTITY LOCK: 
     - The @seed identity (face) MUST NOT CHANGE. Do not blend their face with people already in the background.
     - Treat the identity as a rigid asset.
  
  3. PROMPT LITERALISM:
     - ONLY do what is asked.
     - If the prompt does NOT mention smiling, do NOT add a smile.
     - If the prompt does NOT mention looking at the camera, do NOT force eye contact.
     - Respect "Non-Negotiables" implicitly.

  4. PHOTOREALISM:
     - Match lighting direction and hardness/softness of the base image exactly.
     - Match noise/grain.
  
  OUTPUT FORMAT:
  Produce a structured technical prompt for the generator that explicitly defines:
  - COMPOSITION: [Exact coordinates/placement]
  - SCALE: [Distance from camera]
  - LIGHTING: [Direction, Temp, Hardness]
  - SUBJECT: [Identity, Clothing, Pose]
  - NEGATIVE: [What to avoid]`;

  try {
    const response = await ai.models.generateContent({
      model: REASONING_MODEL,
      contents: instruction,
      config: { temperature: 0.1, thinkingConfig: { thinkingBudget: 4096 } }
    });
    return response.text?.trim() || userPrompt;
  } catch (e) {
    return userPrompt;
  }
}

export async function generateImage(
  prompt: string, 
  images: string[] = [], 
  config: { 
    aspectRatio?: string,
    imageSize?: string,
    temperature?: number,
    variation?: number,
    faceFidelity?: number,
    strictness?: number,
    memoryContext?: string,
    stylePreset?: string
  }
) {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API Key required.");
  const ai = new GoogleGenAI({ apiKey: key });
  
  const optimizedPrompt = await optimizePromptWithReasoning(prompt, config.memoryContext || "", {
    strictness: config.strictness ?? 0.8,
    faceFidelity: config.faceFidelity ?? 0.9,
    temperature: config.temperature ?? 0.8,
    variation: config.variation ?? 0.5,
    stylePreset: config.stylePreset
  });

  const parts: any[] = images.map(img => ({
    inlineData: { data: img.split(',')[1] || img, mimeType: 'image/jpeg' }
  }));

  // UPDATED PROMPT STRUCTURE: Forced Adherence
  parts.push({ text: `
    TASK: STRICT PHOTOREALISTIC COMPOSITING
    
    EXECUTION PLAN:
    ${optimizedPrompt}
    
    ABSOLUTE LAWS:
    1. SPATIAL ACCURACY: If the plan says "Right", the subject MUST be on the right. If "Far", they MUST be small/distant.
    2. IDENTITY PRESERVATION: The face from the seed image must be preserved with 100% fidelity. Do not warp or "beautify" it into a generic AI face.
    3. NO HALLUCINATIONS: Do not add accessories, smiles, or poses not requested in the prompt.
    4. LIGHTING MATCH: Lighting on the subject must perfectly match the background plate (direction, intensity, color).
    5. BLENDING: Subject edges must blur/grain match the background quality.
  ` });

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: { parts },
    config: {
      temperature: config.temperature ?? 0.7, 
      imageConfig: {
        aspectRatio: (config.aspectRatio === "Original" ? "16:9" : config.aspectRatio || "1:1") as any,
        imageSize: (config.imageSize || "1K") as any
      }
    }
  });

  const outputImages: string[] = [];
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) outputImages.push(`data:image/png;base64,${part.inlineData.data}`);
    }
  }
  return { images: outputImages };
}

export async function chatWithSearch(prompt: string, images: string[] = [], history: any[] = [], modes: IntelligenceMode[] = []) {
  const key = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: key });
  const model = modes.includes(IntelligenceMode.REASONING) ? REASONING_MODEL : TEXT_MODEL;
  const parts: any[] = images.map(img => ({ inlineData: { data: img.split(',')[1] || img, mimeType: 'image/jpeg' } }));
  parts.push({ text: prompt });
  const contents = [...history, { role: 'user', parts }];
  const config: any = { temperature: 0.7 };
  if (modes.includes(IntelligenceMode.RESEARCH)) config.tools = [{ googleSearch: {} }];
  if (modes.includes(IntelligenceMode.REASONING)) config.thinkingConfig = { thinkingBudget: 4096 };
  const response = await ai.models.generateContent({ model, contents, config });
  return { text: response.text || "", grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c.web).filter(Boolean) || [] };
}