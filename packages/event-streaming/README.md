# Event Streaming Service

## Overview

The Event Streaming Service provides real-time data streaming capabilities for the GRC AI Platform. It captures all data changes across the platform and streams them to various destinations for analytics, compliance monitoring, and predictive analysis.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Data Sources  │───▶│  Event Producer  │───▶│   Destinations  │
│                 │    │                  │    │                 │
│ • Cosmos DB     │    │ • Validation     │    │ • Kafka Topics  │
│ • Frontend App  │    │ • Enrichment     │    │ • Redis Streams │
│ • MCP Servers   │    │ • Filtering      │    │ • Analytics DB  │
│ • Backend API   │    │ • Routing        │    │ • Vector Search │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Components

### 1. Event Producer (`event-producer.ts`)
- **Purpose**: Central event publishing and routing engine
- **Features**:
  - Multi-destination publishing (Kafka, Redis, Analytics)
  - Tenant-aware filtering and routing
  - Event validation and enrichment
  - Performance monitoring and metrics
  - Configurable retry policies

### 2. Cosmos Change Feed Processor (`cosmos-change-feed.ts`)
- **Purpose**: Captures all data changes from Cosmos DB
- **Features**:
  - Real-time change detection
  - Multi-container monitoring
  - Event mapping and transformation
  - Automatic recovery and retry logic

### 3. Event Streaming Service (`index.ts`)
- **Purpose**: Main orchestration service with REST API
- **Features**:
  - HTTP API for event publishing
  - Real-time metrics and monitoring
  - Stream configuration management
  - Health checks and status reporting

## Event Types

The service processes various GRC-specific events:

### Risk Events
- `RISK_CREATED` - New risk identified
- `RISK_UPDATED` - Risk details modified
- `RISK_STATUS_CHANGED` - Risk status transition
- `RISK_DELETED` - Risk removed

### Control Events
- `CONTROL_CREATED` - New control established
- `CONTROL_UPDATED` - Control modified
- `CONTROL_TESTED` - Control testing completed
- `CONTROL_FAILED` - Control failure detected

### Assessment Events
- `ASSESSMENT_STARTED` - Assessment initiated
- `ASSESSMENT_COMPLETED` - Assessment finished
- `ASSESSMENT_OVERDUE` - Assessment past due

### Compliance Events
- `COMPLIANCE_GAP_DETECTED` - Compliance issue found
- `COMPLIANCE_STATUS_CHANGED` - Compliance status updated
- `POLICY_VIOLATION` - Policy breach detected

### System Events
- `SYSTEM_ERROR` - System errors and failures
- `SYSTEM_PERFORMANCE` - Performance metrics
- `DATA_ANOMALY` - Unusual data patterns

## API Endpoints

### Health Check
```http
GET /health
```

### Publish Single Event
```http
POST /events
Content-Type: application/json

{
  "tenantId": "tenant-123",
  "eventType": "RISK_CREATED",
  "source": "FRONTEND_APP",
  "action": "CREATE",
  "entityId": "risk-456",
  "entityType": "risk",
  "data": { ... },
  "metadata": { ... }
}
```

### Publish Bulk Events
```http
POST /events/bulk
Content-Type: application/json

{
  "events": [ ... ]
}
```

### Get Real-time Metrics
```http
GET /metrics/:tenantId
```

### Get Recent Events
```http
GET /events/:tenantId?limit=100&eventType=RISK_CREATED&source=MCP_SERVER
```

### Stream Configuration
```http
GET /stream-config/:tenantId
PUT /stream-config/:tenantId
```

## Configuration

### Environment Variables

```bash
# Service Configuration
PORT=3003
LOG_LEVEL=info

# Cosmos DB
COSMOS_DB_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
COSMOS_DB_KEY=your-cosmos-key

# Kafka
KAFKA_BROKER=kafka:9093

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=devpassword
```

### Stream Configuration (Per Tenant)

```json
{
  "tenantId": "tenant-123",
  "enabled": true,
  "topics": [
    "grc-archer-events",
    "grc-mcp-events",
    "grc-analytics-events"
  ],
  "filters": [
    {
      "eventTypes": ["RISK_CREATED", "RISK_UPDATED"],
      "sources": ["ARCHER_GRC", "MCP_SERVER"],
      "conditions": {}
    }
  ],
  "destinations": [
    {
      "type": "kafka",
      "enabled": true,
      "config": {}
    }
  ],
  "retentionDays": 30,
  "batchSize": 100,
  "compressionEnabled": true
}
```

## Data Flow

1. **Source Applications** generate events through:
   - Direct API calls to `/events`
   - Automatic Cosmos DB change detection
   - MCP server integrations
   - Frontend user actions

2. **Event Producer** processes events:
   - Validates event structure
   - Applies tenant filters
   - Enriches with metadata
   - Routes to destinations

3. **Destinations** receive events:
   - **Kafka**: Stream processing and analytics
   - **Redis**: Real-time access and caching
   - **Analytics DB**: Historical analysis
   - **Vector Search**: Semantic search capabilities

## Monitoring & Metrics

### Real-time Metrics
- Events per second per tenant
- Processing latency and throughput
- Error rates and retry counts
- Top event types and sources

### Performance Monitoring
- Kafka producer lag
- Redis memory usage
- Cosmos DB RU consumption
- Stream processing delays

### Alerting
- High error rates (>5%)
- Processing delays (>30s)
- Memory pressure (>80%)
- Failed destinations

## Development

### Local Development
```bash
# Start dependencies
docker-compose up -d kafka redis cosmos-db-emulator

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Testing
```bash
# Run unit tests
npm test

# Test event publishing
curl -X POST http://localhost:3003/events \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-tenant",
    "eventType": "RISK_CREATED",
    "source": "FRONTEND_APP",
    "action": "CREATE",
    "data": {"test": true}
  }'
```

## Production Deployment

### Scaling Considerations
- **Kafka Partitioning**: Events partitioned by tenant for parallel processing
- **Redis Clustering**: High availability for real-time access
- **Container Scaling**: Horizontal scaling based on event volume
- **Database Optimization**: Proper indexing for time-series queries

### Security
- **Tenant Isolation**: All data partitioned by tenant ID
- **Authentication**: Service-to-service authentication required
- **Encryption**: All events encrypted in transit and at rest
- **Audit Logging**: Complete audit trail for compliance

## Integration Examples

### Frontend Integration
```typescript
// Publish user action event
await fetch('/api/event-streaming/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: currentTenant.id,
    eventType: 'USER_ACTION',
    source: 'FRONTEND_APP',
    action: 'UPDATE',
    entityId: riskId,
    entityType: 'risk',
    data: { action: 'risk_updated', changes: diff }
  })
});
```

### MCP Server Integration
```typescript
// Publish Archer data change
await eventProducer.publishEvent({
  tenantId: 'tenant-123',
  eventType: 'RISK_UPDATED',
  source: 'ARCHER_GRC',
  action: 'UPDATE',
  entityId: archerRecord.id,
  data: { 
    archerData: archerRecord,
    changeType: 'risk_score_updated'
  }
});
```

This event streaming service provides the foundation for:
- **Real-time Analytics**: Immediate insights into GRC data changes
- **Predictive Modeling**: Data pipeline for ML/AI analysis
- **Compliance Monitoring**: Continuous compliance status tracking
- **Audit Trails**: Complete history of all platform activities
- **Performance Monitoring**: System health and usage metrics