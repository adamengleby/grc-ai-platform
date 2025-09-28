import { Router } from 'express';
import analyticsRouter from './analytics';
import { credentialsRouter } from './credentials';
import mcpRouter from './mcp';
import mcpToolAccessRouter from './mcpToolAccess';
import privacyRouter from './privacy';
// Import refactored routes (without "simple" naming)
import agentsRouter from './agents';
import credentialsRouterClean from './credentials-clean';
import llmConfigsRouter from './llm-configs';
import mcpConfigsRouter from './mcp-configs';
import tenantSecretsRouter from './tenantSecrets';

/**
 * Refactored API Routes - Clean naming without "simple" prefix
 * Provides comprehensive CRUD operations for all entities
 */
export const apiRouter = Router();

// Core health check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    service: 'GRC Analytics Platform API (Refactored)',
    environment: process.env.NODE_ENV || 'development',
    features: {
      'clean-naming': true,
      'comprehensive-crud': true,
      'entity-relationships': true,
      'proper-validation': true,
      'tenant-isolation': true
    }
  });
});

// Mount main entity routes (clean naming)
apiRouter.use('/agents', agentsRouter);
apiRouter.use('/llm-configs', llmConfigsRouter);
apiRouter.use('/mcp-configs', mcpConfigsRouter);
apiRouter.use('/credentials', credentialsRouterClean);

// Mount existing analytics and other routes
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/mcp', mcpRouter);
apiRouter.use('/mcp-tool-access', mcpToolAccessRouter);
apiRouter.use('/privacy', privacyRouter);
apiRouter.use('/tenant-secrets', tenantSecretsRouter);

// Backward compatibility - redirect old "simple-" routes to new clean routes
apiRouter.use('/simple-agents', (req, res) => {
  const newPath = req.originalUrl.replace('/simple-agents', '/agents');
  res.redirect(301, newPath);
});

apiRouter.use('/simple-llm-configs', (req, res) => {
  const newPath = req.originalUrl.replace('/simple-llm-configs', '/llm-configs');
  res.redirect(301, newPath);
});

apiRouter.use('/simple-mcp-configs', (req, res) => {
  const newPath = req.originalUrl.replace('/simple-mcp-configs', '/mcp-configs');
  res.redirect(301, newPath);
});

apiRouter.use('/simple-credentials', (req, res) => {
  const newPath = req.originalUrl.replace('/simple-credentials', '/credentials');
  res.redirect(301, newPath);
});

// Legacy MCP endpoint for backward compatibility
apiRouter.post('/mcp', async (req, res) => {
  try {
    console.log('[Legacy MCP] Request received:', req.body);

    // Proxy to SSE server for MCP JSON-RPC requests
    const response = await fetch('http://localhost:3006/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });

    const result = await response.json();

    // Check if client supports SSE upgrade
    const acceptsSSE = req.headers.accept?.includes('text/event-stream');

    if (acceptsSSE && (result as any).supportsStreaming) {
      // Upgrade to SSE for streaming responses
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial response as SSE
      res.write(`data: ${JSON.stringify(result)}\n\n`);

      // Keep connection open for streaming updates
      const streamId = setTimeout(() => {
        res.end();
      }, 30000); // 30 second timeout

      req.on('close', () => {
        clearTimeout(streamId);
      });
    } else {
      // Standard HTTP response
      res.json(result);
    }

  } catch (error: any) {
    console.error('[Legacy MCP] Error:', error);
    res.status(500).json({
      error: 'MCP request failed',
      details: error.message
    });
  }
});

export default apiRouter;