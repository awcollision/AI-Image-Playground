
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { IntelligenceMode, AppMode } from "../types.ts";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-3-flash-preview';
const REASONING_MODEL = 'gemini-3-pro-preview'; 

async function retryOperation<T>(operation: () => Promise<T>, retries = 5, delay = 4000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && (error.status === 503 || error.message?.includes('overloaded') || error.code === 503)) {
      console.warn(`Model overloaded. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2); 
    }
    throw error;
  }
}

export async function refineNeuralWeights(
  currentWeights: string, 
  lastPrompt: string, 
  feedbackType: 'like' | 'dislike'
): Promise<string> {
  const key = process.env.API_KEY;
  if (!key) return currentWeights;
  const ai = new GoogleGenAI({ apiKey: key });

  const instruction = `
    You are the "Neural Feedback Optimizer". 
    
    CURRENT STATE: "${currentWeights}"
    ACTION: User ${feedbackType.toUpperCase()}D the last output for prompt: "${lastPrompt}"

    CRITICAL UPDATE RULES:
    1. IF LIKE:
       - Output: "MAINTAIN EXACT STYLE. LOCK current Lighting/Texture parameters. User approved this specific latent direction."
    
    2. IF DISLIKE:
       - Analyze the prompt for common failures (distortion, poor framing, unwanted features).
       - Output a "NEGATIVE_BIAS" instruction. Example: "AVOID [SPECIFIC ARTIFACT]. Do not repeat the lighting/pose from the previous iteration. Shifting latent space to alternative interpretation."

    Output ONLY the new weight string. Be concise.
  `;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: instruction,
    });
    return response.text?.trim() || currentWeights;
  } catch (e) {
    return currentWeights;
  }
}

export async function extractNeuralMemory(history: string[]): Promise<string> {
  return "Neural Active: Learning from interactions..."; 
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
    microDetailBias?: number,
    memoryContext?: string,
    stylePreset?: string
  }
) {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API Key required.");
  const ai = new GoogleGenAI({ apiKey: key });

  const styleInjection = `
    [ROLE: PRECISION BIOMETRIC COMPOSITOR]
    
    [NEURAL PREFERENCE - MANDATORY OVERRIDE]
    ${config.memoryContext || "Mode: Neutral."}

    [BIOMETRIC_LOCK_PROTOCOL]
    - Treat all Face/Identity references as IMMUTABLE MASTER KEYS.
    - Do not alter the bone structure, eye shape, or specific facial proportions of the references.
    - Even if a reference is blurry, use its structural "DNA" to reconstruct a high-definition version of that EXACT person.
    - FACE FIDELITY WEIGHT: ${config.faceFidelity || 0.95} (Enforce strict identity locking).

    [CAMERA_KINETICS & CENTERING]
    - If subject is cut off on the edge, pan the camera to center them. 
    - Subject must be clearly visible from both sides. Equidistant framing.

    [BIOMETRIC_SYMMETRY]
    - Force bilateral symmetry for eyes. 
    - Left eye and Right eye must share identical pupil vectors and scale.
    - Focus: ${config.strictness || 0.8} alignment.

    [SCENE CONTEXT]
    - Integrate the subject naturally into the background defined as: "${prompt}".
    - Match ISO, White Balance, and Light Direction to the scene, but LOCK the facial features.
  `;

  const parts: any[] = images.map(img => {
    const match = img.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const mimeType = match ? match[1] : 'image/jpeg';
    const data = img.split(',')[1] || img;
    return { inlineData: { data, mimeType } };
  });

  parts.push({ text: `TASK: ${prompt}\n\n${styleInjection}` });

  const safeImageSize = config.imageSize === "8K" ? "4K" : (config.imageSize || "1K");
  let targetRatio = config.aspectRatio === "Original" ? "16:9" : (config.aspectRatio || "1:1");
  const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  const ratioMap: Record<string, string> = { "1:2": "9:16", "2:3": "3:4", "3:2": "4:3", "4:5": "3:4", "5:4": "4:3", "21:9": "16:9" };
  
  if (ratioMap[targetRatio]) targetRatio = ratioMap[targetRatio];
  if (!validRatios.includes(targetRatio)) targetRatio = "1:1";

  const response = await retryOperation(async () => {
    return await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: {
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' }
        ],
        imageConfig: {
          aspectRatio: targetRatio as any,
          imageSize: safeImageSize as any
        }
      }
    });
  });

  if (response.promptFeedback?.blockReason) {
    const reason = response.promptFeedback.blockReason;
    if (reason === 'PROHIBITED_CONTENT' || reason === 'SAFETY') {
        throw new Error("Generation blocked: Safety policies triggered. Please refine your prompt.");
    }
    throw new Error(`Generation blocked: ${reason}.`);
  }

  const outputImages: string[] = [];
  const candidate = response.candidates?.[0];

  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        outputImages.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }
  }

  if (outputImages.length === 0) throw new Error("Synthesis failure. No image returned.");
  return { images: outputImages };
}

export async function chatWithSearch(prompt: string, images: string[] = [], history: any[] = [], modes: IntelligenceMode[] = []) {
  const key = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: key });
  const model = modes.includes(IntelligenceMode.REASONING) ? REASONING_MODEL : TEXT_MODEL;
  const parts: any[] = images.map(img => {
     const match = img.match(/^data:(image\/[a-zA-Z]+);base64,/);
     const mimeType = match ? match[1] : 'image/jpeg';
     const data = img.split(',')[1] || img;
     return { inlineData: { data, mimeType } };
  });
  parts.push({ text: prompt });
  const contents = [...history, { role: 'user', parts }];
  const config: any = { temperature: 0.7 };
  if (modes.includes(IntelligenceMode.RESEARCH)) config.tools = [{ googleSearch: {} }];
  if (modes.includes(IntelligenceMode.REASONING)) config.thinkingConfig = { thinkingBudget: 4096 };
  const response = await retryOperation(async () => {
    return await ai.models.generateContent({ model, contents, config });
  });
  return { 
    text: response.text || "", 
    grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c.web).filter(Boolean) || [] 
  };
}
