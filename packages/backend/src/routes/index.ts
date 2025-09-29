import { Router } from 'express';
import analyticsRouter from './analytics';
// import authRouter from './auth'; // Temporarily disabled
import { credentialsRouter } from './credentials';
import mcpRouter from './mcp';
import mcpToolAccessRouter from './mcpToolAccess';
// import connectionTestRouter from './connectionTest'; // Temporarily disabled
import privacyRouter from './privacy';
import simpleAgentsRouter from './simpleAgents';
import simpleCredentialsRouter from './simpleCredentials';
import simpleLLMConfigsRouter from './simpleLLMConfigs';
import simpleMCPConfigsRouter from './simpleMCPConfigs';
// Temporarily disabled due to winston Console error
// import tenantManagementRouter from './tenantManagement';
// import samlAuthRouter from './samlAuth';
// Re-enabled with mock Azure Key Vault for local development
import tenantSecretsRouter from './tenantSecrets';

/**
 * Main API Routes
 * Combines all route modules
 */
export const apiRouter = Router();

// Mount analytics routes
apiRouter.use('/analytics', analyticsRouter);

// Mount auth routes
// apiRouter.use('/auth', authRouter); // Temporarily disabled

// Mount credentials routes
apiRouter.use('/credentials', credentialsRouter);

// Mount MCP routes
apiRouter.use('/mcp', mcpRouter);

// Mount MCP Tool Access Control routes
apiRouter.use('/mcp-tool-access', mcpToolAccessRouter);

// Mount Streamable HTTP MCP endpoint (MCP standard)
apiRouter.post('/mcp', async (req, res) => {
  try {
    console.log('[Streamable HTTP] MCP request received:', req.body);
    
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
    console.error('[Streamable HTTP] Error:', error);
    res.status(500).json({
      error: 'MCP request failed',
      details: error.message
    });
  }
});

// Mount connection test routes
// apiRouter.use('/connections', connectionTestRouter); // Temporarily disabled

// Mount privacy routes - CRITICAL for LLM data protection
apiRouter.use('/privacy', privacyRouter);

// Mount simple API routes (LocalStorage replacement)
apiRouter.use('/simple-agents', simpleAgentsRouter);
apiRouter.use('/simple-credentials', simpleCredentialsRouter);
apiRouter.use('/simple-llm-configs', simpleLLMConfigsRouter);
apiRouter.use('/simple-mcp-configs', simpleMCPConfigsRouter);

// Temporarily disabled routes due to dependency issues
// Mount tenant management routes
// apiRouter.use('/tenant-management', tenantManagementRouter);

// Mount SAML authentication routes  
// apiRouter.use('/auth/saml', samlAuthRouter);

// Mount tenant secrets routes
apiRouter.use('/tenant-secrets', tenantSecretsRouter);

// Health check for the entire API
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    version: '1.0.0',
    service: 'GRC Analytics Platform Backend',
  });
});

export default apiRouter;