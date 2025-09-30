/**
 * Main Event Streaming Service
 * Orchestrates real-time data streaming from all GRC platform applications
 */

import express from 'express';
import cors from 'cors';
import winston from 'winston';
import { EventProducer } from './event-producer.js';
import { CosmosChangeFeedProcessor } from './cosmos-change-feed.js';
import { GRCEvent, EventType, EventSource, EventAction, RealTimeMetrics } from './types.js';
import cron from 'node-cron';
import Redis from 'ioredis';

class EventStreamingService {
  private app: express.Application;
  private eventProducer: EventProducer;
  private changeFeedProcessor: CosmosChangeFeedProcessor;
  private redis: Redis;
  private logger: winston.Logger;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3003');
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'event-streaming.log' })
      ]
    });

    this.eventProducer = new EventProducer();
    this.changeFeedProcessor = new CosmosChangeFeedProcessor(this.eventProducer);

    this.setupExpress();
    this.setupRoutes();
    this.setupCronJobs();
  }

  /**
   * Setup Express middleware
   */
  private setupExpress(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        tenantId: req.headers['x-tenant-id']
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      const changeFeedStatus = this.changeFeedProcessor.getStatus();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        changeFeed: changeFeedStatus,
        version: '1.0.0'
      });
    });

    // Publish event endpoint
    this.app.post('/events', async (req, res) => {
      try {
        const event: Omit<GRCEvent, 'id' | 'timestamp'> = req.body;
        
        // Validate required fields
        if (!event.tenantId || !event.eventType || !event.source) {
          return res.status(400).json({
            error: 'Missing required fields: tenantId, eventType, source'
          });
        }

        const eventId = await this.eventProducer.publishEvent(event);
        
        res.json({
          success: true,
          eventId,
          message: 'Event published successfully'
        });
      } catch (error) {
        this.logger.error('Failed to publish event', { error, body: req.body });
        res.status(500).json({
          success: false,
          error: 'Failed to publish event'
        });
      }
    });

    // Bulk event publishing
    this.app.post('/events/bulk', async (req, res) => {
      try {
        const events: Array<Omit<GRCEvent, 'id' | 'timestamp'>> = req.body.events;
        
        if (!Array.isArray(events) || events.length === 0) {
          return res.status(400).json({
            error: 'Invalid events array'
          });
        }

        const results = await Promise.allSettled(
          events.map(event => this.eventProducer.publishEvent(event))
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - successful;

        res.json({
          success: failed === 0,
          published: successful,
          failed,
          total: results.length
        });
      } catch (error) {
        this.logger.error('Failed to publish bulk events', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to publish bulk events'
        });
      }
    });

    // Get real-time metrics for tenant
    this.app.get('/metrics/:tenantId', async (req, res) => {
      try {
        const { tenantId } = req.params;
        const metrics = await this.getRealTimeMetrics(tenantId);
        res.json(metrics);
      } catch (error) {
        this.logger.error('Failed to get metrics', { error, tenantId: req.params.tenantId });
        res.status(500).json({
          error: 'Failed to retrieve metrics'
        });
      }
    });

    // Get recent events for tenant
    this.app.get('/events/:tenantId', async (req, res) => {
      try {
        const { tenantId } = req.params;
        const { limit = '100', eventType, source } = req.query;
        
        const events = await this.getRecentEvents(
          tenantId, 
          parseInt(limit as string),
          eventType as EventType,
          source as EventSource
        );
        
        res.json({
          events,
          count: events.length,
          tenantId
        });
      } catch (error) {
        this.logger.error('Failed to get events', { error, tenantId: req.params.tenantId });
        res.status(500).json({
          error: 'Failed to retrieve events'
        });
      }
    });

    // Stream configuration endpoints
    this.app.get('/stream-config/:tenantId', async (req, res) => {
      try {
        const { tenantId } = req.params;
        const configKey = `tenant:${tenantId}:stream:config`;
        const config = await this.redis.get(configKey);
        
        res.json({
          tenantId,
          config: config ? JSON.parse(config) : null
        });
      } catch (error) {
        this.logger.error('Failed to get stream config', { error });
        res.status(500).json({ error: 'Failed to get stream configuration' });
      }
    });

    this.app.put('/stream-config/:tenantId', async (req, res) => {
      try {
        const { tenantId } = req.params;
        const config = req.body;
        
        const configKey = `tenant:${tenantId}:stream:config`;
        await this.redis.set(configKey, JSON.stringify({
          ...config,
          tenantId,
          lastUpdated: new Date().toISOString()
        }));
        
        res.json({
          success: true,
          message: 'Stream configuration updated'
        });
      } catch (error) {
        this.logger.error('Failed to update stream config', { error });
        res.status(500).json({ error: 'Failed to update stream configuration' });
      }
    });
  }

  /**
   * Setup scheduled tasks
   */
  private setupCronJobs(): void {
    // Generate metrics every minute
    cron.schedule('* * * * *', async () => {
      try {
        await this.generateMetrics();
      } catch (error) {
        this.logger.error('Failed to generate metrics', { error });
      }
    });

    // Cleanup old data every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.cleanupOldData();
      } catch (error) {
        this.logger.error('Failed to cleanup old data', { error });
      }
    });
  }

  /**
   * Get real-time metrics for tenant
   */
  private async getRealTimeMetrics(tenantId: string): Promise<RealTimeMetrics> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get event counts by type for today
    const eventTypeKeys = await this.redis.keys(`tenant:${tenantId}:events:*`);
    const eventCounts = await Promise.all(
      eventTypeKeys.map(async (key) => {
        const count = await this.redis.llen(key);
        const eventType = key.split(':').pop() as EventType;
        return { type: eventType, count };
      })
    );

    const totalEventsToday = eventCounts.reduce((sum, ec) => sum + ec.count, 0);
    const topEventTypes = eventCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(ec => ({
        type: ec.type,
        count: ec.count,
        percentage: totalEventsToday > 0 ? (ec.count / totalEventsToday) * 100 : 0
      }));

    // Get processing metrics
    const processingKey = `tenant:${tenantId}:processing:results`;
    const recentResults = await this.redis.lrange(processingKey, 0, 99);
    const successfulProcessing = recentResults
      .map(r => JSON.parse(r))
      .filter(r => r.success).length;

    const errorRate = recentResults.length > 0 
      ? ((recentResults.length - successfulProcessing) / recentResults.length) * 100 
      : 0;

    return {
      tenantId,
      timestamp: now,
      metrics: {
        eventsPerSecond: totalEventsToday / (24 * 60 * 60), // Rough approximation
        totalEventsToday,
        errorRate,
        averageProcessingTime: 150, // TODO: Calculate from actual processing times
        topEventTypes,
        riskTrends: {
          highRiskIncreasing: 0, // TODO: Implement risk trend analysis
          criticalIncidents: 0,
          complianceGaps: 0,
          controlFailures: 0
        }
      }
    };
  }

  /**
   * Get recent events for tenant
   */
  private async getRecentEvents(
    tenantId: string,
    limit: number = 100,
    eventType?: EventType,
    source?: EventSource
  ): Promise<GRCEvent[]> {
    let keys: string[];
    
    if (eventType) {
      keys = [`tenant:${tenantId}:events:${eventType}`];
    } else {
      keys = await this.redis.keys(`tenant:${tenantId}:events:*`);
    }

    const events: GRCEvent[] = [];
    
    for (const key of keys) {
      const eventStrings = await this.redis.lrange(key, 0, limit - 1);
      const keyEvents = eventStrings
        .map(eventStr => JSON.parse(eventStr) as GRCEvent)
        .filter(event => !source || event.source === source);
      
      events.push(...keyEvents);
    }

    // Sort by timestamp descending and limit
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Generate and store metrics
   */
  private async generateMetrics(): Promise<void> {
    // Get all tenant IDs
    const tenantKeys = await this.redis.keys('tenant:*:events:*');
    const tenantIds = new Set(
      tenantKeys.map(key => key.split(':')[1])
    );

    // Generate metrics for each tenant
    for (const tenantId of tenantIds) {
      try {
        const metrics = await this.getRealTimeMetrics(tenantId);
        const metricsKey = `tenant:${tenantId}:metrics:realtime`;
        
        await this.redis.setex(
          metricsKey, 
          3600, // 1 hour TTL
          JSON.stringify(metrics)
        );
      } catch (error) {
        this.logger.error(`Failed to generate metrics for tenant ${tenantId}`, { error });
      }
    }
  }

  /**
   * Cleanup old data
   */
  private async cleanupOldData(): Promise<void> {
    const patterns = [
      'tenant:*:events:*',
      'tenant:*:processing:results',
      'tenant:*:analytics:realtime'
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        // Trim to keep only recent data
        await this.redis.ltrim(key, 0, 9999); // Keep last 10k items
      }
    }

    this.logger.info('Completed data cleanup');
  }

  /**
   * Start the streaming service
   */
  async start(): Promise<void> {
    try {
      // Initialize components
      await this.eventProducer.initialize();
      await this.changeFeedProcessor.start();

      // Start HTTP server
      this.app.listen(this.port, () => {
        this.logger.info(`Event Streaming Service started on port ${this.port}`);
        this.logger.info('Services initialized successfully');
      });
    } catch (error) {
      this.logger.error('Failed to start Event Streaming Service', { error });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Event Streaming Service');
    
    try {
      await this.changeFeedProcessor.stop();
      await this.eventProducer.shutdown();
      await this.redis.quit();
      
      this.logger.info('Event Streaming Service shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
    }
  }
}

// Start the service
const service = new EventStreamingService();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await service.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await service.shutdown();
  process.exit(0);
});

// Start the service
service.start().catch(error => {
  console.error('Failed to start Event Streaming Service:', error);
  process.exit(1);
});