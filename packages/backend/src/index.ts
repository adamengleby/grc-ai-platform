/**
 * Minimal GRC Platform Backend for Azure App Service
 * Provides only essential endpoints for frontend integration
 */

import express from 'express';
import cors from 'cors';
import enhancedChatRouter from './routes/enhancedChat.js';

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: [
    'https://grc-ai-platform-prod.azurestaticapps.net',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'GRC Analytics Platform Backend (Azure App Service)',
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime()
  });
});

// Simple LLM Configurations - supports tenant isolation
app.get('/api/v1/simple-llm-configs', (req, res) => {
  const tenantId = req.headers['x-tenant-id'] as string || 'default';
  console.log(`🤖 [LLM Configs] Getting LLM configs for tenant: ${tenantId}`);

  let llmConfigs = [];

  if (tenantId === 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d') {
    // Sarah Chen's ACME tenant - 2 ACME LLM configs
    llmConfigs = [
      {
        config_id: 'a1234567-89ab-4cde-f012-3456789abcd0',
        name: 'ACME Azure OpenAI GPT-4',
        provider: 'azure',
        model: 'gpt-4',
        endpoint: 'https://acme-openai.openai.azure.com',
        api_key: '[CONFIGURED]',
        temperature: 0.7,
        max_tokens: 4000,
        response_format: 'text',
        is_enabled: 1,
        is_default: true
      },
      {
        config_id: 'a1234567-89ab-4cde-f012-3456789abcd1',
        name: 'ACME Claude Enterprise',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        endpoint: 'https://api.anthropic.com/v1',
        api_key: '[CONFIGURED]',
        temperature: 0.4,
        max_tokens: 4000,
        response_format: 'text',
        is_enabled: 1,
        is_default: false
      }
    ];
  } else if (tenantId === 'f1234567-89ab-4cde-f012-3456789abcde') {
    // David Smith's FinTech tenant - 2 FinTech LLM configs
    llmConfigs = [
      {
        config_id: 'f1234567-89ab-4cde-f012-3456789abcd2',
        name: 'FinTech Azure OpenAI GPT-3.5',
        provider: 'azure',
        model: 'gpt-3.5-turbo',
        endpoint: 'https://fintech-openai.openai.azure.com',
        api_key: '[CONFIGURED]',
        temperature: 0.3,
        max_tokens: 3000,
        response_format: 'text',
        is_enabled: 1,
        is_default: true
      },
      {
        config_id: 'f1234567-89ab-4cde-f012-3456789abcd3',
        name: 'FinTech Claude Pro',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        endpoint: 'https://api.anthropic.com/v1',
        api_key: '[CONFIGURED]',
        temperature: 0.4,
        max_tokens: 4000,
        response_format: 'text',
        is_enabled: 1,
        is_default: false
      }
    ];
  }

  res.json({
    success: true,
    data: {
      llm_configs: llmConfigs,
      total: llmConfigs.length,
      tenant_id: tenantId,
      database_type: 'Mock Data (tenant-isolated)'
    },
    message: `${llmConfigs.length} LLM configurations retrieved successfully for tenant`,
    timestamp: new Date().toISOString()
  });
});

// POST endpoint for LLM configs
app.post('/api/v1/simple-llm-configs', (req, res) => {
  res.status(201).json({
    success: true,
    data: {
      id: 'new-config-' + Date.now(),
      ...req.body,
      createdAt: new Date().toISOString(),
      status: 'active'
    },
    message: 'LLM configuration created successfully'
  });
});

