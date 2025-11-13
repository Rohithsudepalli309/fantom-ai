// Central schema and defaults for app-wide settings
export type ChatModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface AppSettings {
  // Text
  temperature: number; // 0..2
  maxOutputTokens: number; // practical limit
  // Chat
  chatHistoryEnabled: boolean;
  chatModel: ChatModel;
  notifications: boolean;
  // Image
  imageStyle: 'none' | 'photorealistic' | 'cinematic' | 'anime' | 'digital-art' | 'watercolor' | 'oil-painting' | 'pixel-art' | 'isometric' | 'low-poly' | 'cyberpunk' | 'neon-noir' | 'line-art' | 'sketch' | '3d-render';
  imageSize: '1:1' | '16:9' | '9:16' | '4:3' | '3:2' | '2:3' | '21:9' | '9:21' | '5:4';
  imageFormat: 'png' | 'jpeg' | 'webp';
  // Vision
  visionEnabled: boolean;
  // General
  theme: 'system' | 'light' | 'dark';
  language: 'en' | 'auto';
}

export const DEFAULT_SETTINGS: AppSettings = {
  temperature: 0.8,
  maxOutputTokens: 2048,
  chatHistoryEnabled: true,
  chatModel: 'gemini-2.5-flash',
  notifications: false,
  imageStyle: 'none',
  imageSize: '1:1',
  imageFormat: 'png',
  visionEnabled: true,
  theme: 'system',
  language: 'en',
};

export const SETTINGS_STORAGE_KEY = 'fantom.settings';
