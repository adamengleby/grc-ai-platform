/**
 * Cosmos DB Change Feed Integration
 * Captures all data changes from Cosmos DB and streams them to event pipeline
 */

import { CosmosClient, ChangeFeedIterator, ChangeFeedResponse } from '@azure/cosmos';
import { EventProducer } from './event-producer.js';
import { GRCEvent, EventType, EventSource, EventAction } from './types.js';
import winston from 'winston';

export class CosmosChangeFeedProcessor {
  private cosmosClient: CosmosClient;
  private eventProducer: EventProducer;
  private logger: winston.Logger;
  private isRunning: boolean = false;
  private processors: Map<string, ChangeFeedIterator<any>> = new Map();

  constructor(eventProducer: EventProducer) {
    this.cosmosClient = new CosmosClient({
      endpoint: process.env.COSMOS_DB_ENDPOINT!,
      key: process.env.COSMOS_DB_KEY!
    });

    this.eventProducer = eventProducer;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'cosmos-changefeed.log' })
      ]
    });
  }

  /**
   * Start processing change feeds for all containers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Change feed processor already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting Cosmos DB change feed processing');

    try {
      // Define containers to monitor
      const containersToMonitor = [
        { database: 'grc-platform', container: 'tenants' },
        { database: 'grc-platform', container: 'agents' },
        { database: 'grc-platform', container: 'connections' },
        { database: 'grc-platform', container: 'mcp-servers' },
        { database: 'grc-platform', container: 'user-sessions' },
        { database: 'grc-platform', container: 'audit-logs' },
        // Add more containers as needed
      ];

      // Start change feed processors for each container
      for (const containerInfo of containersToMonitor) {
        await this.startChangeFeedForContainer(
          containerInfo.database, 
          containerInfo.container
        );
      }

      this.logger.info(`Started change feed processors for ${containersToMonitor.length} containers`);
    } catch (error) {
      this.logger.error('Failed to start change feed processing', { error });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Start change feed processor for specific container
   */
  private async startChangeFeedForContainer(
    databaseId: string, 
    containerId: string
  ): Promise<void> {
    try {
      const database = this.cosmosClient.database(databaseId);
      const container = database.container(containerId);

      const changeFeedIterator = container.items.changeFeed({
        startFromBeginning: false, // Start from now
        maxItemCount: 100
      });

      this.processors.set(`${databaseId}:${containerId}`, changeFeedIterator);

      // Process changes continuously
      this.processChangeFeed(changeFeedIterator, databaseId, containerId);

      this.logger.info(`Change feed processor started for ${databaseId}:${containerId}`);
    } catch (error) {
      this.logger.error(`Failed to start change feed for ${databaseId}:${containerId}`, { error });
      throw error;
    }
  }

  /**
   * Process changes from change feed
   */
  private async processChangeFeed(
    iterator: ChangeFeedIterator<any>,
    databaseId: string,
    containerId: string
  ): Promise<void> {
    while (this.isRunning) {
      try {
        const response: ChangeFeedResponse<any> = await iterator.readNext();
        
        if (response.result && response.result.length > 0) {
          for (const item of response.result) {
            await this.processChangedItem(item, databaseId, containerId);
          }
        }

        // Wait before next poll
        await this.sleep(1000);
      } catch (error) {
        this.logger.error(`Error processing change feed for ${databaseId}:${containerId}`, { error });
        
        // Exponential backoff on error
        await this.sleep(5000);
      }
    }
  }

  /**
   * Process individual changed item
   */
  private async processChangedItem(
    item: any, 
    databaseId: string, 
    containerId: string
  ): Promise<void> {
    try {
      const event = this.mapCosmosItemToEvent(item, databaseId, containerId);
      if (event) {
        await this.eventProducer.publishEvent(event);
        
        this.logger.debug('Processed change feed item', {
          tenantId: event.tenantId,
          eventType: event.eventType,
          entityId: event.entityId
        });
      }
    } catch (error) {
      this.logger.error('Failed to process changed item', { 
        error, 
        itemId: item.id,
        container: containerId 
      });
    }
  }

  /**
   * Map Cosmos DB item to GRC event
   */
  private mapCosmosItemToEvent(
    item: any, 
    databaseId: string, 
    containerId: string
  ): Omit<GRCEvent, 'id' | 'timestamp'> | null {
    // Extract common fields
    const tenantId = item.tenantId || item.partitionKey || 'unknown';
    const entityId = item.id;
    const userId = item.lastModifiedBy || item.createdBy;

    // Determine event type based on container and item properties
    const eventType = this.determineEventType(item, containerId);
    if (!eventType) {
      return null; // Skip items that don't map to events
    }

    // Determine action (simplified - in practice you'd track this more precisely)
    const action = this.determineAction(item);

    return {
      tenantId,
      eventType,
      source: EventSource.BACKEND_API, // Since changes come from Cosmos DB
      userId,
      entityId,
      entityType: containerId,
      action,
      data: {
        document: item,
        container: containerId,
        database: databaseId,
        changeType: 'document_changed', // Cosmos doesn't distinguish create/update in change feed
        _ts: item._ts, // Cosmos timestamp
        _etag: item._etag // Cosmos etag for conflict resolution
      },
      metadata: {
        version: '1.0',
        correlationId: item.correlationId,
        tags: [`source:cosmos`, `container:${containerId}`, `database:${databaseId}`]
      }
    };
  }

  /**
   * Determine event type based on container and item content
   */
  private determineEventType(item: any, containerId: string): EventType | null {
    const containerEventMapping: Record<string, EventType> = {
      'tenants': EventType.USER_PERMISSION_CHANGED,
      'agents': EventType.SYSTEM_PERFORMANCE, // Agent config changes
      'connections': EventType.SYSTEM_PERFORMANCE, // Connection changes
      'mcp-servers': EventType.SYSTEM_PERFORMANCE, // MCP server changes
      'user-sessions': EventType.USER_LOGIN,
      'audit-logs': EventType.USER_ACTION,
    };

    // Try container-based mapping first
    let eventType = containerEventMapping[containerId];
    
    if (!eventType) {
      // Try content-based mapping
      if (item.riskLevel !== undefined) {
        eventType = EventType.RISK_UPDATED;
      } else if (item.complianceStatus !== undefined) {
        eventType = EventType.COMPLIANCE_STATUS_CHANGED;
      } else if (item.controlStatus !== undefined) {
        eventType = EventType.CONTROL_UPDATED;
      } else if (item.incidentSeverity !== undefined) {
        eventType = EventType.INCIDENT_CREATED;
      }
    }

    return eventType || null;
  }

  /**
   * Determine action based on item properties
   */
  private determineAction(item: any): EventAction {
    // Cosmos change feed doesn't distinguish between create/update
    // You could track this by maintaining state or using TTL
    if (item._ts && (Date.now() - item._ts * 1000) < 5000) {
      return EventAction.CREATE; // Assume create if very recent
    }
    return EventAction.UPDATE;
  }

  /**
   * Stop processing change feeds
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping Cosmos DB change feed processing');
    this.isRunning = false;

    // Close all change feed iterators
    for (const [key, iterator] of this.processors) {
      try {
        // Note: CosmosDB change feed iterators don't have explicit close method
        // They will be garbage collected when not in use
        this.logger.info(`Stopped change feed processor for ${key}`);
      } catch (error) {
        this.logger.error(`Error stopping change feed processor for ${key}`, { error });
      }
    }

    this.processors.clear();
    this.logger.info('Cosmos DB change feed processing stopped');
  }

  /**
   * Get processing status
   */
  getStatus(): { isRunning: boolean; processorCount: number; processors: string[] } {
    return {
      isRunning: this.isRunning,
      processorCount: this.processors.size,
      processors: Array.from(this.processors.keys())
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}