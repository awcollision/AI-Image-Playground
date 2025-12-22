
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-3-flash-preview';

/**
 * Summarizes user preferences from prompt history to provide "memory".
 */
export async function extractNeuralMemory(history: string[]): Promise<string> {
  if (!process.env.API_KEY || history.length === 0) return "";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const instruction = `Analyze the following sequence of image generation prompts. 
  Extract recurring style preferences, character traits, or environmental details that the user seems to prefer. 
  Keep the summary very concise (max 2 sentences).
  
  HISTORY:
  ${history.join('\n')}
  
  SUMMARY OF PREFERENCES:`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: instruction,
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
  
  const instruction = `You are a professional AI Prompt Architect. 
  Transform the user's messy prompt into a single, cinematic, technically detailed prompt.
  
  ${memoryContext ? `NEURAL MEMORY CONTEXT (Prioritize these recurring preferences): ${memoryContext}` : ""}

STRICT RULES:
1. OUTPUT ONLY THE REWRITTEN PROMPT TEXT. 
2. NO HEADERS, NO BOLDING, NO EXPLANATIONS.
3. PRESERVE ALL DETAILS AND RETAIN TAGS: Keep @image1, @image2, @image3, @image4, @image5, and all @SeedName mentions exactly as they are.

User's Original Input: "${userPrompt}"`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: instruction,
      config: { temperature: 0.5 }
    });
    
    let text = response.text || userPrompt;
    text = text.replace(/\*\*/g, '')
               .replace(/^(Professional AI Prompt:|Prompt:|Refined Prompt:|AI Prompt:|Output:|Result:)/i, '')
               .trim();
    return text;
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
    negativePrompt?: string,
    faceFidelity?: number,
    memoryContext?: string,
    cameraAngle?: string,
    pose?: string
  }
) {
  if (!process.env.API_KEY) throw new Error("API_KEY is missing.");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const fidelity = config.faceFidelity ?? 0.8;
  const fidelityInstruction = fidelity > 0.8 
    ? "STRICT IDENTITY LOCK: PRESERVE BIOMETRIC FEATURES OF HUMAN SUBJECTS EXACTLY. DO NOT AGE, CHANGE ETHNICITY, OR ALTER FACIAL STRUCTURE."
    : "Maintain similarity while blending lighting and pose.";

  const perspectiveModifiers = [];
  if (config.cameraAngle && config.cameraAngle !== 'Default') perspectiveModifiers.push(`Camera Angle: ${config.cameraAngle}`);
  if (config.pose && config.pose !== 'Default') perspectiveModifiers.push(`Pose: ${config.pose}`);

  const parts: any[] = [
    { 
      text: `SYSTEM ARCHITECTURE: NANO BANANA PRO V3.5.
      
      CORE DIRECTIVES:
      1. FIDELITY LOCK [STRENGTH: ${fidelity}]: ${fidelityInstruction}
      2. PERSPECTIVE: ${perspectiveModifiers.join(', ') || 'Natural perspective.'}
      3. ENVIRONMENT RIGIDITY: Respect the context of uploaded source images.
      4. NEURAL MEMORY: ${config.memoryContext || "None active."}
      5. NEGATIVE SYNTHESIS FILTER: ${config.negativePrompt || "None"}
      6. PHOTOREALISM: Cinematic, RAW quality, 8k resolution.
      
      PROMPT: ${prompt}` 
    }
  ];
  
  images.forEach((img) => {
    if (!img) return;
    const mimeType = img.includes('image/png') ? 'image/png' : 'image/jpeg';
    const data = img.split(',')[1] || img;
    parts.push({ inlineData: { data, mimeType } });
  });

  const validRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
  const finalAspectRatio = (config.aspectRatio && validRatios.includes(config.aspectRatio)) ? config.aspectRatio : '1:1';

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: {
        temperature: config.temperature ?? 1.0,
        imageConfig: {
          aspectRatio: finalAspectRatio as any,
          imageSize: (config.imageSize || "1K") as any
        }
      }
    });

    const outputImages: string[] = [];
    if (response.candidates) {
      response.candidates.forEach(candidate => {
        candidate.content?.parts?.forEach(part => {
          if (part.inlineData?.data) {
            outputImages.push(`data:image/png;base64,${part.inlineData.data}`);
          }
        });
      });
    }

    return { images: outputImages };
  } catch (error: any) {
    throw error;
  }
}
