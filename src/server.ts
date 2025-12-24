import { createServer as createHttpServer } from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import createMcpServer from './index.js';

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FREEPIK_API_KEY;

if (!API_KEY) {
  console.error('FREEPIK_API_KEY environment variable is required');
  process.exit(1);
}

// Create the MCP server with config
const mcpServer = createMcpServer({ config: { freepikApiKey: API_KEY } });

// Store active transports
const transports = new Map<string, SSEServerTransport>();

const httpServer = createHttpServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
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

  // SSE endpoint for MCP
  if (url.pathname === '/sse' || url.pathname === '/mcp') {
    console.log('New SSE connection');

    const transport = new SSEServerTransport('/messages', res);
    const sessionId = crypto.randomUUID();
    transports.set(sessionId, transport);

    res.on('close', () => {
      console.log('SSE connection closed:', sessionId);
      transports.delete(sessionId);
    });

    await mcpServer.connect(transport);
    return;
  }

  // Messages endpoint
  if (url.pathname === '/messages' && req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId || !transports.has(sessionId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid session' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const transport = transports.get(sessionId)!;
        await transport.handlePostMessage(req, res, body);
      } catch (error) {
        console.error('Error handling message:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, () => {
  console.log(`Freepik Seedream MCP server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/mcp`);
});
