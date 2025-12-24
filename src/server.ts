import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import createMcpServer from './index.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

// Store active transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // Health check
  if ((url.pathname === '/' || url.pathname === '/health') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'freepik-seedream-mcp',
      version: '1.0.0',
      mcp: '/mcp'
    }));
    return;
  }

  // MCP endpoint
  if (url.pathname === '/mcp') {
    // Get session ID from header
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // Handle DELETE for session cleanup
    if (req.method === 'DELETE') {
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.close();
        transports.delete(sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
      }
      return;
    }

    // Handle POST for MCP messages
    if (req.method === 'POST') {
      try {
        // Read body
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        const message = JSON.parse(body);
        console.log('Received MCP message:', JSON.stringify(message, null, 2));

        // Check if this is an initialize request (new session)
        const isInitialize = message.method === 'initialize';

        let transport: StreamableHTTPServerTransport;

        if (isInitialize) {
          // Use environment variable for API key (set in Smithery)
          const apiKey = process.env.FREEPIK_API_KEY || '';

          // Also check query parameter as fallback
          let config = { freepikApiKey: apiKey };
          const configParam = url.searchParams.get('config');
          if (configParam) {
            try {
              const decoded = JSON.parse(Buffer.from(configParam, 'base64').toString('utf-8'));
              if (decoded.freepikApiKey) {
                config.freepikApiKey = decoded.freepikApiKey;
              }
            } catch (e) {
              console.error('Failed to parse config:', e);
            }
          }

          if (!config.freepikApiKey) {
            console.error('No FREEPIK_API_KEY found in env or config');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              error: {
                code: -32602,
                message: 'Missing FREEPIK_API_KEY environment variable'
              }
            }));
            return;
          }

          console.log('Using API key:', config.freepikApiKey.substring(0, 8) + '...');

          // Create new transport and server
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
          });

          // Create MCP server with config
          const mcpServer = createMcpServer({ config });

          // Connect transport to server
          await mcpServer.connect(transport);

          // Store transport for future messages
          const newSessionId = transport.sessionId;
          if (newSessionId) {
            transports.set(newSessionId, transport);
          }

          console.log('New session created:', newSessionId);

        } else if (sessionId && transports.has(sessionId)) {
          // Use existing transport
          transport = transports.get(sessionId)!;
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32600,
              message: 'Invalid or missing session ID'
            }
          }));
          return;
        }

        // Handle the message through transport
        await transport.handleRequest(req, res, body);

      } catch (error) {
        console.error('MCP Error:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error'
            }
          }));
        }
      }
      return;
    }

    // Handle GET for SSE stream
    if (req.method === 'GET') {
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session ID required for SSE' }));
      }
      return;
    }
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, () => {
  console.log(`Freepik Seedream MCP server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
