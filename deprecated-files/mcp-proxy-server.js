#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
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
let mcpClient = null;
let isConnected = false;

// Connect to MCP server
async function connectToMcpServer() {
  try {
    console.log('[Proxy] Connecting to MCP server...');
    
    // Create client first
    mcpClient = new Client(
      {
        name: 'grc-proxy-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );
    
    // Create transport and connect to production server
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['grc-mcp-server-production.js']
    });
    
    // Connect to MCP server
    await mcpClient.connect(transport);
    isConnected = true;
    
    console.log('[Proxy] Successfully connected to MCP server');
    
  } catch (error) {
    console.error('[Proxy] Failed to connect to MCP server:', error);
    console.error('[Proxy] Error details:', error.stack);
    isConnected = false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mcpConnected: mcpClient !== null && isConnected,
    mcpClientExists: mcpClient !== null,
    isConnectedFlag: isConnected,
    timestamp: new Date().toISOString()
  });
});

// List available tools
app.get('/tools', async (req, res) => {
  try {
    if (!mcpClient || !isConnected) {
      return res.status(503).json({
        error: 'MCP server not connected'
      });
    }
    
    const result = await mcpClient.listTools();
    res.json(result);
  } catch (error) {
    console.error('[Proxy] Error listing tools:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Call MCP tool
app.post('/tools/:toolName/call', async (req, res) => {
  try {
    if (!mcpClient || !isConnected) {
      return res.status(503).json({
        error: 'MCP server not connected'
      });
    }
    
    const { toolName } = req.params;
    const { arguments: toolArgs } = req.body;
    
    console.log(`[Proxy] Calling tool: ${toolName} with args:`, toolArgs);
    
    const result = await mcpClient.callTool({
      name: toolName,
      arguments: toolArgs || {}
    });
    
    res.json(result);
  } catch (error) {
    console.error(`[Proxy] Error calling tool ${req.params.toolName}:`, error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get server info
app.get('/info', async (req, res) => {
  try {
    if (!mcpClient || !isConnected) {
      return res.status(503).json({
        error: 'MCP server not connected'
      });
    }
    
    // Get server info (this might not be available in all MCP implementations)
    res.json({
      name: 'GRC Multi-tenant MCP Server',
      version: '1.0.0',
      connected: isConnected,
      proxy: {
        version: '1.0.0',
        port: PORT
      }
    });
  } catch (error) {
    console.error('[Proxy] Error getting server info:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('[Proxy] Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error'
  });
});

// Start server
async function startServer() {
  try {
    // Connect to MCP server first
    await connectToMcpServer();
    
    // Start HTTP proxy server
    app.listen(PORT, () => {
      console.log(`[Proxy] MCP HTTP Proxy Server running on http://localhost:${PORT}`);
      console.log(`[Proxy] Available endpoints:`);
      console.log(`  GET  /health - Health check`);
      console.log(`  GET  /tools - List available tools`);
      console.log(`  POST /tools/:toolName/call - Call a tool`);
      console.log(`  GET  /info - Server information`);
    });
  } catch (error) {
    console.error('[Proxy] Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Proxy] Shutting down gracefully...');
  
  if (mcpClient && isConnected) {
    try {
      await mcpClient.close();
      console.log('[Proxy] MCP client disconnected');
    } catch (error) {
      console.error('[Proxy] Error disconnecting MCP client:', error);
    }
  }
  
  process.exit(0);
});

// Start the proxy server
startServer();