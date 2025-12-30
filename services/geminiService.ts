
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { IntelligenceMode, AppMode } from "../types.ts";

const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-3-flash-preview';
const REASONING_MODEL = 'gemini-3-pro-preview'; // Used for deep dwelling on the prompt

/**
 * Summarizes user preferences by calculating the "Current Active State" from history.
 * This acts as the session's short-term memory (RAM).
 */
export async function extractNeuralMemory(history: string[]): Promise<string> {
  if (!process.env.API_KEY || history.length === 0) return "";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Filter out empty prompts from history to avoid noise
  const validHistory = history.filter(h => h && h.trim().length > 0);
  if (validHistory.length === 0) return "";

  const instruction = `SYSTEM: DYNAMIC SESSION MEMORY CORE
  
  OBJECTIVE: Maintain a persistent, evolving mental model of the subject being generated across this session.
  
  INPUT: Chronological User Prompts (Oldest to Newest):
  ${validHistory.map((h, i) => `${i + 1}. "${h}"`).join('\n')}
  
  TASK:
  Synthesize the "Current Active Biometric State".
  1. Start with the first prompt's description.
  2. Apply subsequent prompts as *modifications*, *refinements*, or *overwrites*.
  3. Resolve contradictions by prioritizing the MOST RECENT information (e.g., if Prompt 1 says "long hair" and Prompt 5 says "short hair", the State is "short hair").
  4. Accumulate all details that haven't been contradicted.
  5. Ignore non-descriptive commands like "generate", "again", "fix".
  
  OUTPUT FORMAT:
  A single, highly detailed paragraph describing the subject's physical appearance, clothing, and the image style as it currently stands.
  `;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: instruction,
      config: { temperature: 0.1 }
    });
    return response.text?.trim() || "";
  } catch (e) {
    return "";
  }
}

/**
 * "Dwelling" Phase: Merges the User's "Delta" prompt with the "Base" Memory.
 */
