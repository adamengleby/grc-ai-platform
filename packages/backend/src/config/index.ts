import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    apiVersion: process.env.API_VERSION || 'v1',
  },

  // CORS Configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  },

  // Database Configuration
  database: {
    cosmos: {
      endpoint: process.env.COSMOS_ENDPOINT || '',
      key: process.env.COSMOS_KEY || '',
      databaseId: process.env.COSMOS_DATABASE_ID || 'grc-analytics',
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || '',
    },
  },

  // Azure Configuration
  azure: {
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    tenantId: process.env.AZURE_TENANT_ID || '',
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Rate Limiting
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // WebSocket Configuration
  websocket: {
    port: parseInt(process.env.WS_PORT || '3002', 10),
  },

  // GRC Data Sources
  grcSources: {
    archer: {
      baseUrl: process.env.ARCHER_BASE_URL || '',
      apiKey: process.env.ARCHER_API_KEY || '',
    },
  },

  // Development Configuration
  development: {
    useMockData: process.env.USE_MOCK_DATA === 'true',
    useMockAuth: process.env.USE_MOCK_AUTH === 'true',
    mockLatencyMs: parseInt(process.env.MOCK_LATENCY_MS || '500', 10),
  },
};

export const isDevelopment = config.server.nodeEnv === 'development';
export const isProduction = config.server.nodeEnv === 'production';
export const isTest = config.server.nodeEnv === 'test';

// Validate required environment variables in production
export const validateConfig = (): void => {
  const requiredVars = [];

  if (isProduction) {
    requiredVars.push(
      'COSMOS_ENDPOINT',
      'COSMOS_KEY',
      'JWT_SECRET',
      'AZURE_CLIENT_ID',
      'AZURE_CLIENT_SECRET',
      'AZURE_TENANT_ID'
    );
  }

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
};

export default config;