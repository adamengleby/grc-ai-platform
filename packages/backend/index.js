// Azure Functions Node.js handler
module.exports = async function (context, req) {
  console.log(`Azure Functions request: ${req.method} ${req.url}`);

  // Set CORS headers
  context.res = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    }
  };

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    context.res.body = '';
    return;
  }

  try {
    // Parse the URL to get the path
    const url = new URL(req.url, 'https://func-grc-backend-prod.azurewebsites.net');
    const path = url.pathname;

    console.log(`Processing path: ${path}`);

    // Health endpoint
    if (path === '/health' || path === '/api/health') {
      context.res.status = 200;
      context.res.body = JSON.stringify({
        status: 'healthy',
        timestamp: new Date(),
        version: '1.0.0',
        service: 'GRC Analytics Platform Backend (Azure Functions)',
        path: path,
        method: req.method
      });
      return;
    }

    // API health endpoint
    if (path === '/api/v1/health') {
      context.res.status = 200;
      context.res.body = JSON.stringify({
        status: 'healthy',
        timestamp: new Date(),
        version: '1.0.0',
        service: 'GRC Analytics Platform API (Azure Functions)',
        path: path,
        method: req.method
      });
      return;
    }

    // Simple LLM configs endpoint
    if (path === '/api/v1/simple-llm-configs') {
      if (req.method === 'GET') {
        context.res.status = 200;
        context.res.body = JSON.stringify({
          success: true,
          data: [
            {
              id: 'openai-gpt4',
              name: 'OpenAI GPT-4',
              provider: 'openai',
              model: 'gpt-4',
              isDefault: true,
              endpoint: 'https://api.openai.com/v1',
              temperature: 0.7,
              maxTokens: 4096
            },
            {
              id: 'azure-openai',
              name: 'Azure OpenAI GPT-4',
              provider: 'azure',
              model: 'gpt-4',
              isDefault: false,
              endpoint: 'https://your-resource.openai.azure.com',
              temperature: 0.7,
              maxTokens: 4096
            }
          ],
          message: 'LLM configurations retrieved successfully',
          timestamp: new Date()
        });
        return;
      }

      if (req.method === 'POST') {
        context.res.status = 201;
        context.res.body = JSON.stringify({
          success: true,
          data: {
            id: 'new-config-' + Date.now(),
            ...req.body,
            createdAt: new Date()
          },
          message: 'LLM configuration created successfully'
        });
        return;
      }
    }

    // Simple agents endpoint
    if (path === '/api/v1/simple-agents') {
      if (req.method === 'GET') {
        context.res.status = 200;
        context.res.body = JSON.stringify({
          success: true,
          data: [
            {
              id: 'data-quality-agent',
              name: 'Data Quality Checker',
              type: 'data_quality',
              description: 'AI-powered data quality classification',
              isActive: true
            },
            {
              id: 'risk-insights-agent',
              name: 'Risk Insights Generator',
              type: 'risk_analysis',
              description: 'Strategic risk analysis and insights',
              isActive: true
            }
          ],
          message: 'Agents retrieved successfully',
          timestamp: new Date()
        });
        return;
      }
    }

    // Simple credentials endpoint
    if (path === '/api/v1/simple-credentials') {
      if (req.method === 'GET') {
        context.res.status = 200;
        context.res.body = JSON.stringify({
          success: true,
          data: [
            {
              id: 'openai-key',
              name: 'OpenAI API Key',
              type: 'api_key',
              provider: 'openai',
              isConfigured: true,
              lastUsed: new Date()
            }
          ],
          message: 'Credentials retrieved successfully',
          timestamp: new Date()
        });
        return;
      }
    }

    // Simple MCP configs endpoint
    if (path === '/api/v1/simple-mcp-configs') {
      if (req.method === 'GET') {
        context.res.status = 200;
        context.res.body = JSON.stringify({
          success: true,
          data: [
            {
              id: 'archer-mcp',
              name: 'RSA Archer GRC MCP Server',
              serverType: 'stdio',
              isEnabled: true,
              toolsCount: 25
            }
          ],
          message: 'MCP configurations retrieved successfully',
          timestamp: new Date()
        });
        return;
      }
    }

    // MCP servers tools endpoint
    if (path === '/api/v1/mcp-servers/tools') {
      context.res.status = 200;
      context.res.body = JSON.stringify({
        success: true,
        data: {
          tools: [
            {
              name: 'list_applications',
              description: 'List all applications in RSA Archer',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'get_records',
              description: 'Get records from an application',
              inputSchema: {
                type: 'object',
                properties: {
                  applicationId: { type: 'number' },
                  moduleId: { type: 'number' }
                }
              }
            }
          ],
          server: 'GRC Analytics MCP Server',
          connected: true
        },
        message: 'MCP tools retrieved successfully',
        timestamp: new Date()
      });
      return;
    }

    // Default 404 response
    context.res.status = 404;
    context.res.body = JSON.stringify({
      error: 'Not Found',
      message: `Endpoint ${path} not found`,
      availableEndpoints: [
        '/health',
        '/api/v1/health',
        '/api/v1/simple-llm-configs',
        '/api/v1/simple-agents',
        '/api/v1/simple-credentials',
        '/api/v1/simple-mcp-configs',
        '/api/v1/mcp-servers/tools'
      ],
      timestamp: new Date(),
      path: path,
      method: req.method
    });

  } catch (error) {
    console.error('Azure Functions handler error:', error);
    context.res.status = 500;
    context.res.body = JSON.stringify({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date()
    });
  }
};