async function optimizePromptWithReasoning(
  userPrompt: string, 
  memory: string, 
  settings: { strictness: number; faceFidelity: number; enableFilmGrain: boolean; stylePreset?: string; mode?: AppMode }
): Promise<string> {
  if (!process.env.API_KEY) return userPrompt;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Interpret sliders into text instructions
  const strictnessInstruction = settings.strictness > 0.8 
    ? "EXTREME ADHERENCE. Do not add creative elements not requested. Follow anatomical instructions exactly." 
    : "Follow the prompt but allow for cinematic lighting enhancements.";
    
  const fidelityInstruction = settings.faceFidelity > 0.85
    ? "BIOMETRIC LOCK: The face structure must be preserved 100%. No reshaping for 'beauty'. Keep original features."
    : "Maintain general resemblance but allow aesthetic improvements.";

  const aiRemovalInstruction = "ANTI-AI FILTER: Skin must have visible pores, slight discoloration, and texture. No 'smooth plastic' skin. Lighting must be physical, not 'glowy'.";

  // New Physics Logic for realistic accessory sizing
  const physicalLogic = `
  PHYSICAL PLAUSIBILITY & SCALE LOGIC:
  - When adding accessories (necklaces, hats, glasses, jewelry), they MUST be sized realistically relative to the subject's biometric proportions.
  - A necklace should follow the curve of the neck/chest and have a realistic chain thickness. Do NOT generate oversized 'cartoonish' jewelry unless explicitly requested.
  - Objects must cast correct shadows on the subject.
  - Depth of Field: Added objects must match the focus plane of the subject.
  `;

  // --- SPECIALIZED GROUP PHOTO LOGIC ---
  const groupPhotoLogic = `
  MODE: GROUP PHOTO COMPOSITING & INSERTION
  
  CRITICAL OBJECTIVE: You are a VFX Compositor. You are NOT creating a new random image. You are MODIFYING a specific Base Scene to add a new Actor (Identity Seed).
  
  RULES OF ENGAGEMENT:
  1. **IDENTIFY BASE SCENE**: Find which image tag in the prompt represents the "Background" or "Environment" (e.g. [ASSET_SOURCE_1] or "in @source1").
     - COMMAND: "Reconstruct the environment of [Base Scene] exactly. Keep existing people in [Base Scene] unchanged unless told otherwise."
  
  2. **IDENTIFY NEW ACTOR**: Find the [IDENTITY_SEED] tag.
     - COMMAND: "Insert [IDENTITY_SEED] into the [Base Scene]."
     - FACE: The inserted actor MUST have the exact face of [IDENTITY_SEED].
     - POSITION: Place them exactly where the prompt says (e.g. "left", "right", "next to X").
  
  3. **ASSET TRANSFER**: If the user says "wearing jacket from [ASSET_SOURCE_2]", extract ONLY the jacket from Source 2 and put it on the New Actor. Do not blend the Source 2 background or face.
  
  4. **LIGHTING MATCH**: The New Actor must have the same lighting direction, color temperature, and grain as the [Base Scene].
  `;

  const compositionalLogic = `
  COMPOSITIONAL CONTROL & CAMERA LOGIC:
  - POSE/ANGLE TRANSFER: If the user references a specific image for "pose", "angle", or "body" (e.g. "Pose like [ASSET_SOURCE_1]"), you must explicitly instruct the generation to:
    1. COPY the skeletal structure/pose from that source.
    2. RETAIN the facial identity of the main subject ([IDENTITY_SEED]).
    3. DO NOT blend the faces. The Identity Seed face is the Source of Truth; the Asset Source is only for geometry.
  - CAMERA MOVEMENT: 
    - "Zoom out a little" / "Slightly zoom out" = "Increase Field of View by 15% (framing adjustment). Do NOT change shot type (e.g. do not go from Close-up to Full Body). Keep the subject dominant."
  - CAMERA ANGLE: 
    - If "face facing camera" is requested with a body turn, specify: "Torso rotated [Direction], Head turned to camera, Eyes making contact."
  `;

  // STYLE LOGIC
  const STYLE_PROMPTS: Record<string, string> = {
    "Cinematic (Default)": "RAW Photograph, 8k, Ultra-Detailed, Photorealistic, shot on 35mm lens.",
    "Ghibli Art": "Studio Ghibli style, hand-drawn animation, vibrant colors, whimsical, Miyazaki-esque, cel shaded, picturesque background.",
    "Anime": "High quality anime art, ufotable style, detailed eyes, dynamic lighting, 2D animation style, sharp lines.",
    "Semi-Realism": "Semi-realistic digital art, ArtStation trending, smooth painterly texture, stylized proportions but realistic lighting.",
    "3D Art": "3D render, Octane render, Unreal Engine 5, Pixar style, ray tracing, subsurface scattering, plastic/clay texture.",
    "Disney": "Disney animation style, expressive features, 3D character design, magical lighting, soft textures, Pixar/Disney aesthetic.",
  };

  const selectedStyle = settings.stylePreset || "Cinematic (Default)";
  const styleInstruction = STYLE_PROMPTS[selectedStyle] || STYLE_PROMPTS["Cinematic (Default)"];

  // SELECT THE CORRECT SYSTEM INSTRUCTION BASED ON MODE
  const isGroupMode = settings.mode === AppMode.GROUP_PHOTO;

  const instruction = `SYSTEM: ${isGroupMode ? "VFX COMPOSITING ENGINE" : "BIOMETRIC MERGE ENGINE"}
  
  CONTEXT:
  - ESTABLISHED IDENTITY (Session Memory): "${memory || "None yet."}"
  - USER MODIFICATION (Current Input): "${userPrompt}"
  - TARGET STYLE: "${selectedStyle}" -> Apply instructions: "${styleInstruction}"
  
  CRITICAL TASK:
  ${isGroupMode 
    ? "Construct a scene where [IDENTITY_SEED] is INSERTED into the target environment. Preserve the environment's integrity." 
    : "Combine the Established Identity with the User Modification to create the Final Generation Prompt."}
  
  KEYWORD DOMINANCE PROTOCOL:
  - The USER MODIFICATION text has ABSOLUTE AUTHORITY.
  - If the Memory says "Red Shirt" but User says "Blue Shirt", the Output MUST be "Blue Shirt".
  
  LOGIC:
  1. IF USER INPUT IS EMPTY:
     - Output the Memory converted into a high-quality prompt matching the TARGET STYLE.
  
  2. IF USER INPUT IS PRESENT:
     - Treat the Input as a *Delta* (Change Request).
  
  3. GLOBAL CONSTRAINTS:
     - Strictness: ${strictnessInstruction}
     - Fidelity: ${fidelityInstruction}
     - Style: ${aiRemovalInstruction} (Unless style is non-realistic like Anime/Disney)
     - Physics: ${physicalLogic}
     - Composition: ${compositionalLogic}
     ${isGroupMode ? `- GROUP PHOTO LOGIC: ${groupPhotoLogic}` : ""}
     ${settings.enableFilmGrain ? "- Texture: Add 35mm film grain and ISO noise." : ""}

  OUTPUT:
  Output ONLY the final, merged, detailed prompt. Do not output chat or explanations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: REASONING_MODEL,
      contents: instruction,
      config: { 
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 1024 } // Allow the model to think about the merge
      }
    });
    return response.text?.trim() || userPrompt;
  } catch (e) {
    // Fallback: If reasoning fails, just concat
    return memory ? `${memory}. ${userPrompt}` : userPrompt;
  }
}

/**
 * Handles conversational chat with optional search grounding.
 */
export async function chatWithSearch(
  input: string,
  images: string[] = [],
  history: any[] = [],
  modes: IntelligenceMode[] = []
) {
  if (!process.env.API_KEY) throw new Error("No API Key available.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const isSearchEnabled = modes.includes(IntelligenceMode.RESEARCH);
  const isReasoningEnabled = modes.includes(IntelligenceMode.REASONING);

  const model = isReasoningEnabled ? REASONING_MODEL : TEXT_MODEL;
  
  const parts: any[] = [];
  images.forEach(img => {
    if (!img) return;
    const data = img.split(',')[1] || img;
    parts.push({ inlineData: { data, mimeType: 'image/jpeg' } });
  });
  parts.push({ text: input });

  const contents = [...history, { role: 'user', parts }];

  const config: any = {
    temperature: 0.7,
  };
  
  if (isSearchEnabled) {
    config.tools = [{ googleSearch: {} }];
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config
    });

    const grounding: { uri: string; title: string }[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
       for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
          if (chunk.web) {
             grounding.push({
                uri: chunk.web.uri || "",
                title: chunk.web.title || "Source"
             });
          }
       }
    }

    return {
      text: response.text || "",
      grounding
    };
  } catch (error: any) {
    throw error;
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
    strictness?: number,
    searchContext?: string,
    memoryContext?: string,
    enableFilmGrain?: boolean,
    mode?: AppMode,
    stylePreset?: string
  }
) {
  if (!process.env.API_KEY) throw new Error("No API Key available.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // STEP 1: DWELLING / MERGING PHASE
  // Apply Deep Dwelling/Memory engine for Portrait Generator and Group Photo modes.
  let optimizedPrompt = prompt;
  
  if (config.mode === AppMode.PORTRAIT_GENERATOR || config.mode === AppMode.GROUP_PHOTO) {
    optimizedPrompt = await optimizePromptWithReasoning(
      prompt, 
      config.memoryContext || "", 
      {
        strictness: config.strictness || 0.7,
        faceFidelity: config.faceFidelity || 0.9,
        enableFilmGrain: config.enableFilmGrain || false,
        stylePreset: config.stylePreset,
        mode: config.mode
      }
    );
  }

  const parts: any[] = [];
  
  // Add reference images
  images.forEach((img) => {
    if (!img) return;
    const data = img.split(',')[1] || img;
    parts.push({ inlineData: { data, mimeType: 'image/jpeg' } });
  });

  // STEP 2: CONSTRUCT FINAL INSTRUCTION
  // We append specific negative constraints to ensure the "AI Look" is killed.
  const universalNegative = "cartoon, 3d render, plastic skin, smooth skin, cgi, blurry, distorted, watermark, text, low quality, bad anatomy, extra limbs, makeup, airbrushed, oversized jewelry, unrealistic proportions, floating objects";
  
  const finalInstruction = `
  ${optimizedPrompt}
  
  ---
  TECHNICAL PARAMETERS:
  - Output Style: RAW Photograph, 8k, Ultra-Detailed (unless overriden by specific style request).
  - Skin Texture: Must show pores and natural imperfections (if realistic).
  - Scale & Physics: Accessories must be sized realistically to the subject.
  - IDENTITY PRIORITY: The [IDENTITY_SEED] face is IMMUTABLE. Do not morph facial features to match [ASSET_SOURCE] pose references.
  - Camera: Respect micro-adjustments (e.g. "slight zoom") without changing the overall shot type.
  - Negative Constraints: ${universalNegative}, ${config.negativePrompt || ''}
  `;

  parts.push({ text: finalInstruction });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: {
        // Map the UI "Temperature" slider to the model's temperature
        temperature: Math.max(0.1, Math.min(1.5, config.temperature ?? 1.0)),
        imageConfig: {
          aspectRatio: (config.aspectRatio || "1:1") as any,
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
