/**
 * Event Producer - Captures and streams events from all GRC applications
 */

import { Kafka, Producer, KafkaMessage } from 'kafkajs';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import winston from 'winston';
import { 
  GRCEvent, 
  EventType, 
  EventSource, 
  EventAction, 
  StreamConfig,
  StreamProcessingResult 
} from './types.js';

export class EventProducer {
  private kafka: Kafka;
  private producer: Producer;
  private redis: Redis;
  private logger: winston.Logger;
  private streamConfigs: Map<string, StreamConfig> = new Map();

  constructor() {
    this.kafka = new Kafka({
      clientId: 'grc-event-producer',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'events.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.producer.connect();
      await this.loadStreamConfigurations();
      this.logger.info('Event Producer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Event Producer', { error });
      throw error;
    }
  }

  /**
   * Publish a GRC event to the streaming pipeline
   */
  async publishEvent(event: Omit<GRCEvent, 'id' | 'timestamp'>): Promise<string> {
    const fullEvent: GRCEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date()
    };

    const streamConfig = this.streamConfigs.get(event.tenantId);
    if (!streamConfig || !streamConfig.enabled) {
      this.logger.warn(`Streaming disabled for tenant ${event.tenantId}`);
      return fullEvent.id;
    }

    if (!this.shouldProcessEvent(fullEvent, streamConfig)) {
      this.logger.debug(`Event filtered out`, { eventId: fullEvent.id, eventType: fullEvent.eventType });
      return fullEvent.id;
    }

    try {
      const results = await Promise.allSettled([
        this.publishToKafka(fullEvent),
        this.publishToRedis(fullEvent),
        this.publishToAnalytics(fullEvent)
      ]);

      const processingResult: StreamProcessingResult = {
        eventId: fullEvent.id,
        tenantId: fullEvent.tenantId,
        processingTime: new Date(),
        success: results.every(r => r.status === 'fulfilled'),
        destinations: this.buildDestinationResults(results),
        transformations: [],
        enrichments: {}
      };

      // Store processing results for monitoring
      await this.storeProcessingResult(processingResult);

      this.logger.info('Event published successfully', { 
        eventId: fullEvent.id, 
        tenantId: fullEvent.tenantId,
        eventType: fullEvent.eventType 
      });

      return fullEvent.id;
    } catch (error) {
      this.logger.error('Failed to publish event', { 
        error, 
        eventId: fullEvent.id,
        eventType: fullEvent.eventType 
      });
      throw error;
    }
  }

  /**
   * Publish event to Kafka for stream processing
   */
  private async publishToKafka(event: GRCEvent): Promise<void> {
    const topic = this.getKafkaTopic(event);
    const message: KafkaMessage = {
      key: event.entityId || event.tenantId,
      value: JSON.stringify(event),
      timestamp: event.timestamp.getTime().toString(),
      headers: {
        eventType: event.eventType,
        source: event.source,
        tenantId: event.tenantId
      }
    };

    await this.producer.send({
      topic,
      messages: [message]
    });
  }

  /**
   * Publish event to Redis for real-time access
   */
  private async publishToRedis(event: GRCEvent): Promise<void> {
    const key = `tenant:${event.tenantId}:events:${event.eventType}`;
    const eventData = {
      ...event,
      timestamp: event.timestamp.toISOString()
    };

    // Store latest events for real-time access
    await Promise.all([
      this.redis.lpush(key, JSON.stringify(eventData)),
      this.redis.expire(key, 86400), // 24 hours
      this.redis.ltrim(key, 0, 999), // Keep last 1000 events
      this.redis.publish(`events:${event.tenantId}`, JSON.stringify(eventData))
    ]);
  }

  /**
   * Publish to analytics pipeline for immediate processing
   */
  private async publishToAnalytics(event: GRCEvent): Promise<void> {
    // Real-time analytics processing
    if (this.isAnalyticsEvent(event)) {
      const analyticsKey = `tenant:${event.tenantId}:analytics:realtime`;
      await this.redis.zadd(
        analyticsKey,
        event.timestamp.getTime(),
        JSON.stringify(event)
      );
      
      // Trigger real-time processing
      await this.redis.publish(`analytics:${event.tenantId}`, event.id);
    }
  }

