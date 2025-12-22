
export enum AppMode {
  LANDING = 'LANDING',
  SINGLE_PLAY = 'SINGLE_PLAY',
  GROUP_PHOTO = 'GROUP_PHOTO'
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
}

export type ValidAspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
export type ValidImageSize = "1K" | "2K" | "4K";

export interface GenSettings {
  temperature: number;
  variation: number;
  faceFidelity: number;
  aspectRatio: ValidAspectRatio | "Original";
  numberOfImages: number;
  imageSize: ValidImageSize;
  cameraAngle: string;
  pose: string;
}

export interface UserState {
  seeds: AvatarSeed[];
  currentMode: AppMode;
  isKeySelected: boolean;
  settings: GenSettings;
  negativePrompt: string;
  promptHistory: string[];
}
