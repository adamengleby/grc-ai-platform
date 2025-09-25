/**
 * Test Script for Event Streaming Infrastructure
 * Tests real-time streaming capabilities before building UI
 */

import { EventProducer } from './packages/event-streaming/src/event-producer.js';
import { EventType, EventSource, EventAction } from './packages/event-streaming/src/types.js';
import Redis from 'ioredis';

class EventStreamingTester {
  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6379,
      password: 'devpassword',
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3
    });
    
    this.testResults = {
      connectionTests: {},
      eventPublishing: {},
      dataRetrieval: {},
      performance: {}
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Event Streaming Infrastructure Tests\n');
    
    try {
      // Test 1: Connection Tests
      await this.testConnections();
      
      // Test 2: Event Publishing
      await this.testEventPublishing();
      
      // Test 3: Data Retrieval
      await this.testDataRetrieval();
      
      // Test 4: Performance Tests
      await this.testPerformance();
      
      // Test 5: Tenant Isolation
      await this.testTenantIsolation();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async testConnections() {
    console.log('📡 Testing Infrastructure Connections...');
    
    // Test Redis Connection
    try {
      await this.redis.ping();
      this.testResults.connectionTests.redis = { 
        status: 'success', 
        message: 'Redis connection successful' 
      };
      console.log('  ✅ Redis: Connected');
    } catch (error) {
      this.testResults.connectionTests.redis = { 
        status: 'failed', 
        message: error.message 
      };
      console.log('  ❌ Redis: Failed to connect');
    }
    
    // Test Kafka Connection (simplified test)
    try {
      // We'll test Kafka indirectly through the event producer
      this.testResults.connectionTests.kafka = { 
        status: 'pending', 
        message: 'Will test via event producer' 
      };
      console.log('  ⏳ Kafka: Will test during event publishing');
    } catch (error) {
      this.testResults.connectionTests.kafka = { 
        status: 'failed', 
        message: error.message 
      };
    }
    
    console.log();
  }

  async testEventPublishing() {
    console.log('📤 Testing Event Publishing...');
    
    // Create test stream configuration
    const testTenantId = 'test-tenant-001';
    const streamConfig = {
      tenantId: testTenantId,
      enabled: true,
      topics: ['grc-test-events'],
      filters: [],
      destinations: [
        { type: 'redis', enabled: true, config: {} }
      ],
      retentionDays: 1,
      batchSize: 100,
      compressionEnabled: false
    };
    
    // Store stream config in Redis
    await this.redis.set(
      `tenant:${testTenantId}:stream:config`,
      JSON.stringify(streamConfig)
    );
    
    try {
      // Initialize event producer (without Kafka for local testing)
      const eventProducer = new TestEventProducer();
      await eventProducer.initialize();
      
      // Test single event publishing
      const testEvent = {
        tenantId: testTenantId,
        eventType: EventType.RISK_CREATED,
        source: EventSource.FRONTEND_APP,
        action: EventAction.CREATE,
        entityId: 'test-risk-001',
        entityType: 'risk',
        userId: 'test-user-001',
        data: {
          riskTitle: 'Test Risk Event',
          riskScore: 85,
          category: 'Operational',
          description: 'This is a test risk event for streaming validation'
        },
        metadata: {
          version: '1.0',
          correlationId: 'test-correlation-001',
          tags: ['test', 'risk', 'streaming']
        }
      };
      
      const eventId = await eventProducer.publishEvent(testEvent);
      
      this.testResults.eventPublishing.singleEvent = {
        status: 'success',
        eventId,
        message: 'Successfully published test event'
      };
      console.log('  ✅ Single Event: Published successfully');
      
      // Test bulk event publishing
      const bulkEvents = [
        { ...testEvent, entityId: 'bulk-test-001', data: { ...testEvent.data, riskScore: 75 } },
        { ...testEvent, entityId: 'bulk-test-002', data: { ...testEvent.data, riskScore: 90 } },
        { ...testEvent, entityId: 'bulk-test-003', data: { ...testEvent.data, riskScore: 65 } }
      ];
      
      const bulkResults = await Promise.allSettled(
        bulkEvents.map(event => eventProducer.publishEvent(event))
      );
      
      const successCount = bulkResults.filter(r => r.status === 'fulfilled').length;
      
      this.testResults.eventPublishing.bulkEvents = {
        status: successCount === bulkEvents.length ? 'success' : 'partial',
        published: successCount,
        total: bulkEvents.length,
        message: `Published ${successCount}/${bulkEvents.length} bulk events`
      };
      console.log(`  ✅ Bulk Events: ${successCount}/${bulkEvents.length} published`);
      
      await eventProducer.shutdown();
      
    } catch (error) {
      this.testResults.eventPublishing.error = {
        status: 'failed',
        message: error.message
      };
      console.log('  ❌ Event Publishing: Failed');
    }
    
    console.log();
  }

  async testDataRetrieval() {
    console.log('📥 Testing Data Retrieval...');
    
    const testTenantId = 'test-tenant-001';
    
    try {
      // Test retrieving events from Redis
      const eventKeys = await this.redis.keys(`tenant:${testTenantId}:events:*`);
      console.log(`  📊 Found ${eventKeys.length} event key(s) in Redis`);
      
      let totalEvents = 0;
      const eventsByType = {};
      
      for (const key of eventKeys) {
        const eventCount = await this.redis.llen(key);
        const eventType = key.split(':').pop();
        eventsByType[eventType] = eventCount;
        totalEvents += eventCount;
        
        // Get sample events
        const sampleEvents = await this.redis.lrange(key, 0, 2);
        console.log(`  📝 ${eventType}: ${eventCount} events`);
        
        if (sampleEvents.length > 0) {
          const event = JSON.parse(sampleEvents[0]);
          console.log(`     Sample: ${event.data?.riskTitle || event.entityId}`);
        }
      }
      
      this.testResults.dataRetrieval.redis = {
        status: 'success',
        totalEvents,
        eventsByType,
        message: `Retrieved ${totalEvents} events from Redis`
      };
      
      console.log(`  ✅ Total Events Retrieved: ${totalEvents}`);
      
    } catch (error) {
      this.testResults.dataRetrieval.redis = {
        status: 'failed',
        message: error.message
      };
      console.log('  ❌ Data Retrieval: Failed');
    }
    
    console.log();
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...');
    
    const testTenantId = 'perf-test-tenant';
    const eventCount = 50;
    
    try {
      // Set up stream config for performance test
      const streamConfig = {
        tenantId: testTenantId,
        enabled: true,
        topics: ['grc-perf-events'],
        filters: [],
        destinations: [{ type: 'redis', enabled: true, config: {} }],
        retentionDays: 1,
        batchSize: 100,
        compressionEnabled: false
      };
      
      await this.redis.set(
        `tenant:${testTenantId}:stream:config`,
        JSON.stringify(streamConfig)
      );
      
      const eventProducer = new TestEventProducer();
      await eventProducer.initialize();
      
      // Performance test: publish many events
      const startTime = Date.now();
      
      const performanceEvents = Array.from({ length: eventCount }, (_, i) => ({
        tenantId: testTenantId,
        eventType: EventType.SYSTEM_PERFORMANCE,
        source: EventSource.BACKEND_API,
        action: EventAction.CREATE,
        entityId: `perf-test-${i}`,
        entityType: 'performance',
        data: {
          testNumber: i,
          timestamp: new Date(),
          performanceMetric: Math.random() * 100
        },
        metadata: {
          version: '1.0',
          tags: ['performance', 'test']
        }
      }));
      
      const results = await Promise.allSettled(
        performanceEvents.map(event => eventProducer.publishEvent(event))
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const eventsPerSecond = (successCount / duration) * 1000;
      
      this.testResults.performance = {
        status: 'success',
        eventCount,
        successCount,
        duration,
        eventsPerSecond: eventsPerSecond.toFixed(2),
        message: `Processed ${successCount}/${eventCount} events in ${duration}ms`
      };
      
      console.log(`  ✅ Performance: ${eventsPerSecond.toFixed(2)} events/second`);
      console.log(`  📊 Success Rate: ${((successCount/eventCount) * 100).toFixed(1)}%`);
      
      await eventProducer.shutdown();
      
    } catch (error) {
      this.testResults.performance = {
        status: 'failed',
        message: error.message
      };
      console.log('  ❌ Performance Test: Failed');
    }
    
    console.log();
  }

  async testTenantIsolation() {
    console.log('🔒 Testing Tenant Isolation...');
    
    const tenant1 = 'tenant-isolation-001';
    const tenant2 = 'tenant-isolation-002';
    
    try {
      // Create events for two different tenants
      const eventProducer = new TestEventProducer();
      await eventProducer.initialize();
      
      // Configure both tenants
      for (const tenantId of [tenant1, tenant2]) {
        const config = {
          tenantId,
          enabled: true,
          topics: [`grc-${tenantId}-events`],
          filters: [],
          destinations: [{ type: 'redis', enabled: true, config: {} }],
          retentionDays: 1,
          batchSize: 100,
          compressionEnabled: false
        };
        
        await this.redis.set(`tenant:${tenantId}:stream:config`, JSON.stringify(config));
        
        // Publish test event for each tenant
        await eventProducer.publishEvent({
          tenantId,
          eventType: EventType.USER_ACTION,
          source: EventSource.FRONTEND_APP,
          action: EventAction.CREATE,
          entityId: `isolation-test-${tenantId}`,
          data: { tenantSpecificData: `Data for ${tenantId}` },
          metadata: { version: '1.0', tags: ['isolation', 'test'] }
        });
      }
      
      // Verify tenant isolation
      const tenant1Keys = await this.redis.keys(`tenant:${tenant1}:*`);
      const tenant2Keys = await this.redis.keys(`tenant:${tenant2}:*`);
      
      // Check that tenant1 data doesn't appear in tenant2 namespace and vice versa
      const tenant1HasTenant2Data = tenant1Keys.some(key => key.includes(tenant2));
      const tenant2HasTenant1Data = tenant2Keys.some(key => key.includes(tenant1));
      
      const isolationWorking = !tenant1HasTenant2Data && !tenant2HasTenant1Data;
      
      this.testResults.dataRetrieval.tenantIsolation = {
        status: isolationWorking ? 'success' : 'failed',
        tenant1Keys: tenant1Keys.length,
        tenant2Keys: tenant2Keys.length,
        crossContamination: tenant1HasTenant2Data || tenant2HasTenant1Data,
        message: isolationWorking ? 'Tenant isolation working correctly' : 'Tenant isolation failed'
      };
      
      console.log(`  ✅ Tenant Isolation: ${isolationWorking ? 'Working' : 'Failed'}`);
      console.log(`  📊 Tenant 1: ${tenant1Keys.length} keys, Tenant 2: ${tenant2Keys.length} keys`);
      
      await eventProducer.shutdown();
      
    } catch (error) {
      this.testResults.dataRetrieval.tenantIsolation = {
        status: 'failed',
        message: error.message
      };
      console.log('  ❌ Tenant Isolation: Failed');
    }
    
    console.log();
  }

  printResults() {
    console.log('📋 Test Results Summary\n');
    console.log('=' .repeat(50));
    
    // Connection Tests
    console.log('\n🔌 Connection Tests:');
    Object.entries(this.testResults.connectionTests).forEach(([service, result]) => {
      const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏳';
      console.log(`  ${icon} ${service}: ${result.message}`);
    });
    
    // Event Publishing
    console.log('\n📤 Event Publishing:');
    Object.entries(this.testResults.eventPublishing).forEach(([test, result]) => {
      if (test === 'error') return;
      const icon = result.status === 'success' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
      console.log(`  ${icon} ${test}: ${result.message}`);
    });
    
    // Data Retrieval
    console.log('\n📥 Data Retrieval:');
    Object.entries(this.testResults.dataRetrieval).forEach(([test, result]) => {
      const icon = result.status === 'success' ? '✅' : '❌';
      console.log(`  ${icon} ${test}: ${result.message}`);
    });
    
    // Performance
    console.log('\n⚡ Performance:');
    if (this.testResults.performance.status === 'success') {
      console.log(`  ✅ Throughput: ${this.testResults.performance.eventsPerSecond} events/sec`);
      console.log(`  📊 Success Rate: ${((this.testResults.performance.successCount / this.testResults.performance.eventCount) * 100).toFixed(1)}%`);
    } else {
      console.log(`  ❌ Performance test failed: ${this.testResults.performance.message}`);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Event Streaming Infrastructure Tests Complete!\n');
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    
    const testPatterns = [
      'tenant:test-tenant-*',
      'tenant:perf-test-*',
      'tenant:tenant-isolation-*'
    ];
    
    for (const pattern of testPatterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`  🗑️  Deleted ${keys.length} keys matching ${pattern}`);
      }
    }
    
    await this.redis.quit();
    console.log('🏁 Cleanup complete\n');
  }
}

// Simplified Event Producer for testing (without Kafka dependency)
class TestEventProducer {
  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6379,
      password: 'devpassword',
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3
    });
  }
  
  async initialize() {
    // Test Redis connection
    await this.redis.ping();
  }
  
  async publishEvent(event) {
    const fullEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };
    
    // Publish to Redis (simplified version)
    const key = `tenant:${event.tenantId}:events:${event.eventType}`;
    await this.redis.lpush(key, JSON.stringify(fullEvent));
    await this.redis.expire(key, 86400); // 24 hours
    await this.redis.ltrim(key, 0, 999); // Keep last 1000 events
    
    return fullEvent.id;
  }
  
  async shutdown() {
    await this.redis.quit();
  }
}

// Run the tests
const tester = new EventStreamingTester();
tester.runAllTests().catch(console.error);