  /**
   * Load streaming configurations for all tenants
   */
  private async loadStreamConfigurations(): Promise<void> {
    try {
      const configKeys = await this.redis.keys('tenant:*:stream:config');
      
      for (const key of configKeys) {
        const configJson = await this.redis.get(key);
        if (configJson) {
          const config: StreamConfig = JSON.parse(configJson);
          this.streamConfigs.set(config.tenantId, config);
        }
      }

      this.logger.info(`Loaded ${this.streamConfigs.size} stream configurations`);
    } catch (error) {
      this.logger.error('Failed to load stream configurations', { error });
    }
  }

  /**
   * Check if event should be processed based on filters
   */
  private shouldProcessEvent(event: GRCEvent, config: StreamConfig): boolean {
    if (config.filters.length === 0) return true;

    return config.filters.some(filter => {
      const typeMatch = filter.eventTypes.length === 0 || 
                       filter.eventTypes.includes(event.eventType);
      const sourceMatch = filter.sources.length === 0 || 
                         filter.sources.includes(event.source);
      
      // Additional condition matching can be added here
      return typeMatch && sourceMatch;
    });
  }

  /**
   * Get appropriate Kafka topic for event
   */
  private getKafkaTopic(event: GRCEvent): string {
    const baseTopics = {
      [EventSource.ARCHER_GRC]: 'grc-archer-events',
      [EventSource.MCP_SERVER]: 'grc-mcp-events',
      [EventSource.FRONTEND_APP]: 'grc-frontend-events',
      [EventSource.BACKEND_API]: 'grc-backend-events',
      [EventSource.SCHEDULER]: 'grc-scheduler-events',
      [EventSource.ANALYTICS_ENGINE]: 'grc-analytics-events',
      [EventSource.COMPLIANCE_SCANNER]: 'grc-compliance-events'
    };

    return baseTopics[event.source] || 'grc-general-events';
  }

  /**
   * Check if event requires analytics processing
   */
  private isAnalyticsEvent(event: GRCEvent): boolean {
    const analyticsEventTypes = [
      EventType.RISK_CREATED,
      EventType.RISK_UPDATED,
      EventType.RISK_STATUS_CHANGED,
      EventType.CONTROL_FAILED,
      EventType.INCIDENT_CREATED,
      EventType.COMPLIANCE_GAP_DETECTED,
      EventType.POLICY_VIOLATION,
      EventType.DATA_ANOMALY
    ];

    return analyticsEventTypes.includes(event.eventType);
  }

  /**
   * Build results from Promise.allSettled results
   */
  private buildDestinationResults(results: PromiseSettledResult<void>[]): StreamProcessingResult['destinations'] {
    return [
      {
        type: 'kafka',
        success: results[0].status === 'fulfilled',
        error: results[0].status === 'rejected' ? results[0].reason?.message : undefined,
        latency: 0 // TODO: Add timing
      },
      {
        type: 'redis',
        success: results[1].status === 'fulfilled',
        error: results[1].status === 'rejected' ? results[1].reason?.message : undefined,
        latency: 0
      },
      {
        type: 'analytics',
        success: results[2].status === 'fulfilled',
        error: results[2].status === 'rejected' ? results[2].reason?.message : undefined,
        latency: 0
      }
    ];
  }

  /**
   * Store processing results for monitoring
   */
  private async storeProcessingResult(result: StreamProcessingResult): Promise<void> {
    const key = `tenant:${result.tenantId}:processing:results`;
    await this.redis.lpush(key, JSON.stringify(result));
    await this.redis.expire(key, 604800); // 7 days
    await this.redis.ltrim(key, 0, 9999); // Keep last 10k results
  }

  /**
   * Cleanup and close connections
   */
  async shutdown(): Promise<void> {
    try {
      await this.producer.disconnect();
      await this.redis.quit();
      this.logger.info('Event Producer shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
    }
  }
}