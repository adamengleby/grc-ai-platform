#!/usr/bin/env node

/**
 * MCP Server with Native SSE Transport
 * Implements proper MCP SSE transport for real-time streaming capabilities
 * Replaces the custom HTTP wrapper with standards-compliant MCP transport
 */

import express from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { GRCMCPServer } from './server/index.js';

const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(cors({
  origin: ['http://localhost:3005', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Store active SSE connections by session ID
const activeConnections = new Map<string, SSEServerTransport>();

// MCP Standard Endpoint - handles both HTTP and SSE transport
app.all('/mcp', async (req, res) => {
  const acceptsSSE = req.headers.accept?.includes('text/event-stream');
  
  if (req.method === 'GET' && acceptsSSE) {
    // SSE Transport - establish connection
    console.log('[MCP Standard] SSE transport requested');
    
    try {
      const transport = new SSEServerTransport('/mcp', res);
      const grcServer = new GRCMCPServer();
      const server = grcServer.serverInstance;
      
      // Set up transport event handlers
      transport.onclose = () => {
        console.log(`[MCP Standard] SSE connection closed: ${transport.sessionId}`);
        activeConnections.delete(transport.sessionId);
      };
      
      transport.onerror = (error) => {
        console.error(`[MCP Standard] Transport error: ${error.message}`);
        activeConnections.delete(transport.sessionId);
      };
      
      // Connect server to transport (this automatically starts the transport)
      await server.connect(transport);
      
      // Store connection for message routing
      activeConnections.set(transport.sessionId, transport);
      
      console.log(`[MCP Standard] SSE connection established: ${transport.sessionId}`);
      console.log(`[MCP Standard] Client should POST to: /mcp with session ID`);
      
    } catch (error: any) {
      console.error('[MCP Standard] SSE connection failed:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to establish SSE connection',
          details: error.message
        });
      }
    }
    
  } else if (req.method === 'POST') {
    // HTTP Transport - handle JSON-RPC requests
    console.log('[MCP Standard] HTTP JSON-RPC request received:', req.body);
    
    try {
      const grcServer = new GRCMCPServer();
      let result;
      
      // Handle different JSON-RPC methods
      if (req.body.method === 'tools/list') {
        result = await grcServer.handleListTools();
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result
        });
        
      } else if (req.body.method === 'tools/call') {
        const { name, arguments: args } = req.body.params;
        result = await grcServer.handleCallTool({ name, arguments: args });
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result
        });
        
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32601,
            message: 'Method not found',
            data: { method: req.body.method }
          }
        });
      }
      
    } catch (error: any) {
      console.error('[MCP Standard] JSON-RPC error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      });
    }
    
  } else {
    // Invalid request
    res.status(405).json({
      error: 'Method not allowed',
      hint: 'Use GET with Accept: text/event-stream for SSE, or POST with JSON-RPC'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'MCP Standard Server',
    version: '1.0.0',
    transport: 'http+sse',
    activeConnections: activeConnections.size,
    standardEndpoint: '/mcp'
  });
});

// Legacy tools endpoint - redirect to MCP standard
app.get('/tools', async (req, res) => {
  console.log('[MCP Standard] Legacy /tools request - using standard MCP JSON-RPC');
  
  try {
    const grcServer = new GRCMCPServer();
    const response = await grcServer.handleListTools();
    
    res.json({
      jsonrpc: '2.0',
      id: 'tools-legacy',
      result: response,
      _legacy: true,
      _hint: 'Use POST /mcp with {"jsonrpc":"2.0","method":"tools/list"} for standard MCP'
    });
  } catch (error: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: 'tools-legacy',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      }
    });
  }
});

// MCP SSE endpoint - establish SSE connection
app.get('/sse', async (req, res) => {
  console.log('[MCP SSE] New SSE connection request');
  
  try {
    // Create MCP SSE transport with correct parameters
    const transport = new SSEServerTransport('/messages', res);
    const grcServer = new GRCMCPServer();
    const server = grcServer.serverInstance;
    
    // Set up transport event handlers
    transport.onclose = () => {
      console.log(`[MCP SSE] Connection closed: ${transport.sessionId}`);
      activeConnections.delete(transport.sessionId);
    };
    
    transport.onerror = (error) => {
      console.error(`[MCP SSE] Transport error: ${error.message}`);
      activeConnections.delete(transport.sessionId);
    };
    
    // Start the SSE transport (this is required before connecting server)
    await transport.start();
    
    // Connect server to transport
    await server.connect(transport);
    
    // Store connection for message routing
    activeConnections.set(transport.sessionId, transport);
    
    console.log(`[MCP SSE] SSE connection established: ${transport.sessionId}`);
    console.log(`[MCP SSE] Client should POST messages to: /messages/${transport.sessionId}`);
    
  } catch (error: any) {
    console.error('[MCP SSE] Failed to establish SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to establish SSE connection',
        details: error.message
      });
    }
  }
});

