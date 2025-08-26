import { Router } from 'express';
import analyticsRouter from './analytics';
import { credentialsRouter } from './credentials';
import mcpRouter from './mcp';
import connectionTestRouter from './connectionTest';

/**
 * Main API Routes
 * Combines all route modules
 */
export const apiRouter = Router();

// Mount analytics routes
apiRouter.use('/analytics', analyticsRouter);

// Mount credentials routes
apiRouter.use('/credentials', credentialsRouter);

// Mount MCP routes
apiRouter.use('/mcp', mcpRouter);

// Mount connection test routes
apiRouter.use('/connections', connectionTestRouter);

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