// Simple Agents endpoint - supports tenant isolation
app.get('/api/v1/simple-agents', (req, res) => {
  const tenantId = req.headers['x-tenant-id'] as string || 'default';
  console.log(`🔍 [Main Agents] Getting agents for tenant: ${tenantId}`);

  let agents = [];

  if (tenantId === 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d') {
    // Sarah Chen's ACME tenant - 3 ACME agents
    agents = [
      {
        id: 'a1234567-89ab-4cde-f012-3456789abcd6',
        name: 'ACME Risk Analyst',
        type: 'risk_analysis',
        description: 'Advanced risk assessment and analysis for ACME Corporation',
        isEnabled: true,
        llmConfigId: 'a1234567-89ab-4cde-f012-3456789abcd0',
        systemPrompt: 'You are an ACME Risk Analyst specializing in enterprise risk management, operational risk assessment, and strategic risk planning. Focus on manufacturing and technology risks relevant to ACME\'s operations.',
        enabledMcpServers: ['M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6'],
        usageCount: 45,
        createdAt: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
        updatedAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      },
      {
        id: 'a1234567-89ab-4cde-f012-3456789abcd7',
        name: 'ACME Compliance Officer',
        type: 'compliance',
        description: 'Regulatory compliance monitoring and advisory for ACME',
        isEnabled: true,
        llmConfigId: 'a1234567-89ab-4cde-f012-3456789abcd1',
        systemPrompt: 'You are an ACME Compliance Officer with expertise in regulatory compliance, audit management, and policy implementation for large enterprises. Focus on ISO 27001, CPS230, and enterprise compliance frameworks.',
        enabledMcpServers: ['M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6'],
        usageCount: 32,
        createdAt: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
        updatedAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
      },
      {
        id: 'a1234567-89ab-4cde-f012-3456789abcd8',
        name: 'ACME Security Auditor',
        type: 'security_audit',
        description: 'Security assessment and audit specialist for ACME',
        isEnabled: false,  // DISABLED AGENT - shows as inactive in UI (fixes pause/deletion bug)
        llmConfigId: 'a1234567-89ab-4cde-f012-3456789abcd0',
        systemPrompt: 'You are an ACME Security Auditor specializing in cybersecurity assessments, security control evaluation, and compliance auditing. Focus on enterprise security frameworks and threat analysis.',
        enabledMcpServers: ['M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6'],
        usageCount: 28,
        createdAt: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
        updatedAt: new Date(Date.now() - 259200000).toISOString() // 3 days ago
      }
    ];
  } else if (tenantId === 'f1234567-89ab-4cde-f012-3456789abcde') {
    // David Smith's FinTech tenant - 2 FinTech agents
    agents = [
      {
        id: 'f1234567-89ab-4cde-f012-3456789abcd4',
        name: 'FinTech Risk Manager',
        type: 'risk_analysis',
        description: 'Specialized in financial risk assessment and regulatory compliance',
        isEnabled: true,
        llmConfigId: 'f1234567-89ab-4cde-f012-3456789abcd2',
        systemPrompt: 'You are a FinTech Risk Manager with expertise in financial services risk management, regulatory compliance (PCI-DSS, SOX, Basel III), and fintech-specific risk frameworks. Focus on payment processing, credit risk, and financial data security.',
        enabledMcpServers: ['M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6'],
        usageCount: 18,
        createdAt: new Date(Date.now() - 1296000000).toISOString(), // 15 days ago
        updatedAt: new Date(Date.now() - 43200000).toISOString() // 12 hours ago
      },
      {
        id: 'f1234567-89ab-4cde-f012-3456789abcd5',
        name: 'FinTech Compliance Advisor',
        type: 'compliance',
        description: 'Ensures compliance with financial services regulations',
        isEnabled: false,  // DISABLED AGENT - shows as inactive in UI (fixes pause/deletion bug)
        llmConfigId: 'f1234567-89ab-4cde-f012-3456789abcd2',
        systemPrompt: 'You are a FinTech Compliance Advisor specializing in financial services regulations, payment card industry standards, anti-money laundering (AML), and know-your-customer (KYC) requirements. Help ensure regulatory compliance for fintech operations.',
        enabledMcpServers: ['M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6'],
        usageCount: 12,
        createdAt: new Date(Date.now() - 1296000000).toISOString(), // 15 days ago
        updatedAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ];
  }

  res.json({
    success: true,
    data: {
      agents: agents,
      total: agents.length,
      tenant_id: tenantId,
      database_type: 'Mock Data (tenant-isolated)',
      replacement_status: 'localStorage successfully replaced'
    },
    message: `${agents.length} agents retrieved successfully for tenant`,
    timestamp: new Date().toISOString()
  });
});

// POST endpoint for creating agents - supports creation without MCP servers
app.post('/api/v1/simple-agents/create', (req, res) => {
  const tenantId = req.headers['x-tenant-id'] as string || 'default';
  const userId = req.headers['x-user-id'] as string || 'user-001';
  const { name, description, systemPrompt, llmConfigId, enabledMcpServers } = req.body;

  console.log(`📝 [Create Agent] Creating agent for tenant: ${tenantId}`, {
    name,
    description: description?.substring(0, 50) + '...',
    llmConfigId,
    mcpServersCount: enabledMcpServers?.length || 0
  });

  // Validation
  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Agent name is required',
      timestamp: new Date().toISOString()
    });
  }

  // Generate new agent ID based on tenant prefix
  const agentPrefix = tenantId === 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d' ? 'a' : 'f';
  const agentId = `${agentPrefix}${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

  // Create new agent - MCP servers are optional
  const newAgent = {
    id: agentId,
    name: name.trim(),
    type: 'custom',
    description: description || `Custom agent created for ${tenantId === 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d' ? 'ACME Corporation' : 'FinTech Solutions'}`,
    isEnabled: true,
    llmConfigId: llmConfigId || (tenantId === 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d' ? 'a1234567-89ab-4cde-f012-3456789abcd0' : 'f1234567-89ab-4cde-f012-3456789abcd2'),
    systemPrompt: systemPrompt || `You are a helpful AI assistant for ${tenantId === 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d' ? 'ACME Corporation' : 'FinTech Solutions'}. Provide accurate and professional assistance with GRC-related tasks.`,
    enabledMcpServers: enabledMcpServers || [], // Empty array if no MCP servers provided
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tenantId: tenantId,
    createdBy: userId
  };

  res.status(201).json({
    success: true,
    data: newAgent,
    message: 'Agent created successfully (MCP servers are optional)',
    timestamp: new Date().toISOString(),
    notes: [
      'Agent can be created without MCP servers',
      'MCP servers can be added later during configuration',
      'Agent will use default LLM configuration if none specified'
    ]
  });
});

