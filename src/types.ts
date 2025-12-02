import React from 'react';

export type Feature = 'text' | 'chat' | 'image' | 'vision' | 'status' | 'settings' | 'activity' | 'profile';
export type TextModel = 'nvidia/nemotron-nano-12b-v2-vl';
export type ImageModel =
  | 'stabilityai/stable-diffusion-xl-base-1.0'
  | 'stable-diffusion-v1-5/stable-diffusion-v1-5'
  | 'Lykon/DreamShaper'
  | 'CompVis/stable-diffusion-v1-4'
  | 'nvidia/nemotron-nano-12b-v2-vl';
export type Tone = 'formal' | 'casual' | 'humorous';
export type Length = 'short' | 'medium' | 'long';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:2' | '2:3' | '21:9' | '9:21' | '5:4';
export type ImageStyle =
  | 'none'
  | 'photorealistic'
  | 'cinematic'
  | 'anime'
  | 'digital-art'
  | 'watercolor'
  | 'oil-painting'
  | 'pixel-art'
  | 'isometric'
  | 'low-poly'
  | 'cyberpunk'
  | 'neon-noir'
  | 'line-art'
  | 'sketch'
  | '3d-render';
export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type Feedback = 'good' | 'bad' | null;

// --- App data & activity logging ---
export type ActivityType =
  | 'auth.signup'
  | 'auth.signin'
  | 'chat.message'
  | 'image.generate'
  | 'vision.query'
  | 'settings.change';

export interface ActivityRecord {
  id?: string; // provider may assign id
  userId: string;
  type: ActivityType;
  timestamp: string; // ISO8601
  data?: Record<string, unknown>;
}

// --- API Response Structures ---
export interface BaseResponse {
  success: boolean;
  error?: string;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface TextGenerationSuccess extends BaseResponse {
  success: true;
  text: string;
  sources?: GroundingChunk[];
}
export interface TextGenerationError extends BaseResponse {
  success: false;
}
export type TextGenerationResponse = TextGenerationSuccess | TextGenerationError;


export interface JsonGenerationSuccess extends BaseResponse {
  success: true;
  json: object;
  rawResponse: string;
}
export interface JsonGenerationError extends BaseResponse {
  success: false;
  rawResponse?: string;
}
export type JsonGenerationResponse = JsonGenerationSuccess | JsonGenerationError;


export interface ImageGenerationSuccess extends BaseResponse {
  success: true;
  url: string;
  provider?: 'local-sd' | 'stability' | 'nemotron' | 'huggingface' | 'grok';
  note?: string; // optional informational note (e.g., fallback reason)
}
export interface ImageGenerationError extends BaseResponse {
  success: false;
}
export type ImageGenerationResponse = ImageGenerationSuccess | ImageGenerationError;


export interface VisionSuccess extends BaseResponse {
  success: true;
  text: string;
}
export interface VisionError extends BaseResponse {
  success: false;
}
export type VisionResponse = VisionSuccess | VisionError;


// --- Component & History States ---

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  sources?: GroundingChunk[];
  feedback?: Feedback;
  shareState?: 'idle' | 'copied';
  isError?: boolean;
}

export interface TextGenerationHistoryEntry {
  id: string;
  timestamp: string;
  prompt: string;
  result: TextGenerationResponse | JsonGenerationResponse;
  model: TextModel;
  tone: Tone;
  length: Length;
  temperature: number;
  systemPrompt: string;
  isJsonMode: boolean;
  useWebSearch: boolean;
  feedback?: Feedback;
  isFavorite?: boolean;
}

export interface ImageGenerationHistoryEntry {
  id: string;
  timestamp: string;
  prompt: string;
  enhancedPrompt: string | null;
  result: ImageGenerationResponse;
  model: ImageModel;
  style: ImageStyle;
  aspectRatio: AspectRatio;
  isFavorite?: boolean;
}

export type IconProps = {
  className?: string;
  [key: string]: any;
};