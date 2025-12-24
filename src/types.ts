import { z } from 'zod';

// ============================================
// Configuration
// ============================================
export interface FreepikConfig {
  apiKey: string;
}

// ============================================
// Search Resources Types
// ============================================
export interface SearchResourcesParams {
  term: string;
  limit?: number;
  order?: 'relevance' | 'recent';
  filters?: {
    orientation?: {
      landscape?: boolean;
      portrait?: boolean;
      square?: boolean;
      panoramic?: boolean;
    };
    content_type?: {
      photo?: boolean;
      psd?: boolean;
      vector?: boolean;
    };
    license?: {
      freemium?: boolean;
      premium?: boolean;
    };
  };
}

export interface ResourceResponse {
  id: number;
  title: string;
  url: string;
  licenses: Array<{
    type: string;
    url: string;
  }>;
  image: {
    source: {
      url: string;
      size: string;
    };
  };
  author: {
    name: string;
    avatar: string;
  };
  stats: {
    downloads: number;
    likes: number;
  };
}

export interface SearchResourcesResponse {
  data: ResourceResponse[];
  meta: {
    pagination: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
    };
  };
}

// ============================================
// Mystic AI Generation Types (Legacy)
// ============================================
export interface GenerateImageParams {
  prompt: string;
  resolution?: '2k' | '4k';
  aspect_ratio?: 'square_1_1' | 'classic_4_3' | 'traditional_3_4' | 'widescreen_16_9' | 'social_story_9_16';
  realism?: boolean;
  engine?: 'automatic' | 'magnific_illusio' | 'magnific_sharpy' | 'magnific_sparkle';
  creative_detailing?: number;
  styling?: {
    style?: string;
    color?: string;
    framing?: string;
    lighting?: string;
  };
  image?: {
    url?: string;
    influence?: number;
  };
}

export interface GenerateImageResponse {
  task_id: string;
  status: string;
}

export interface CheckStatusResponse {
  task_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  generated?: Array<{
    url: string;
    content_type: string;
  }>;
}

// ============================================
// Seedream 4 Types
// ============================================
export interface SeedreamTextToImageParams {
  prompt: string;
  aspect_ratio?: 'square_1_1' | 'classic_4_3' | 'traditional_3_4' | 'widescreen_16_9' | 'social_story_9_16' | 'landscape_3_2' | 'portrait_2_3';
  guidance_scale?: number;
  seed?: number;
  webhook_url?: string;
}

export interface SeedreamEditParams {
  prompt: string;
  image_url: string;
  guidance_scale?: number;
  seed?: number;
  webhook_url?: string;
}

export interface SeedreamResponse {
  task_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  generated?: Array<{
    url: string;
    content_type: string;
  }>;
}

// ============================================
// Zod Schemas for Validation
// ============================================
export const SearchResourcesSchema = z.object({
  term: z.string().min(1),
  limit: z.number().min(1).max(200).optional().default(20),
  order: z.enum(['relevance', 'recent']).optional().default('relevance'),
  filters: z.object({
    orientation: z.object({
      landscape: z.boolean().optional(),
      portrait: z.boolean().optional(),
      square: z.boolean().optional(),
      panoramic: z.boolean().optional(),
    }).optional(),
    content_type: z.object({
      photo: z.boolean().optional(),
      psd: z.boolean().optional(),
      vector: z.boolean().optional(),
    }).optional(),
    license: z.object({
      freemium: z.boolean().optional(),
      premium: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

export const GetResourceSchema = z.object({
  id: z.number().min(1),
});

export const DownloadResourceSchema = z.object({
  id: z.number().min(1),
});

export const GenerateImageSchema = z.object({
  prompt: z.string().min(1),
  resolution: z.enum(['2k', '4k']).optional().default('2k'),
  aspect_ratio: z.enum(['square_1_1', 'classic_4_3', 'traditional_3_4', 'widescreen_16_9', 'social_story_9_16']).optional().default('square_1_1'),
  realism: z.boolean().optional().default(false),
  engine: z.enum(['automatic', 'magnific_illusio', 'magnific_sharpy', 'magnific_sparkle']).optional().default('automatic'),
  creative_detailing: z.number().min(0).max(100).optional().default(50),
});

export const CheckStatusSchema = z.object({
  task_id: z.string().min(1),
});

// Seedream 4 Schemas
export const SeedreamTextToImageSchema = z.object({
  prompt: z.string().min(1).describe('Text description of the image to generate'),
  aspect_ratio: z.enum([
    'square_1_1',
    'classic_4_3',
    'traditional_3_4',
    'widescreen_16_9',
    'social_story_9_16',
    'landscape_3_2',
    'portrait_2_3'
  ]).optional().default('square_1_1').describe('Image aspect ratio'),
  guidance_scale: z.number().min(1).max(10).optional().default(2.5).describe('How closely to follow the prompt (1-10)'),
  seed: z.number().optional().describe('Random seed for reproducibility'),
});

export const SeedreamEditSchema = z.object({
  prompt: z.string().min(1).describe('Instructions for editing the image'),
  image_url: z.string().url().describe('URL of the image to edit'),
  guidance_scale: z.number().min(1).max(10).optional().default(2.5).describe('How closely to follow the prompt'),
  seed: z.number().optional().describe('Random seed for reproducibility'),
});

export const SeedreamStatusSchema = z.object({
  task_id: z.string().min(1).describe('Task ID to check'),
});
