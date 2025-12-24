import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer as createHttpServer } from 'http';

const PORT = parseInt(process.env.PORT || '3000', 10);

// Simple HTTP wrapper that responds to MCP protocol
const httpServer = createHttpServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // Health check (GET only)
  if ((url.pathname === '/' || url.pathname === '/health') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'freepik-seedream-mcp' }));
    return;
  }

  // MCP endpoint - handle POST at root or /mcp
  if ((url.pathname === '/' || url.pathname === '/mcp') && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      const message = JSON.parse(body);

      // Get config from query
      let apiKey = process.env.FREEPIK_API_KEY || '';
      const configParam = url.searchParams.get('config');
      console.log(`[MCP] Config param present: ${configParam ? 'YES' : 'NO'}`);
      if (configParam) {
        try {
          const decoded = JSON.parse(Buffer.from(configParam, 'base64').toString('utf-8'));
          console.log(`[MCP] Decoded config keys: ${Object.keys(decoded).join(', ')}`);
          if (decoded.freepikApiKey) {
            apiKey = decoded.freepikApiKey;
            console.log(`[MCP] API key loaded from config (length: ${apiKey.length})`);
          }
        } catch (e) {
          console.log(`[MCP] Failed to decode config: ${e}`);
        }
      }
      if (!apiKey) {
        console.log('[MCP] WARNING: No API key available from env or config');
      }

      // Handle initialize
      if (message.method === 'initialize') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'freepik-seedream-mcp',
              version: '1.0.0'
            }
          }
        }));
        return;
      }

      // Handle tools/list
      if (message.method === 'tools/list') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: [
              {
                name: 'seedream_generate',
                description: 'Generate an image using Seedream 4.0',
                inputSchema: {
                  type: 'object',
                  properties: {
                    prompt: { type: 'string', description: 'Image description' },
                    aspect_ratio: {
                      type: 'string',
                      enum: ['square_1_1', 'widescreen_16_9', 'portrait_9_16'],
                      default: 'square_1_1'
                    }
                  },
                  required: ['prompt']
                }
              },
              {
                name: 'search_resources',
                description: 'Search Freepik stock resources',
                inputSchema: {
                  type: 'object',
                  properties: {
                    term: { type: 'string', description: 'Search term' },
                    limit: { type: 'number', default: 10 }
                  },
                  required: ['term']
                }
              }
            ]
          }
        }));
        return;
      }

      // Handle tools/call
      if (message.method === 'tools/call') {
        const toolName = message.params?.name;
        const args = message.params?.arguments || {};

        console.log(`[tools/call] Tool: ${toolName}, Args: ${JSON.stringify(args)}`);
        console.log(`[tools/call] API Key present: ${apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO'}`);

        if (!apiKey) {
          console.log('[tools/call] ERROR: No API key configured');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [{ type: 'text', text: 'Error: No Freepik API key configured. Please add your API key in the MCP configuration.' }],
              isError: true
            }
          }));
          return;
        }

        if (toolName === 'seedream_generate') {
          try {
            console.log(`[seedream_generate] Starting with prompt: ${args.prompt}`);
            // Start generation
            const response = await fetch('https://api.freepik.com/v1/ai/text-to-image/seedream-v4', {
              method: 'POST',
              headers: {
                'x-freepik-api-key': apiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                prompt: args.prompt,
                aspect_ratio: args.aspect_ratio || 'square_1_1'
              })
            });

            console.log(`[seedream_generate] API response status: ${response.status}`);
            const data = await response.json();
            console.log(`[seedream_generate] API response: ${JSON.stringify(data)}`);

            if (!data.task_id) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                result: {
                  content: [{ type: 'text', text: `Error: ${JSON.stringify(data)}` }],
                  isError: true
                }
              }));
              return;
            }

            // Poll for completion (max 90 seconds)
            let result = null;
            let lastStatus = 'UNKNOWN';
            console.log(`[seedream_generate] Starting polling for task ${data.task_id}`);

            for (let i = 0; i < 45; i++) {
              await new Promise(r => setTimeout(r, 2000));

              const statusRes = await fetch(`https://api.freepik.com/v1/ai/text-to-image/seedream-v4/${data.task_id}`, {
                headers: { 'x-freepik-api-key': apiKey }
              });
              const status = await statusRes.json();
              lastStatus = status.status || 'UNKNOWN';

              console.log(`[seedream_generate] Poll ${i+1}/45 - Status: ${lastStatus}`);

              if (status.status === 'COMPLETED' && status.generated?.length > 0) {
                result = status;
                console.log(`[seedream_generate] Success! Image URL: ${status.generated[0].url}`);
                break;
              }
              if (status.status === 'FAILED' || status.status === 'ERROR') {
                console.log(`[seedream_generate] Failed: ${JSON.stringify(status)}`);
                throw new Error(`Generation failed: ${status.error || status.message || 'Unknown error'}`);
              }
            }

            if (result && result.generated?.length > 0) {
              const imageUrl = result.generated[0].url;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                result: {
                  content: [
                    { type: 'text', text: `Image generated successfully!\n\nURL: ${imageUrl}\n\nYou can view or download this image directly from the URL above.` }
                  ]
                }
              }));
            } else {
              console.log(`[seedream_generate] Timeout - last status was: ${lastStatus}`);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: message.id,
                result: {
                  content: [{ type: 'text', text: `Timeout after 90 seconds. Last status: ${lastStatus}. Task ID: ${data.task_id}\n\nYou can try checking the status later or try again.` }],
                  isError: true
                }
              }));
            }
          } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true
              }
            }));
          }
          return;
        }

        if (toolName === 'search_resources') {
          try {
            const params = new URLSearchParams({
              term: args.term,
              limit: String(args.limit || 10)
            });

            const response = await fetch(`https://api.freepik.com/v1/resources?${params}`, {
              headers: { 'x-freepik-api-key': apiKey }
            });

            const data = await response.json();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
              }
            }));
          } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true
              }
            }));
          }
          return;
        }

        // Unknown tool
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` }
        }));
        return;
      }

      // Unknown method
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32601, message: `Unknown method: ${message.method}` }
      }));

    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error) }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
