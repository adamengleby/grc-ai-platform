/**
 * Local test server to verify Worker logic
 */
const http = require('http');

// Import our worker logic (simulate the Worker environment)
const workerCode = `
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
};

function handleCors(method) {
  if (method === 'OPTIONS') {
    return {
      status: 200,
      headers: corsHeaders,
      body: ''
    };
  }
  return null;
}

function handleLLMConfigs() {
  const configs = [
    {
      config_id: '1',
      id: '1',
      name: 'Cloudflare Australian LLM Config',
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      created: new Date().toISOString(),
      region: 'Australia (Cloudflare Edge)'
    },
    {
      config_id: '2',
      id: '2',
      name: 'Azure OpenAI Config (AU Edge)',
      provider: 'azure',
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 4000,
      created: new Date().toISOString(),
      region: 'Australia (Cloudflare Edge)'
    }
  ];

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify({
      success: true,
      message: '🇦🇺 Local test of Cloudflare Worker logic!',
      data: configs,
      timestamp: new Date().toISOString(),
      region: 'Australia (Simulated)'
    })
  };
}

function handleRequest(method, path) {
  console.log(\`🧪 Local test: \${method} \${path}\`);

  const corsResponse = handleCors(method);
  if (corsResponse) return corsResponse;

  switch (path) {
    case '/api/v1/simple-llm-configs':
      return handleLLMConfigs();
    case '/health':
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ status: 'healthy', region: 'Australia (Local Test)' })
      };
    default:
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ error: 'Not found', path })
      };
  }
}

module.exports = { handleRequest };
`;

// Execute the worker code
eval(workerCode);

// Create HTTP server
const server = http.createServer((req, res) => {
  const response = handleRequest(req.method, req.url);

  // Set headers
  Object.entries(response.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.statusCode = response.status;
  res.end(response.body);
});

const port = 3007;
server.listen(port, () => {
  console.log(`🧪 Local Cloudflare Worker test running on http://localhost:${port}`);
  console.log(`Test endpoint: http://localhost:${port}/api/v1/simple-llm-configs`);
});