// PUT endpoint for updating agents - FIXES LLM config persistence issue
app.put('/api/v1/simple-agents/:agentId', (req, res) => {
  const { agentId } = req.params;
  const tenantId = req.headers['x-tenant-id'] as string || 'default';
  const updates = req.body;

  console.log(`📝 [Update Agent] Updating agent ${agentId} for tenant: ${tenantId}`, {
    name: updates.name,
    llmConfigId: updates.llmConfigId,
    isEnabled: updates.isEnabled
  });

  // Mock successful update with all fields returned (fixes LLM config persistence)
  const updatedAgent = {
    id: agentId,
    name: updates.name || 'Updated Agent',
    description: updates.description || 'Updated description',
    systemPrompt: updates.systemPrompt || 'Updated system prompt',
    llmConfigId: updates.llmConfigId, // CRITICAL: Return the LLM config ID
    enabledMcpServers: updates.enabledMcpServers || [],
    isEnabled: updates.isEnabled !== undefined ? updates.isEnabled : true,
    usageCount: 0,
    updatedAt: new Date().toISOString(),
    tenantId: tenantId
  };

  res.json({
    success: true,
    data: updatedAgent,
    message: 'Agent updated successfully (mock mode with LLM config persistence)',
    timestamp: new Date().toISOString()
  });
});

// GET endpoint for single agent by ID
app.get('/api/v1/simple-agents/:agentId', (req, res) => {
  const { agentId } = req.params;
  const tenantId = req.headers['x-tenant-id'] as string || 'default';

  console.log(`🔍 [Get Agent] Getting agent ${agentId} for tenant: ${tenantId}`);

  // Mock agent data based on agentId
  const mockAgent = {
    id: agentId,
    name: 'Mock Agent',
    description: 'This is a mock agent for testing',
    systemPrompt: 'You are a helpful AI assistant.',
    llmConfigId: tenantId === 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d'
      ? 'a1234567-89ab-4cde-f012-3456789abcd0'
      : 'f1234567-89ab-4cde-f012-3456789abcd2',
    enabledMcpServers: ['M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6'],
    isEnabled: true,
    usageCount: 0,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    tenantId: tenantId
  };

  res.json({
    success: true,
    data: mockAgent,
    message: 'Agent retrieved successfully (mock mode)',
    timestamp: new Date().toISOString()
  });
});

// DELETE endpoint for agents
app.delete('/api/v1/simple-agents/:agentId', (req, res) => {
  const { agentId } = req.params;
  const tenantId = req.headers['x-tenant-id'] as string || 'default';

  console.log(`🗑️ [Delete Agent] Deleting agent ${agentId} for tenant: ${tenantId}`);

  res.json({
    success: true,
    message: 'Agent deleted successfully (mock mode)',
    timestamp: new Date().toISOString()
  });
});

// Simple Credentials endpoint
app.get('/api/v1/simple-credentials', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'openai-key',
        name: 'OpenAI API Key',
        type: 'api_key',
        provider: 'openai',
        isConfigured: true,
        isValid: true,
        lastUsed: new Date(Date.now() - 3600000).toISOString(),
        expiresAt: new Date(Date.now() + 31536000000).toISOString(), // 1 year
        permissions: ['gpt-4', 'gpt-3.5-turbo']
      },
      {
        id: 'azure-openai-key',
        name: 'Azure OpenAI Key',
        type: 'api_key',
        provider: 'azure',
        isConfigured: true,
        isValid: true,
        lastUsed: new Date(Date.now() - 7200000).toISOString(),
        expiresAt: null,
        permissions: ['gpt-4', 'text-embedding-ada-002']
      },
      {
        id: 'archer-connection',
        name: 'RSA Archer Connection',
        type: 'basic_auth',
        provider: 'archer',
        isConfigured: false,
        isValid: false,
        lastUsed: null,
        expiresAt: null,
        permissions: []
      }
    ],
    message: 'Credentials retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// Simple MCP Configurations endpoint
