export const SCENE_PROMPTS = {
  'studio-white': 'Professional product photography on pure white background, soft studio lighting, clean and minimal',
  'studio-gradient': 'Professional product photography on subtle gradient background, soft shadows, commercial quality',
  'lifestyle-kitchen': 'Product placed in modern kitchen setting, natural lighting, lifestyle photography',
  'lifestyle-bedroom': 'Product in cozy bedroom interior, soft natural light, lifestyle aesthetic',
  'lifestyle-office': 'Product on modern office desk, professional setting, clean workspace',
  'lifestyle-outdoor': 'Product in outdoor natural setting, golden hour lighting, organic feel',
  'minimal-solid': 'Product on solid color background, minimal shadows, clean commercial style',
  'dark-mode': 'Product on dark background, dramatic lighting, premium feel',
} as const;

export const ENHANCEMENT_PROMPTS = {
  polish: 'Enhance image quality, reduce noise, sharpen details, maintain natural look',
  relight_soft: 'Soft diffused lighting, minimal shadows, even illumination',
  relight_bright: 'Bright studio lighting, high key, clean and fresh',
  relight_dramatic: 'Dramatic side lighting, deep shadows, moody atmosphere',
  relight_natural: 'Natural window light, soft shadows, realistic indoor lighting',
} as const;

export const STYLE_PROMPTS = {
  bright_airy: 'Bright and airy aesthetic, high exposure, soft tones, minimal contrast',
  dark_moody: 'Dark and moody, low key lighting, rich shadows, cinematic',
  warm_cozy: 'Warm color temperature, cozy atmosphere, golden tones',
  cool_professional: 'Cool color temperature, professional clean look, blue undertones',
} as const;

export type ScenePromptKey = keyof typeof SCENE_PROMPTS;
export type EnhancementPromptKey = keyof typeof ENHANCEMENT_PROMPTS;
export type StylePromptKey = keyof typeof STYLE_PROMPTS;

export function buildPrompt(
  scene?: ScenePromptKey,
  enhancement?: EnhancementPromptKey,
  style?: StylePromptKey,
  custom?: string
): string {
  const parts: string[] = [];

  if (scene) parts.push(SCENE_PROMPTS[scene]);
  if (enhancement) parts.push(ENHANCEMENT_PROMPTS[enhancement]);
  if (style) parts.push(STYLE_PROMPTS[style]);
  if (custom) parts.push(custom);

  return parts.join('. ');
}
