#!/usr/bin/env node

// @ts-ignore
import express, { Request, Response } from 'express';
// @ts-ignore  
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * HTTP Proxy Server for MCP Server
 * Bridges browser-based React app with stdio-based MCP server
 */

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MCP Client connection management
let mcpClient: Client | null = null;
let isConnected = false;

// Connect to MCP server via stdio
async function connectToMcpServer() {
  try {
    console.log('[Proxy] Connecting to MCP server...');
    
    // Create transport and client
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'packages/mcp-server/src/index.ts'],
      env: Object.fromEntries(
        Object.entries(process.env).filter(([, value]) => value !== undefined)
      ) as Record<string, string>
    });

    mcpClient = new Client({
      name: 'grc-proxy',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    
    console.log('[Proxy] Successfully connected to MCP server');
    isConnected = true;
    
    return true;
  } catch (error) {
    console.error('[Proxy] Failed to connect to MCP server:', error);
    isConnected = false;
    return false;
  }
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    mcpConnected: isConnected,
    timestamp: new Date().toISOString()
  });
});

// List available tools
app.get('/tools', async (_req: Request, res: Response) => {
  try {
    if (!mcpClient || !isConnected) {
      return res.status(503).json({ error: 'MCP server not connected' });
    }

    const tools = await mcpClient.listTools();
    res.json({ tools: tools.tools });
  } catch (error) {
    console.error('[Proxy] Error listing tools:', error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// Call a tool
app.post('/tools/:toolName/call', async (req: Request, res: Response) => {
  try {
    if (!mcpClient || !isConnected) {
      return res.status(503).json({ error: 'MCP server not connected' });
    }

    const { toolName } = req.params;
    const { arguments: toolArgs } = req.body;

    console.log(`[Proxy] Calling tool: ${toolName} with args:`, toolArgs);

    const result = await mcpClient.callTool({
      name: toolName,
      arguments: toolArgs || {}
    });

    res.json({ result });
  } catch (error) {
    console.error(`[Proxy] Error calling tool ${req.params.toolName}:`, error);
    res.status(500).json({ error: `Failed to call tool: ${error instanceof Error ? error.message : String(error)}` });
  }
});

// Server info endpoint
app.get('/info', (_req: Request, res: Response) => {
  res.json({
    name: 'GRC MCP Proxy Server',
    version: '1.0.0',
    status: isConnected ? 'connected' : 'disconnected',
    port: PORT
  });
});

// Start server
async function startServer() {
  // Connect to MCP server first
  const connected = await connectToMcpServer();
  
  if (!connected) {
    console.error('[Proxy] Failed to establish MCP connection, but starting HTTP server anyway...');
  }

  app.listen(PORT, () => {
    console.log(`[Proxy] MCP HTTP Proxy Server running on http://localhost:${PORT}`);
    console.log('[Proxy] Available endpoints:');
    console.log('  GET  /health - Health check');
    console.log('  GET  /tools - List available tools');
    console.log('  POST /tools/:toolName/call - Call a tool');
    console.log('  GET  /info - Server information');
  });
}

startServer().catch(console.error);