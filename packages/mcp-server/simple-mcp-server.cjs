#!/usr/bin/env node
/**
 * Simple MCP Server for Testing
 * HTTP-based MCP server that exposes GRC tools without dependencies
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Mock tools data - same as the full MCP server
const TOOLS = [
  {
    name: "get_archer_applications",
    description: "List all active Archer applications and questionnaires available for analysis",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: {
          type: "string",
          description: "Tenant identifier for data scoping"
        }
      },
      required: ["tenant_id"]
    }
  },
  {
    name: "search_archer_records",
    description: "Search and retrieve records from a specific Archer application with privacy protection and field transformation",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: {
          type: "string",
          description: "Tenant identifier for data scoping"
        },
        applicationName: {
          type: "string",
          description: "Name or alias of the Archer application"
        },
        pageSize: {
          type: "number",
          description: "Number of records to return (1-10000, default: 100)",
          minimum: 1,
          maximum: 10000
        },
        pageNumber: {
          type: "number", 
          description: "Page number for pagination (1-based, default: 1)",
          minimum: 1
        }
      },
      required: ["tenant_id", "applicationName"]
    }
  }
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'Simple MCP Server'
  });
});

// Tools endpoint
app.get('/tools', (req, res) => {
  console.error('Received GET /tools request');
  res.json({ tools: TOOLS });
});

// Tool execution endpoint
app.post('/call', (req, res) => {
  const { name, arguments: args } = req.body;
  console.error(`Received POST /call request for tool: ${name}`, args);

  try {
    if (name === 'get_archer_applications') {
      // Mock response for get_archer_applications
      const response = {
        content: [{
          type: "text",
          text: `Mock Archer Applications for tenant ${args.tenant_id}:\n\n1. Risk Management Application\n2. Compliance Framework\n3. Control Testing\n4. Incident Management\n5. Vendor Risk Assessment\n\nNote: This is a mock response. In production, this would connect to the actual Archer instance.`
        }]
      };
      res.json(response);
      
    } else if (name === 'search_archer_records') {
      // Mock response for search_archer_records
      const response = {
        content: [{
          type: "text", 
          text: `Mock Archer Records for application "${args.applicationName}" (tenant: ${args.tenant_id}):\n\nRecord 1: Risk Assessment #001 - High Priority\nRecord 2: Risk Assessment #002 - Medium Priority\nRecord 3: Risk Assessment #003 - Low Priority\n\nShowing page ${args.pageNumber || 1}, ${args.pageSize || 100} records per page.\n\nNote: This is a mock response with privacy protection enabled. Actual records would be masked and transformed.`
        }]
      };
      res.json(response);
      
    } else {
      res.status(400).json({
        error: `Unknown tool: ${name}`,
        available_tools: TOOLS.map(t => t.name)
      });
    }
    
  } catch (error) {
    console.error('Error handling tool call:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Generic MCP JSON-RPC endpoint for compatibility
app.post('/', (req, res) => {
  const { method, params } = req.body;
  console.error(`Received generic MCP request: ${method}`, params);
  
  if (method === 'tools/list') {
    res.json({ tools: TOOLS });
  } else if (method === 'tools/call') {
    // Redirect to the /call endpoint logic
    req.body = { name: params.name, arguments: params.arguments };
    return app._router.handle(req, res);
  } else {
    res.status(400).json({ error: 'Unsupported method', method });
  }
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.error(`Simple MCP Server running on http://localhost:${PORT}`);
  console.error('Available endpoints:');
  console.error('  GET /health - Health check');
  console.error('  GET /tools - List available tools');
  console.error('  POST /call - Execute tools');
  console.error('  POST / - Generic MCP JSON-RPC endpoint');
});