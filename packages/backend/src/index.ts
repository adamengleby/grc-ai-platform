import express, { RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { Server } from 'socket.io';
import { createServer } from 'http';

import { config, validateConfig } from '@/config';
import { apiRouter } from '@/routes';
import { authenticateToken, enforceTenantIsolation } from '@/middleware/auth';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { mcpClient } from '@/services/mcpClient';

/**
 * GRC Analytics Platform Backend API Server
 * Production-ready Express.js server with WebSocket support
 */
class AnalyticsServer {
  private app: express.Application;
  private server: any;
  private io: Server;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.cors.allowedOrigins,
        credentials: config.cors.credentials,
      },
    });

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeWebSocket();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: config.cors.allowedOrigins,
      credentials: config.cors.credentials,
    }));

    // Compression middleware
    this.app.use(compression() as unknown as RequestHandler);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    if (config.server.nodeEnv !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Request timeout
    this.app.use((req, res, next) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            error: 'Request timeout',
            timestamp: new Date(),
          });
        }
      }, 30000);

      // Clear timeout when response is finished
      res.on('finish', () => clearTimeout(timeout));
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date(),
        version: '1.0.0',
        service: 'GRC Analytics Platform Backend',
      });
    });

    // Simple MCP tools endpoint for frontend compatibility (HTTP mode)
    this.app.get('/tools', async (req, res) => {
      try {
        const tools = await mcpClient.getMCPTools();
        res.json({
          tools,
          server: 'GRC Analytics MCP Server (HTTP)',
          version: '2.0.0',
          capabilities: ['tools'],
          connected: mcpClient.connected,
          mode: 'http'
        });
      } catch (error) {
        res.status(500).json({ error: 'MCP server not available' });
      }
    });


    // API routes with authentication
    this.app.use(
      `/api/${config.server.apiVersion}`,
      authenticateToken,
      enforceTenantIsolation,
      apiRouter
    );
  }

  private initializeWebSocket(): void {
    // WebSocket authentication middleware
    this.io.use((socket, next) => {
      // TODO: Implement WebSocket authentication
      // For now, accept all connections in development
      if (config.development.useMockData) {
        socket.data.user = {
          id: 'mock-user-123',
          tenantId: 'acme-corp',
          roles: ['TenantOwner', 'AgentUser'],
        };
      }
      next();
    });

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Join tenant-specific room for isolation
      const tenantId = socket.data.user?.tenantId;
      if (tenantId) {
        // Avoid double-prefixing if tenantId already starts with "tenant-"
        const roomName = tenantId.startsWith('tenant-') ? tenantId : `tenant-${tenantId}`;
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined tenant room: ${roomName}`);
      }

      // Handle client subscription to real-time updates
      socket.on('subscribe_metrics', () => {
        console.log('Client subscribed to metrics updates');
        // TODO: Start sending real-time metrics updates
      });

      socket.on('subscribe_events', () => {
        console.log('Client subscribed to event stream');
        // TODO: Start sending real-time event updates
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    // Start real-time data broadcasting (mock implementation)
    if (config.development.useMockData) {
      this.startMockDataBroadcast();
    }
  }

  private startMockDataBroadcast(): void {
    // Send mock real-time updates every 5 seconds
    setInterval(() => {
      const mockMetricsUpdate = {
        type: 'metrics_update',
        tenantId: 'acme-corp',
        data: {
          eventsPerSecond: Math.random() * 50 + 10,
          errorRate: Math.random() * 5,
          timestamp: new Date(),
        },
      };

      // Broadcast to tenant room
      this.io.to('tenant-acme-corp').emit('metrics_update', mockMetricsUpdate);
    }, 5000);

    // Send mock event stream updates
    setInterval(() => {
      const mockEvent = {
        type: 'event_stream',
        tenantId: 'acme-corp',
        data: {
          id: `event-${Date.now()}`,
          eventType: 'RISK_ASSESSMENT',
          description: `Real-time event at ${new Date().toISOString()}`,
          severity: 'info',
          timestamp: new Date(),
        },
      };

      this.io.to('tenant-acme-corp').emit('event_stream', mockEvent);
    }, 10000);
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use('*', notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);

    // Graceful shutdown handling
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  private gracefulShutdown(): void {
    console.log('Received shutdown signal, closing server gracefully...');
    
    this.server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }

  public getApp(): express.Application {
    return this.app;
  }

  public start(): void {
    try {
      // Validate configuration
      validateConfig();

      // Start HTTP server
      this.server.listen(config.server.port, config.server.host, () => {
        console.log(`
🚀 GRC Analytics Platform Backend Server Started

Environment: ${config.server.nodeEnv}
HTTP Server: http://${config.server.host}:${config.server.port}
WebSocket Server: ws://${config.server.host}:${config.server.port}
API Version: ${config.server.apiVersion}
Mock Data: ${config.development.useMockData ? 'Enabled' : 'Disabled'}
CORS Origins: ${config.cors.allowedOrigins.join(', ')}

API Endpoints:
- Health: GET /health
- Analytics API: /api/${config.server.apiVersion}/analytics/*

Ready to serve analytics data! 📊
        `);
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Create server instance
const server = new AnalyticsServer();

// Export app for Azure Functions and other uses
export const app = server.getApp();
export { server };

// Start the server only if this file is run directly (not imported)
if (require.main === module) {
  server.start();
}