#!/usr/bin/env node

/**
 * MCP Server Entry Point
 * Starts the MCP server for RSA Archer GRC Integration
 * Supports both stdio and HTTP modes
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
// Note: These imports are used in HTTP mode for MCP protocol compatibility
// import {
//   CallToolRequestSchema,
//   ListToolsRequestSchema,
// } from '@modelcontextprotocol/sdk/types';
import express from 'express';
import cors from 'cors';

// Import our GRC MCP Server
import { GRCMCPServer } from './server/index';

const args = process.argv.slice(2);
const portFlag = args.find(arg => arg.startsWith('--port='));
const port = portFlag ? parseInt(portFlag.split('=')[1]) : process.env.PORT ? parseInt(process.env.PORT) : null;

if (port) {
  // HTTP Server mode for platform integration
  console.error(`Starting GRC MCP Server in HTTP mode on port ${port}`);
  
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (_, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  
  // Create GRC MCP Server instance
  const grcServer = new GRCMCPServer();
  
  // Initialize the server (no transport needed for HTTP mode)
  console.error('GRC MCP Server initialized for HTTP mode');
  
  // MCP tools endpoint (what the platform is trying to reach)
  app.get('/tools', async (_, res) => {
    try {
      console.error('Received GET /tools request');
      // Use the internal handler through the server instance
      const response = await grcServer.handleListTools();
      res.json({ tools: response.tools });
    } catch (error: any) {
      console.error('Error handling /tools request:', error);
      res.status(500).json({ error: 'Internal server error', details: error?.message || 'Unknown error' });
    }
  });
  
  // MCP call endpoint
  app.post('/call', async (req, res) => {
    try {
      console.error('Received POST /call request:', req.body);
      // Use the internal handler through the server instance
      const response = await grcServer.handleCallTool(req.body);
      res.json(response);
    } catch (error: any) {
      console.error('Error handling /call request:', error);
      res.status(500).json({ error: 'Internal server error', details: error?.message || 'Unknown error' });
    }
  });
  
  // Generic MCP JSON-RPC endpoint for compatibility
  app.post('/', async (req, res) => {
    try {
      console.error('Received generic MCP request:', req.body);
      const { method, params } = req.body;
      
      if (method === 'tools/list') {
        const response = await grcServer.handleListTools();
        res.json({ tools: response.tools });
      } else if (method === 'tools/call') {
        const response = await grcServer.handleCallTool(params);
        res.json(response);
      } else {
        res.status(400).json({ error: 'Unsupported method', method });
      }
    } catch (error: any) {
      console.error('Error handling generic MCP request:', error);
      res.status(500).json({ error: 'Internal server error', details: error?.message || 'Unknown error' });
    }
  });
  
  app.listen(port, () => {
    console.error(`GRC MCP Server running on http://localhost:${port}`);
  });
  
} else {
  // Stdio mode (default)
  console.error('GRC Production MCP Server running on stdio');
  
  const grcServer = new GRCMCPServer();
  const server = grcServer.serverInstance;
  const transport = new StdioServerTransport();
  
  server.connect(transport);
}