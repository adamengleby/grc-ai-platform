/**
 * GRC Platform Backend - Refactored Clean Architecture
 * Uses proper route separation and removes "Simple" naming convention
 */

import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes';

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: [
    'https://grc-ai-platform-prod.azurestaticapps.net',
    'https://grc-frontend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io',
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

// Mount API routes (this includes all /agents, /llm-configs, /mcp-configs, etc.)
app.use('/api/v1', apiRouter);

// Root health check
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'GRC Analytics Platform Backend (Refactored)',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    architecture: 'Clean route-based structure',
    features: {
      'clean-endpoints': true,
      'no-simple-naming': true,
      'proper-route-separation': true,
      'comprehensive-crud': true,
      'entity-relationships': true
    }
  });
});

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /api/v1/health',
      'GET /api/v1/agents',
      'POST /api/v1/agents',
      'PUT /api/v1/agents/:id',
      'DELETE /api/v1/agents/:id',
      'GET /api/v1/llm-configs',
      'POST /api/v1/llm-configs',
      'PUT /api/v1/llm-configs/:id',
      'DELETE /api/v1/llm-configs/:id',
      'GET /api/v1/mcp-configs',
      'POST /api/v1/mcp-configs',
      'PUT /api/v1/mcp-configs/:id',
      'DELETE /api/v1/mcp-configs/:id',
      'GET /api/v1/credentials',
      'POST /api/v1/credentials',
      'PUT /api/v1/credentials/:id',
      'DELETE /api/v1/credentials/:id'
    ],
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

// Start server
if (require.main === module) {
  app.listen(port, () => {
    console.log('🚀 GRC Platform Backend (Refactored) running on port', port);
    console.log('📍 Environment:', process.env.NODE_ENV || 'development');
    console.log('🔗 Health check: http://localhost:' + port + '/api/v1/health');
    console.log('✨ Features: Clean routes, no "simple" naming, proper CRUD');
    console.log('⚡ Ready to serve requests!');
  });
}

export { app };