import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FreepikClient } from './api/client.js';

// ============================================
// Configuration Schema for Smithery
// ============================================
export const configSchema = z.object({
  freepikApiKey: z
    .string()
    .min(1)
    .describe('Your Freepik API Key (get it from freepik.com/api)'),
});

// ============================================
// Main Server Factory (Smithery format)
// ============================================
export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new McpServer({
    name: 'freepik-seedream-mcp',
    version: '1.0.0',
  });

  const client = new FreepikClient({ apiKey: config.freepikApiKey });

  // ==========================================
  // SEEDREAM 4 - Text to Image
  // ==========================================
  server.tool(
    'seedream_generate',
    'Generate an image using Seedream 4.0 (ByteDance) - High quality 4K capable',
    {
      prompt: z.string().describe('Text description of the image to generate'),
      aspect_ratio: z
        .enum([
          'square_1_1',
          'classic_4_3',
          'traditional_3_4',
          'widescreen_16_9',
          'social_story_9_16',
          'landscape_3_2',
          'portrait_2_3',
        ])
        .optional()
        .default('square_1_1')
        .describe('Image aspect ratio'),
      guidance_scale: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .default(2.5)
        .describe('How closely to follow the prompt (1-10, default 2.5)'),
      wait_for_result: z
        .boolean()
        .optional()
        .default(true)
        .describe('Wait for image generation to complete'),
    },
    async ({ prompt, aspect_ratio, guidance_scale, wait_for_result }) => {
      try {
        const result = await client.seedreamTextToImage({
          prompt,
          aspect_ratio,
          guidance_scale,
        });

        if (!wait_for_result) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    task_id: result.task_id,
                    status: result.status,
                    message:
                      'Generation started. Use seedream_status to check progress.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const completed = await client.waitForCompletion(
          result.task_id,
          'seedream'
        );

        if (completed.generated && completed.generated.length > 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Image generated successfully!\n\nURL: ${completed.generated[0].url}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(completed, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // SEEDREAM 4 - Image Edit
  // ==========================================
  server.tool(
    'seedream_edit',
    'Edit an existing image using Seedream 4.0 with natural language instructions',
    {
      prompt: z.string().describe('Instructions for editing the image'),
      image_url: z.string().url().describe('URL of the image to edit'),
      guidance_scale: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .default(2.5)
        .describe('How closely to follow the prompt'),
      wait_for_result: z
        .boolean()
        .optional()
        .default(true)
        .describe('Wait for edit to complete'),
    },
    async ({ prompt, image_url, guidance_scale, wait_for_result }) => {
      try {
        const result = await client.seedreamEdit({
          prompt,
          image_url,
          guidance_scale,
        });

        if (!wait_for_result) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    task_id: result.task_id,
                    status: result.status,
                    message:
                      'Edit started. Use seedream_status to check progress.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const completed = await client.waitForCompletion(
          result.task_id,
          'seedream-edit'
        );

        if (completed.generated && completed.generated.length > 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Image edited successfully!\n\nURL: ${completed.generated[0].url}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(completed, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // SEEDREAM 4 - Check Status
  // ==========================================
  server.tool(
    'seedream_status',
    'Check the status of a Seedream 4 generation task',
    {
      task_id: z.string().describe('Task ID to check'),
      type: z
        .enum(['text-to-image', 'edit'])
        .optional()
        .default('text-to-image')
        .describe('Type of task'),
    },
    async ({ task_id, type }) => {
      try {
        const result =
          type === 'edit'
            ? await client.checkSeedreamEditStatus(task_id)
            : await client.checkSeedreamStatus(task_id);

        if (result.status === 'COMPLETED' && result.generated?.length) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Status: COMPLETED\n\nImage URL: ${result.generated[0].url}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // STOCK - Search Resources
  // ==========================================
  server.tool(
    'search_resources',
    'Search for Freepik stock resources (photos, vectors, PSDs)',
    {
      term: z.string().describe('Search term'),
      limit: z
        .number()
        .min(1)
        .max(200)
        .optional()
        .default(20)
        .describe('Number of results (max 200)'),
      order: z
        .enum(['relevance', 'recent'])
        .optional()
        .default('relevance')
        .describe('Sort order'),
      content_type: z
        .enum(['photo', 'vector', 'psd', 'all'])
        .optional()
        .default('all')
        .describe('Filter by content type'),
    },
    async ({ term, limit, order, content_type }) => {
      try {
        const filters =
          content_type !== 'all'
            ? {
                content_type: {
                  photo: content_type === 'photo',
                  vector: content_type === 'vector',
                  psd: content_type === 'psd',
                },
              }
            : undefined;

        const result = await client.searchResources({
          term,
          limit,
          order,
          filters,
        });

        const summary = result.data.slice(0, 10).map((r) => ({
          id: r.id,
          title: r.title,
          preview: r.image?.source?.url,
          author: r.author?.name,
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text: `Found ${result.meta.pagination.total} results for "${term}"\n\nTop ${summary.length} results:\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // STOCK - Get Resource Details
  // ==========================================
  server.tool(
    'get_resource',
    'Get detailed information about a specific Freepik resource',
    {
      id: z.number().describe('Resource ID'),
    },
    async ({ id }) => {
      try {
        const result = await client.getResourceDetails(id);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // STOCK - Download Resource
  // ==========================================
  server.tool(
    'download_resource',
    'Get download URL for a Freepik resource',
    {
      id: z.number().describe('Resource ID to download'),
    },
    async ({ id }) => {
      try {
        const result = await client.downloadResource(id);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Download URL: ${result.url}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // MYSTIC AI - Generate (Legacy)
  // ==========================================
  server.tool(
    'mystic_generate',
    'Generate an image using Freepik Mystic AI (legacy, use seedream_generate for better results)',
    {
      prompt: z.string().describe('Text description of the image'),
      resolution: z
        .enum(['2k', '4k'])
        .optional()
        .default('2k')
        .describe('Image resolution'),
      aspect_ratio: z
        .enum([
          'square_1_1',
          'classic_4_3',
          'traditional_3_4',
          'widescreen_16_9',
          'social_story_9_16',
        ])
        .optional()
        .default('square_1_1')
        .describe('Aspect ratio'),
      realism: z
        .boolean()
        .optional()
        .default(false)
        .describe('Enable realistic style'),
      wait_for_result: z
        .boolean()
        .optional()
        .default(true)
        .describe('Wait for completion'),
    },
    async ({ prompt, resolution, aspect_ratio, realism, wait_for_result }) => {
      try {
        const result = await client.generateImage({
          prompt,
          resolution,
          aspect_ratio,
          realism,
        });

        if (!wait_for_result) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        const completed = await client.waitForCompletion(
          result.task_id,
          'mystic'
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(completed, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Return the underlying server for Smithery
  return server.server;
}
