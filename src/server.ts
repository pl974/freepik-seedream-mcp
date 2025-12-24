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

  // Health check
  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'freepik-seedream-mcp' }));
    return;
  }

  // MCP endpoint
  if (url.pathname === '/mcp' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      const message = JSON.parse(body);

      // Get config from query
      let apiKey = process.env.FREEPIK_API_KEY || '';
      const configParam = url.searchParams.get('config');
      if (configParam) {
        try {
          const decoded = JSON.parse(Buffer.from(configParam, 'base64').toString('utf-8'));
          if (decoded.freepikApiKey) apiKey = decoded.freepikApiKey;
        } catch (e) {}
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

        if (!apiKey) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [{ type: 'text', text: 'Error: No Freepik API key configured' }],
              isError: true
            }
          }));
          return;
        }

        if (toolName === 'seedream_generate') {
          try {
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
