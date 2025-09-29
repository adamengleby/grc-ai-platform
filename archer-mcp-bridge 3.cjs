#!/usr/bin/env node

/**
 * HTTP Bridge for Archer MCP Server
 * Wraps the working Archer MCP server and provides HTTP endpoints
 * that preserve existing API contracts while using the proper Archer implementation
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Global MCP server process and communication state
let mcpServer = null;
let requestQueue = [];
let isServerReady = false;
let requestIdCounter = 1;

console.log('🚀 Starting Archer MCP HTTP Bridge...');

/**
 * Start the PoC MCP server with stdio transport
 */
function startMcpServer() {
  const serverPath = path.join(__dirname, 'archer-mcp-poc/dist/index.js');
  console.log(`📡 Starting PoC MCP server: ${serverPath}`);
  
  mcpServer = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: path.join(__dirname, 'archer-mcp-poc'),
    env: {
      ...process.env,
      // Set environment variables for Archer connection
      ARCHER_BASE_URL: process.env.ARCHER_BASE_URL || 'https://hostplus-uat.archerirm.com.au',
      ARCHER_INSTANCE: process.env.ARCHER_INSTANCE || '710100', 
      ARCHER_USERNAME: process.env.ARCHER_USERNAME || 'api_test',
      ARCHER_PASSWORD: process.env.ARCHER_PASSWORD || 'Password1!.'
    }
  });

  mcpServer.stdout.on('data', (data) => {
    const messages = data.toString().trim().split('\n');
    messages.forEach(message => {
      if (message.trim()) {
        try {
          const response = JSON.parse(message);
          handleMcpResponse(response);
        } catch (error) {
          console.log('📡 MCP Server Output:', message);
        }
      }
    });
  });

  mcpServer.stderr.on('data', (data) => {
    console.log('📡 MCP Server Debug:', data.toString());
  });

  mcpServer.on('error', (error) => {
    console.error('❌ MCP Server Error:', error);
    isServerReady = false;
  });

  mcpServer.on('exit', (code) => {
    console.log(`📡 MCP Server exited with code ${code}`);
    isServerReady = false;
    // Restart server after 2 seconds
    setTimeout(startMcpServer, 2000);
  });

  // Initialize the server
  setTimeout(() => {
    initializeMcpServer();
  }, 1000);
}

/**
 * Initialize MCP server with proper handshake
 */
function initializeMcpServer() {
  console.log('🤝 Initializing MCP server...');
  
  const initMessage = {
    jsonrpc: '2.0',
    id: requestIdCounter++,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'archer-mcp-bridge',
        version: '1.0.0'
      }
    }
  };

  sendToMcpServer(initMessage);
}

/**
 * Send message to MCP server
 */
function sendToMcpServer(message) {
  if (mcpServer && mcpServer.stdin) {
    mcpServer.stdin.write(JSON.stringify(message) + '\n');
  }
}

/**
 * Handle responses from MCP server
 */
function handleMcpResponse(response) {
  console.log('📨 MCP Response:', { id: response.id, method: response.method, hasResult: !!response.result, hasError: !!response.error });
  
  if (response.method === 'initialize' || (response.id === 1 && response.result)) {
    isServerReady = true;
    console.log('✅ MCP Server ready!');
    
    // Process queued requests
    processRequestQueue();
  }

  // Find pending request in queue
  const requestIndex = requestQueue.findIndex(req => req.id === response.id);
  if (requestIndex >= 0) {
    const pendingRequest = requestQueue[requestIndex];
    requestQueue.splice(requestIndex, 1);
    
    if (response.error) {
      pendingRequest.reject(new Error(response.error.message || 'MCP Error'));
    } else {
      pendingRequest.resolve(response.result);
    }
  }
}

/**
 * Process queued requests when server becomes ready
 */
function processRequestQueue() {
  requestQueue.forEach(request => {
    if (!request.sent) {
      sendToMcpServer(request.message);
      request.sent = true;
    }
  });
}

/**
 * Call MCP server method and return promise
 */
function callMcpMethod(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = requestIdCounter++;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    const request = {
      id,
      message,
      resolve,
      reject,
      sent: false,
      timestamp: Date.now()
    };

    requestQueue.push(request);

    if (isServerReady) {
      sendToMcpServer(message);
      request.sent = true;
    }

    // Timeout after 30 seconds
    setTimeout(() => {
      const index = requestQueue.findIndex(req => req.id === id);
      if (index >= 0) {
        requestQueue.splice(index, 1);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

/**
 * HTTP Endpoints that preserve existing API contracts
 */

// GET /tools - Return available tools (preserves existing contract)
app.get('/tools', async (req, res) => {
  try {
    console.log('🔧 GET /tools - Fetching available tools from PoC server...');
    
    const result = await callMcpMethod('tools/list');
    
    // Transform PoC response to match expected format
    const tools = result.tools || [];
    
    console.log(`✅ Returning ${tools.length} tools from PoC server`);
    res.json({ tools });
    
  } catch (error) {
    console.error('❌ Error fetching tools:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tools from MCP server',
      details: error.message 
    });
  }
});

// POST /tools/:toolId/call - Execute tool (preserves existing contract)
app.post('/tools/:toolId/call', async (req, res) => {
  try {
    const { toolId } = req.params;
    const { arguments: args } = req.body;
    
    console.log(`🔧 POST /tools/${toolId}/call - Executing tool via PoC server...`);
    console.log('📝 Arguments:', { 
      toolId, 
      hasTenantId: !!args?.tenant_id,
      hasArcherConnection: !!args?.archer_connection,
      argKeys: Object.keys(args || {})
    });
    
    const result = await callMcpMethod('tools/call', {
      name: toolId,
      arguments: args || {}
    });
    
    console.log('✅ Tool execution successful');
    
    // Return result in expected format
    res.json({
      success: true,
      result: result.content?.[0]?.text || result.result || result,
      toolUsed: toolId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Error executing tool ${req.params.toolId}:`, error);
    
    // Return error in expected format but with helpful details
    res.status(500).json({
      success: false,
      error: `Tool execution failed: ${error.message}`,
      result: `Failed to execute ${req.params.toolId}: ${error.message}`,
      toolUsed: req.params.toolId,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mcpServerReady: isServerReady,
    queuedRequests: requestQueue.length,
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 HTTP Bridge listening on port ${PORT}`);
  console.log(`📡 Bridging to PoC MCP server with proper Archer authentication`);
  startMcpServer();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down HTTP bridge...');
  if (mcpServer) {
    mcpServer.kill();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down HTTP bridge...');
  if (mcpServer) {
    mcpServer.kill();
  }
  process.exit(0);
});