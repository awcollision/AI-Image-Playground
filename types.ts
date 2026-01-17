
export enum AppMode {
  LANDING = 'LANDING',
  GROUP_PHOTO = 'GROUP_PHOTO',
  PORTRAIT_GENERATOR = 'PORTRAIT_GENERATOR',
  THUMBNAIL_CREATOR = 'THUMBNAIL_CREATOR',
  ACCESSORIES_GENERATOR = 'ACCESSORIES_GENERATOR'
}

export enum IntelligenceMode {
  CREATIVE = 'Creative',
  RESEARCH = 'Web Search',
  REASONING = 'Reasoning'
}

export interface AvatarSeed {
  id: string;
  imageData: string;
  name: string;
  tags?: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  grounding?: { uri: string; title: string }[];
  isSearch?: boolean;
}

export type ValidAspectRatio = "1:1" | "1:2" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
export type ValidImageSize = "1K" | "2K" | "4K" | "8K";

export interface GenSettings {
  temperature: number;
  variation: number;
  faceFidelity: number;
  strictness: number; 
  microDetailBias: number; // Focus on small objects like pendants/jewelry
  aspectRatio: ValidAspectRatio | "Original";
  numberOfImages: number;
  imageSize: ValidImageSize;
  cameraAngle: string;
  pose: string;
  stylePreset: string;
}

export interface GalleryItem {
  url: string;
  prompt: string;
  settings: GenSettings;
  timestamp: number;
  feedback?: 'like' | 'dislike' | null;
}

export interface UserState {
  seeds: AvatarSeed[];
  currentMode: AppMode;
  isKeySelected: boolean;
  settings: GenSettings;
  negativePrompt: string;
  promptHistory: string[];
  generatedGallery: GalleryItem[]; 
  neuralWeights: string; 
}