// MCP Message endpoint - handle POST messages from clients
app.post('/messages/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  
  console.log(`[MCP SSE] Received message for session: ${sessionId || 'unknown'}`);
  console.log(`[MCP SSE] Message:`, req.body);
  
  if (!sessionId) {
    // Legacy endpoint support - find the first active connection
    const firstConnection = activeConnections.values().next().value;
    if (firstConnection) {
      console.log(`[MCP SSE] Using first available connection: ${firstConnection.sessionId}`);
      await firstConnection.handlePostMessage(req, res);
      return;
    } else {
      res.status(400).json({
        error: 'No active SSE connection found',
        hint: 'Establish an SSE connection first by GET /sse'
      });
      return;
    }
  }
  
  // Route message to specific session
  const transport = activeConnections.get(sessionId);
  if (!transport) {
    res.status(404).json({
      error: `SSE session not found: ${sessionId}`,
      activeSessions: Array.from(activeConnections.keys())
    });
    return;
  }
  
  try {
    await transport.handlePostMessage(req, res);
    console.log(`[MCP SSE] Message handled for session: ${sessionId}`);
  } catch (error: any) {
    console.error(`[MCP SSE] Error handling message for ${sessionId}:`, error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to handle message',
        details: error.message
      });
    }
  }
});

// Generic /messages endpoint (for clients that don't specify session)
app.post('/messages', async (req, res) => {
  // Handle messages without specific session ID
  const firstConnection = activeConnections.values().next().value;
  if (firstConnection) {
    console.log(`[MCP SSE] Using first available connection: ${firstConnection.sessionId}`);
    await firstConnection.handlePostMessage(req, res);
    return;
  } else {
    res.status(400).json({
      error: 'No active SSE connection found',
      hint: 'Establish an SSE connection first by GET /sse'
    });
    return;
  }
});

// Legacy /call endpoint for backward compatibility with existing clients
app.post('/call', async (req, res) => {
  const { name, arguments: args } = req.body;
  
  console.log(`[MCP SSE] Legacy /call endpoint: ${name}`);
  
  if (!name) {
    res.status(400).json({
      success: false,
      error: 'Tool name is required'
    });
    return;
  }
  
  // Convert to MCP JSON-RPC format
  const mcpRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: name,
      arguments: args || {}
    }
  };
  
  // Use the first available connection for legacy support
  const firstConnection = activeConnections.values().next().value;
  if (!firstConnection) {
    res.status(503).json({
      success: false,
      error: 'No SSE connection available',
      hint: 'Client should establish SSE connection first'
    });
    return;
  }
  
  try {
    // Create a mock request/response for the transport
    const mockReq = Object.assign(req, { body: mcpRequest });
    await firstConnection.handleMessage(mcpRequest);
    
    // Note: In a real SSE setup, the response would be sent via the SSE stream
    // For backward compatibility, we'll return a success response
    res.json({
      success: true,
      message: 'Request sent via SSE transport',
      sessionId: firstConnection.sessionId,
      hint: 'Listen to SSE stream for actual response'
    });
    
  } catch (error: any) {
    console.error('[MCP SSE] Error in legacy call:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Status endpoint to show active connections
app.get('/status', (req, res) => {
  res.json({
    service: 'MCP SSE Server',
    transport: 'Server-Sent Events (SSE)',
    activeConnections: Array.from(activeConnections.keys()),
    endpoints: {
      sse: '/sse (GET - establish connection)',
      messages: '/messages/:sessionId (POST - send messages)',
      tools: '/tools (GET - list available tools)',
      health: '/health (GET - health check)',
      status: '/status (GET - this endpoint)'
    },
    usage: {
      establish: 'GET /sse to establish SSE connection',
      send: 'POST /messages/:sessionId with MCP JSON-RPC message',
      legacy: 'POST /call with {name, arguments} for backward compatibility'
    }
  });
});

/**
 * Start MCP SSE Server
 */
app.listen(PORT, () => {
  console.log(`🚀 MCP SSE Server started on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`🔧 Tools: http://localhost:${PORT}/tools`);
  console.log(`⚡ SSE: GET http://localhost:${PORT}/sse`);
  console.log(`💬 Messages: POST http://localhost:${PORT}/messages/:sessionId`);
  console.log(`📊 Status: http://localhost:${PORT}/status`);
  console.log(`🔗 Native MCP SSE Transport Ready!`);
});

export default app;