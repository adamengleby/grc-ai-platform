// Global test setup for GRC AI Platform
// This file is executed before all tests run

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.TEST_MODE = 'true';
process.env.TENANT_ID = 'test-tenant-001';
process.env.ENABLE_AUDIT_LOGS = 'false';
process.env.ENABLE_MOCK_SERVICES = 'true';

// Mock Azure services for testing
jest.mock('@azure/cosmos', () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      container: jest.fn().mockReturnValue({
        items: {
          query: jest.fn().mockReturnValue({
            fetchAll: jest.fn().mockResolvedValue({ resources: [] })
          }),
          create: jest.fn().mockResolvedValue({ resource: {} }),
          upsert: jest.fn().mockResolvedValue({ resource: {} })
        },
        item: jest.fn().mockReturnValue({
          read: jest.fn().mockResolvedValue({ resource: {} }),
          replace: jest.fn().mockResolvedValue({ resource: {} }),
          delete: jest.fn().mockResolvedValue({ resource: {} })
        })
      })
    })
  }))
}));

jest.mock('@azure/keyvault-secrets', () => ({
  SecretClient: jest.fn().mockImplementation(() => ({
    getSecret: jest.fn().mockResolvedValue({ value: 'mock-secret-value' }),
    setSecret: jest.fn().mockResolvedValue({ name: 'mock-secret' }),
    deleteSecret: jest.fn().mockResolvedValue({ name: 'mock-secret' })
  }))
}));

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({ token: 'mock-token' })
  })),
  ManagedIdentityCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({ token: 'mock-token' })
  }))
}));

// Mock Redis for testing
jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    flushdb: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    off: jest.fn()
  })
}));

// Mock Winston logger for testing
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock Application Insights
jest.mock('applicationinsights', () => ({
  setup: jest.fn().mockReturnThis(),
  start: jest.fn(),
  defaultClient: {
    trackEvent: jest.fn(),
    trackTrace: jest.fn(),
    trackException: jest.fn(),
    trackMetric: jest.fn(),
    flush: jest.fn()
  },
  TelemetryClient: jest.fn().mockImplementation(() => ({
    trackEvent: jest.fn(),
    trackTrace: jest.fn(),
    trackException: jest.fn(),
    trackMetric: jest.fn(),
    flush: jest.fn()
  }))
}));

// Global test utilities
global.createMockTenant = () => ({
  id: 'test-tenant-001',
  name: 'Test Tenant',
  tier: 'standard',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isActive: true,
  config: {
    maxAgents: 10,
    allowedMcpServers: ['archer-grc', 'compliance-tools']
  }
});

global.createMockUser = () => ({
  id: 'test-user-001',
  tenantId: 'test-tenant-001',
  email: 'test@example.com',
  roles: ['user'],
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  isActive: true
});

global.createMockAgent = () => ({
  id: 'test-agent-001',
  tenantId: 'test-tenant-001',
  name: 'Test Agent',
  description: 'Test AI agent for GRC tasks',
  status: 'active',
  config: {
    llmProvider: 'azure-openai',
    model: 'gpt-4',
    maxTokens: 4000,
    temperature: 0.7
  },
  tools: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

global.createMockMcpServer = () => ({
  id: 'test-mcp-server-001',
  name: 'Test MCP Server',
  description: 'Test MCP server for unit testing',
  url: 'https://test-mcp-server.com',
  version: '1.0.0',
  status: 'active',
  capabilities: ['read', 'write'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// Mock crypto functions for testing
global.mockEncrypt = (data) => `encrypted:${Buffer.from(data).toString('base64')}`;
global.mockDecrypt = (encryptedData) => {
  if (encryptedData.startsWith('encrypted:')) {
    return Buffer.from(encryptedData.replace('encrypted:', ''), 'base64').toString();
  }
  return encryptedData;
};

// Security test utilities
global.createMockSecurityContext = () => ({
  tenantId: 'test-tenant-001',
  userId: 'test-user-001',
  roles: ['user'],
  permissions: ['read:agents', 'write:agents'],
  sessionId: 'test-session-001',
  ip: '127.0.0.1',
  userAgent: 'test-agent/1.0'
});

global.createMockAuditEvent = () => ({
  id: 'test-audit-001',
  tenantId: 'test-tenant-001',
  userId: 'test-user-001',
  action: 'agent.create',
  resource: 'agent:test-agent-001',
  timestamp: new Date().toISOString(),
  result: 'success',
  metadata: {
    ip: '127.0.0.1',
    userAgent: 'test-agent/1.0'
  }
});

// Multi-tenant test utilities
global.withTenantContext = (tenantId, fn) => {
  const originalTenantId = process.env.TENANT_ID;
  process.env.TENANT_ID = tenantId;
  try {
    return fn();
  } finally {
    process.env.TENANT_ID = originalTenantId;
  }
};

global.withSecurityContext = (context, fn) => {
  const originalContext = global.__SECURITY_CONTEXT__;
  global.__SECURITY_CONTEXT__ = context;
  try {
    return fn();
  } finally {
    global.__SECURITY_CONTEXT__ = originalContext;
  }
};

// Performance testing utilities
global.measurePerformance = async (fn, name = 'operation') => {
  const start = process.hrtime.bigint();
  try {
    const result = await fn();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;
    console.log(`${name} took ${durationMs.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;
    console.log(`${name} failed after ${durationMs.toFixed(2)}ms`);
    throw error;
  }
};

// Cleanup utilities
global.cleanupTest = async () => {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Clear test data
  delete global.__SECURITY_CONTEXT__;
  
  // Reset environment variables
  process.env.TENANT_ID = 'test-tenant-001';
  process.env.LOG_LEVEL = 'error';
};

// Setup global error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Configure test timeouts
jest.setTimeout(30000);

// Setup and teardown for each test
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset test environment
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
});

afterEach(async () => {
  // Cleanup after each test
  await global.cleanupTest();
});

// Global setup for all tests
beforeAll(() => {
  console.log('🧪 Starting GRC AI Platform test suite...');
});

afterAll(() => {
  console.log('✅ GRC AI Platform test suite completed');
});