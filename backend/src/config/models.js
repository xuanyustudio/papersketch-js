/**
 * Central registry of supported image generation models.
 * provider: 'gemini' | 'fal' | 'openai' | 'doubao'
 */
export const IMAGE_MODELS = [
  {
    id: 'gemini-2.5-flash-image-preview',
    label: 'Gemini 2.5 Flash Image Preview',
    provider: 'gemini',
    requiresKey: 'googleApiKey',
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image',
    provider: 'gemini',
    requiresKey: 'googleApiKey',
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Image Preview',
    provider: 'gemini',
    requiresKey: 'googleApiKey',
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image Preview',
    provider: 'gemini',
    requiresKey: 'googleApiKey',
  },
  {
    id: 'fal-ai/nano-banana',
    label: 'Nano Banana (fal.ai)',
    provider: 'fal',
    requiresKey: 'falApiKey',
  },
  {
    id: 'doubao-seedream-5-0-260128',
    label: 'Doubao Seedream 5.0',
    provider: 'doubao',
    requiresKey: 'doubaoApiKey',
  },
  {
    id: 'doubao-seedream-3-0-t2i-250415',
    label: 'Doubao Seedream 3.0 T2I',
    provider: 'doubao',
    requiresKey: 'doubaoApiKey',
  },
  {
    id: 'doubao-seedream-4-5-251128',
    label: 'Doubao Seedream 4.5',
    provider: 'doubao',
    requiresKey: 'doubaoApiKey',
  },
  {
    id: 'doubao-seededit-3-0-i2i-250628',
    label: 'Doubao Seededit 3.0 I2I',
    provider: 'doubao',
    requiresKey: 'doubaoApiKey',
  },
]
