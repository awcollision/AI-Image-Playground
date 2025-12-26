
export enum AppMode {
  LANDING = 'LANDING',
  SINGLE_PLAY = 'SINGLE_PLAY',
  GROUP_PHOTO = 'GROUP_PHOTO',
  ON_THE_GO = 'ON_THE_GO'
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

export type ValidAspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
export type ValidImageSize = "1K" | "2K" | "4K";

export interface GenSettings {
  temperature: number;
  variation: number;
  faceFidelity: number;
  strictness: number; // 0 to 1 scale for prompt adherence
  aspectRatio: ValidAspectRatio | "Original";
  numberOfImages: number;
  imageSize: ValidImageSize;
  cameraAngle: string;
  pose: string;
}

export interface GalleryItem {
  url: string;
  prompt: string;
  settings: GenSettings;
  timestamp: number;
}

export interface UserState {
  seeds: AvatarSeed[];
  currentMode: AppMode;
  isKeySelected: boolean;
  settings: GenSettings;
  negativePrompt: string;
  promptHistory: string[];
  generatedGallery: GalleryItem[]; // History of all successful generations with metadata
}