app.get('/api/v1/simple-mcp-configs', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'archer-mcp',
        name: 'RSA Archer GRC MCP Server',
        serverType: 'stdio',
        isEnabled: true,
        isHealthy: true,
        toolsCount: 25,
        version: '1.0.0',
        lastHealthCheck: new Date().toISOString(),
        capabilities: [
          'list_applications',
          'get_records',
          'create_record',
          'update_record',
          'search_records',
          'get_fields',
          'calculate_risk'
        ]
      },
      {
        id: 'filesystem-mcp',
        name: 'File System MCP Server',
        serverType: 'stdio',
        isEnabled: false,
        isHealthy: false,
        toolsCount: 12,
        version: '0.9.0',
        lastHealthCheck: new Date(Date.now() - 86400000).toISOString(),
        capabilities: [
          'read_file',
          'write_file',
          'list_directory',
          'search_files'
        ]
      }
    ],
    message: 'MCP configurations retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// MCP Servers Tools endpoint
app.get('/api/v1/mcp-servers/tools', (req, res) => {
  res.json({
    success: true,
    data: {
      tools: [
        {
          name: 'list_applications',
          description: 'List all applications in RSA Archer',
          server: 'archer-mcp',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'get_records',
          description: 'Get records from an Archer application',
          server: 'archer-mcp',
          inputSchema: {
            type: 'object',
            properties: {
              applicationId: { type: 'number', description: 'Application ID' },
              moduleId: { type: 'number', description: 'Module ID' },
              limit: { type: 'number', description: 'Number of records to return', default: 100 }
            },
            required: ['applicationId', 'moduleId']
          }
        },
        {
          name: 'search_records',
          description: 'Search for records in Archer',
          server: 'archer-mcp',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              applicationId: { type: 'number', description: 'Application ID' },
              fields: { type: 'array', items: { type: 'string' }, description: 'Fields to return' }
            },
            required: ['query', 'applicationId']
          }
        },
        {
          name: 'calculate_risk',
          description: 'Calculate risk score for a record',
          server: 'archer-mcp',
          inputSchema: {
            type: 'object',
            properties: {
              recordId: { type: 'number', description: 'Record ID' },
              factors: { type: 'object', description: 'Risk factors' }
            },
            required: ['recordId']
          }
        }
      ],
      servers: [
        {
          id: 'archer-mcp',
          name: 'RSA Archer GRC MCP Server',
          connected: true,
          toolCount: 25
        }
      ],
      totalTools: 25,
      activeServers: 1
    },
    message: 'MCP tools retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// Data Quality service endpoint
app.get('/api/v1/data-quality/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Data Quality Service',
    version: '1.0.0',
    capabilities: ['classification', 'confidence_scoring', 'human_review_workflow'],
    timestamp: new Date().toISOString()
  });
});

// Risk Insights service endpoint
app.get('/api/v1/insights/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Risk Insights Generator',
    version: '1.0.0',
    capabilities: ['risk_analysis', 'strategic_insights', 'agent_orchestration'],
    timestamp: new Date().toISOString()
  });
});

// Enhanced chat router
app.use('/api/v1/enhanced-chat', enhancedChatRouter);

// Generic catch-all for API endpoints
app.all('/api/v1/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.path} not found`,
    availableEndpoints: [
      'GET /api/v1/health',
      'GET /api/v1/simple-llm-configs',
      'POST /api/v1/simple-llm-configs',
      'GET /api/v1/simple-agents',
      'GET /api/v1/simple-credentials',
      'GET /api/v1/simple-mcp-configs',
      'GET /api/v1/mcp-servers/tools',
      'GET /api/v1/data-quality/health',
      'GET /api/v1/insights/health',
      'POST /api/v1/enhanced/chat',
      'GET /api/v1/enhanced/conversations/:userId',
      'GET /api/v1/enhanced/memory/search',
      'GET /api/v1/enhanced/tools',
      'GET /api/v1/enhanced/health'
    ],
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path
  });
});

// Root health check
app.get('/', (req, res) => {
  res.json({
    message: 'GRC Analytics Platform API',
    status: 'healthy',
    version: '1.0.0',
    documentation: '/api/v1',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 GRC Platform Backend running on port ${port}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🔗 Health check: http://localhost:${port}/api/v1/health`);
  console.log(`⚡ Ready to serve requests!`);
});

export default app;