import {
  FreepikConfig,
  GenerateImageParams,
  GenerateImageResponse,
  CheckStatusResponse,
  SearchResourcesParams,
  SearchResourcesResponse,
  ResourceResponse,
  SeedreamTextToImageParams,
  SeedreamEditParams,
  SeedreamResponse,
} from '../types.js';

export class FreepikClient {
  private apiKey: string;
  private baseUrl = 'https://api.freepik.com';

  constructor(config: FreepikConfig) {
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'x-freepik-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Freepik API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  // ============================================
  // Stock Resources
  // ============================================

  async searchResources(
    params: SearchResourcesParams
  ): Promise<SearchResourcesResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('term', params.term);

    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.order) queryParams.set('order', params.order);

    // Add filters as query params
    if (params.filters?.orientation) {
      Object.entries(params.filters.orientation).forEach(([key, value]) => {
        if (value) queryParams.set(`filters[orientation][${key}]`, 'true');
      });
    }
    if (params.filters?.content_type) {
      Object.entries(params.filters.content_type).forEach(([key, value]) => {
        if (value) queryParams.set(`filters[content_type][${key}]`, 'true');
      });
    }
    if (params.filters?.license) {
      Object.entries(params.filters.license).forEach(([key, value]) => {
        if (value) queryParams.set(`filters[license][${key}]`, 'true');
      });
    }

    return this.request<SearchResourcesResponse>(
      `/v1/resources?${queryParams.toString()}`
    );
  }

  async getResourceDetails(id: number): Promise<ResourceResponse> {
    return this.request<ResourceResponse>(`/v1/resources/${id}`);
  }

  async downloadResource(id: number): Promise<{ url: string }> {
    return this.request<{ url: string }>(`/v1/resources/${id}/download`);
  }

  // ============================================
  // Mystic AI (Legacy)
  // ============================================

  async generateImage(
    params: GenerateImageParams
  ): Promise<GenerateImageResponse> {
    return this.request<GenerateImageResponse>('/v1/ai/mystic', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async checkMysticStatus(taskId: string): Promise<CheckStatusResponse> {
    return this.request<CheckStatusResponse>(`/v1/ai/mystic/${taskId}`);
  }

  // ============================================
  // Seedream 4 - Text to Image
  // ============================================

  async seedreamTextToImage(
    params: SeedreamTextToImageParams
  ): Promise<SeedreamResponse> {
    return this.request<SeedreamResponse>('/v1/ai/text-to-image/seedream-v4', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async checkSeedreamStatus(taskId: string): Promise<SeedreamResponse> {
    return this.request<SeedreamResponse>(
      `/v1/ai/text-to-image/seedream-v4/${taskId}`
    );
  }

  // ============================================
  // Seedream 4 - Image Edit
  // ============================================

  async seedreamEdit(params: SeedreamEditParams): Promise<SeedreamResponse> {
    return this.request<SeedreamResponse>(
      '/v1/ai/text-to-image/seedream-v4-edit',
      {
        method: 'POST',
        body: JSON.stringify({
          prompt: params.prompt,
          image: { url: params.image_url },
          guidance_scale: params.guidance_scale,
          seed: params.seed,
        }),
      }
    );
  }

  async checkSeedreamEditStatus(taskId: string): Promise<SeedreamResponse> {
    return this.request<SeedreamResponse>(
      `/v1/ai/text-to-image/seedream-v4-edit/${taskId}`
    );
  }

  // ============================================
  // Helper: Wait for completion
  // ============================================

  async waitForCompletion(
    taskId: string,
    type: 'mystic' | 'seedream' | 'seedream-edit' = 'seedream',
    maxAttempts = 60,
    intervalMs = 2000
  ): Promise<SeedreamResponse | CheckStatusResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      let status: SeedreamResponse | CheckStatusResponse;

      switch (type) {
        case 'mystic':
          status = await this.checkMysticStatus(taskId);
          break;
        case 'seedream-edit':
          status = await this.checkSeedreamEditStatus(taskId);
          break;
        case 'seedream':
        default:
          status = await this.checkSeedreamStatus(taskId);
      }

      if (status.status === 'COMPLETED') {
        return status;
      }

      if (status.status === 'FAILED') {
        throw new Error(`Generation failed for task ${taskId}`);
      }
    }

    throw new Error(`Timeout waiting for task ${taskId}`);
  }
}
