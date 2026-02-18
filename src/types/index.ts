export type ProjectStatus = 'active' | 'archived' | 'deleted';

export interface Project {
  id: string;
  userId: string;
  name: string;
  sku?: string;
  thumbnail?: string;
  layers: Layer[];
  settings: ProjectSettings;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  width: number;
  height: number;
  backgroundColor?: string;
}

export interface Layer {
  id: string;
  type: 'image' | 'background' | 'text';
  name: string;
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
}

export type AssetType = 'model' | 'product' | 'background' | 'brand' | 'prop';

export interface Asset {
  id: string;
  userId: string;
  type: AssetType;
  name: string;
  url: string;
  thumbnailUrl?: string;
  tags: string[];
  createdAt: Date;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  layers: Layer[];
  prompt?: string;
  usageCount: number;
  isFree: boolean;
}

export type AITask =
  | 'remove-bg'
  | 'upscale'
  | 'polish'
  | 'relight'
  | 'scene-gen'
  | 'try-on'
  | 'object-removal'
  | 'text-removal';

export type AIProvider = 'gemini' | 'zai';

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Generation {
  id: string;
  userId: string;
  projectId?: string;
  provider: AIProvider;
  model: string;
  task: AITask;
  prompt?: string;
  inputUrl?: string;
  outputUrl?: string;
  status: GenerationStatus;
  cost?: number;
  duration?: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export type Tool =
  | 'select'
  | 'pan'
  | 'remove-bg'
  | 'upscale'
  | 'polish'
  | 'relight'
  | 'scene-gen'
  | 'try-on';

export type Plan = 'free' | 'pro' | 'agency';

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name?: string;
  plan: Plan;
  generationsUsed: number;
  generationsLimit: number;
}
