import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { IntelligenceMode, AppMode } from "../types.ts";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-3-flash-preview';
const REASONING_MODEL = 'gemini-3-pro-preview'; 

export async function extractNeuralMemory(history: string[]): Promise<string> {
  const key = process.env.API_KEY;
  if (!key || history.length === 0) return "Awaiting input for latent extraction...";
  const ai = new GoogleGenAI({ apiKey: key });
  
  const instruction = `Summarize the visual style, recurrent subjects, and specific constraints (e.g. 'always full sleeves') in these prompts: ${history.join(' | ')}`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: instruction,
    });
    return response.text?.trim() || "Identity context established.";
  } catch (e) {
    return "Neural buffer sync error.";
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

  // --- FORENSIC ANATOMY & PHYSICS LAYER ---
  
  // 1. Temperature Control: Lower temperature significantly for high strictness to prevent hallucinations (6 fingers, long arms).
  const effectiveTemperature = (config.strictness && config.strictness > 0.85) ? 0.20 : (config.temperature ?? 0.6);

  // 2. Texture & Lighting Physics (Fixes "Plastic Skin")
  // We force Subsurface Scattering (SSS) to make skin look organic, not like a doll.
  const physicsPrompt = `
    [PHYSICS ENGINE]
    - SKIN TEXTURE: Apply Subsurface Scattering (SSS). Skin must absorb and scatter light. NO PLASTIC/WAXY SHINE. 
    - MICRO-DETAILS: Visible pores, slight skin imperfections, natural skin texture. Match the ISO noise of the background.
    - LIGHTING: Directional lighting must match the base image source (Sun/Window). Shadows must fall in the same direction as the Mother's shadows.
  `;

  // 3. Anatomical Anchors (Fixes Eyes, Ring, Mouth)
  const anatomyPrompt = `
    [FORENSIC ANATOMY RULES - CRITICAL]
    1. **EYES (GAZE LOCK)**: 
       - STRABISMUS CHECK: Both pupils MUST focus on the exact same point (Camera Lens). 
       - No wandering eyes. Irises must be symmetrical.
    2. **MOUTH (LIP SEAL)**: 
       - If prompt says "closed mouth" or "slight smile": UPPER AND LOWER LIPS MUST TOUCH. 
       - **ABSOLUTELY NO TEETH VISIBLE.**
       - Expression: Calm, pleasant, sealed lips.
    3. **HANDS & JEWELRY**:
       - Ring Location: **RIGHT HAND, RING FINGER ONLY**. (The finger between the little finger and middle finger).
       - Do not put rings on the Index finger.
       - EXACTLY 5 FINGERS. No hallucinations.
    4. **HAIR**:
       - Voluminous, natural flow. Match the density of the Identity Seed.
    
    [CLOTHING PHYSICS]
    - **SLEEVES**: If "Kurta" or "Suit" is specified, sleeves must be **LONG (WRIST LENGTH)**. Fabric should bunch naturally at the wrist.
  `;

  // 4. Protection Layer (Fixes Mother's Face Changing)
  const protectionPrompt = `
    [BASE IMAGE PROTECTION]
    - **DO NOT MODIFY THE MOTHER**. The person currently in the photo (Mother) is anchors. Do not smooth her face, do not change her lighting.
    - Insert the new subject (Pari) *around* the Mother without touching the Mother's pixels.
  `;

  const finalPrompt = `
    Role: Senior VFX Compositor. Task: Photorealistic Subject Insertion.

    USER INSTRUCTION: "${prompt}"

    ${protectionPrompt}
    ${anatomyPrompt}
    ${physicsPrompt}

    SPATIAL INSTRUCTION:
    - Subject (Pari) is standing to the LEFT of the Mother.
    - Distance: Maintain a distinct gap (approx 1.5 feet). DO NOT OVERLAP BODIES unless specified.
    - Height: Subject is slightly taller than Mother (Natural scale).

    ${config.memoryContext ? `NEURAL MEMORY: ${config.memoryContext}` : ""}
    
    FINAL RENDER CHECK:
    - Are teeth invisible? (Yes/No) -> Must be Yes.
    - Is the ring on the Right Ring Finger? (Yes/No) -> Must be Yes.
    - Is the Mother's face unchanged? (Yes/No) -> Must be Yes.
  `;

  const parts: any[] = images.map(img => ({
    inlineData: { data: img.split(',')[1] || img, mimeType: 'image/jpeg' }
  }));

  parts.push({ text: finalPrompt.trim() });

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: { parts },
    config: {
      temperature: effectiveTemperature, 
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