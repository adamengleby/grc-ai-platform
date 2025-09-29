const http = require('http');
const url = require('url');
const querystring = require('querystring');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
  'Content-Type': 'application/json'
};

// Simple LLM configurations
const llmConfigs = [
  {
    config_id: '1',
    id: '1',
    name: 'Sydney Azure OpenAI',
    description: 'Azure OpenAI from Sydney region',
    provider: 'azure',
    model: 'gpt-4',
    endpoint: 'https://your-azure-openai.openai.azure.com/',
    api_key: 'placeholder-key',
    temperature: 0.7,
    max_tokens: 4000,
    is_enabled: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Simple agents data
let agents = [];

// Route handler
function handleRequest(req, res) {
  // Set CORS headers
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${path}`);

  // Health endpoint
  if (path === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      region: 'Australia Southeast',
      service: 'Simple Node.js Server'
    }));
    return;
  }

  // API routes
  if (path === '/api/v1/simple-llm-configs') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      data: { llm_configs: llmConfigs },
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (path === '/api/v1/simple-agents') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      data: {
        agents,
        total: agents.length,
        tenant_id: 'demo-tenant',
        database_type: 'Memory',
        replacement_status: 'active'
      },
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (path === '/api/v1/simple-agents/test-database') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      data: {
        database_status: 'connected',
        health_check: {
          memory_storage: true,
          api_endpoints: true,
          cors_enabled: true
        },
        multi_tenant_ready: true,
        sample_data: {
          agents_count: agents.length,
          llm_configs_count: llmConfigs.length
        }
      },
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Root endpoint
  if (path === '/' || path === '/api/v1/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      message: 'GRC Backend API - Sydney, Australia',
      timestamp: new Date().toISOString(),
      region: 'Australia Southeast',
      endpoints: [
        '/health',
        '/api/v1/simple-llm-configs',
        '/api/v1/simple-agents',
        '/api/v1/simple-agents/test-database'
      ]
    }));
    return;
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({
    success: false,
    error: 'Endpoint not found',
    path: path
  }));
}

const port = process.env.PORT || 8080;
const server = http.createServer(handleRequest);

server.listen(port, () => {
  console.log(`🇦🇺 Sydney Backend Server running on port ${port}`);
  console.log(`Server started at ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});