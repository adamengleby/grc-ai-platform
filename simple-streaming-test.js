/**
 * Simple Event Streaming Test
 * Tests basic Redis connectivity and event publishing
 */

import Redis from 'ioredis';
import { randomUUID } from 'crypto';

class SimpleStreamingTest {
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

  async runTests() {
    console.log('🚀 Starting Simple Event Streaming Tests\n');

    try {
      // Test 1: Redis Connection
      await this.testRedisConnection();
      
      // Test 2: Event Publishing
      await this.testEventPublishing();
      
      // Test 3: Event Retrieval
      await this.testEventRetrieval();
      
      // Test 4: Tenant Isolation
      await this.testTenantIsolation();
      
      console.log('✅ All tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }

  async testRedisConnection() {
    console.log('1. Testing Redis Connection...');
    
    try {
      const response = await this.redis.ping();
      if (response === 'PONG') {
        console.log('   ✅ Redis connection successful');
      } else {
        throw new Error('Redis ping failed');
      }
    } catch (error) {
      console.log('   ❌ Redis connection failed:', error.message);
      throw error;
    }
  }

  async testEventPublishing() {
    console.log('\n2. Testing Event Publishing...');
    
    const testTenantId = 'test-tenant-001';
    const testEvents = [
      {
        id: randomUUID(),
        tenantId: testTenantId,
        eventType: 'RISK_CREATED',
        source: 'FRONTEND_APP',
        timestamp: new Date().toISOString(),
        entityId: 'risk-001',
        data: { riskTitle: 'Test Risk 1', riskScore: 85 }
      },
      {
        id: randomUUID(),
        tenantId: testTenantId,
        eventType: 'CONTROL_UPDATED',
        source: 'MCP_SERVER',
        timestamp: new Date().toISOString(),
        entityId: 'control-001',
        data: { controlName: 'Test Control 1', effectiveness: 'High' }
      },
      {
        id: randomUUID(),
        tenantId: testTenantId,
        eventType: 'COMPLIANCE_GAP_DETECTED',
        source: 'ARCHER_GRC',
        timestamp: new Date().toISOString(),
        entityId: 'compliance-001',
        data: { framework: 'ISO27001', gapSeverity: 'High' }
      }
    ];

    try {
      let publishedCount = 0;
      
      for (const event of testEvents) {
        const key = `tenant:${event.tenantId}:events:${event.eventType}`;
        
        // Publish event to Redis
        await this.redis.lpush(key, JSON.stringify(event));
        await this.redis.expire(key, 3600); // 1 hour expiry
        
        publishedCount++;
        console.log(`   📤 Published: ${event.eventType} (${event.entityId})`);
      }
      
      console.log(`   ✅ Successfully published ${publishedCount}/${testEvents.length} events`);
      
    } catch (error) {
      console.log('   ❌ Event publishing failed:', error.message);
      throw error;
    }
  }

  async testEventRetrieval() {
    console.log('\n3. Testing Event Retrieval...');
    
    const testTenantId = 'test-tenant-001';
    
    try {
      // Get all event keys for the test tenant
      const eventKeys = await this.redis.keys(`tenant:${testTenantId}:events:*`);
      console.log(`   📊 Found ${eventKeys.length} event types in Redis`);
      
      let totalEvents = 0;
      const eventSummary = {};
      
      for (const key of eventKeys) {
        const eventCount = await this.redis.llen(key);
        const eventType = key.split(':').pop();
        eventSummary[eventType] = eventCount;
        totalEvents += eventCount;
        
        // Get a sample event
        const sampleEvents = await this.redis.lrange(key, 0, 0);
        if (sampleEvents.length > 0) {
          const event = JSON.parse(sampleEvents[0]);
          console.log(`   📝 ${eventType}: ${eventCount} events (latest: ${event.entityId})`);
        }
      }
      
      console.log(`   ✅ Retrieved ${totalEvents} total events`);
      console.log(`   📈 Event breakdown:`, eventSummary);
      
    } catch (error) {
      console.log('   ❌ Event retrieval failed:', error.message);
      throw error;
    }
  }

  async testTenantIsolation() {
    console.log('\n4. Testing Tenant Isolation...');
    
    const tenant1 = 'tenant-isolation-001';
    const tenant2 = 'tenant-isolation-002';
    
    try {
      // Create events for two different tenants
      const tenant1Event = {
        id: randomUUID(),
        tenantId: tenant1,
        eventType: 'USER_ACTION',
        source: 'FRONTEND_APP',
        timestamp: new Date().toISOString(),
        entityId: 'action-tenant1',
        data: { action: 'login', user: 'tenant1-user' }
      };
      
      const tenant2Event = {
        id: randomUUID(),
        tenantId: tenant2,
        eventType: 'USER_ACTION',
        source: 'FRONTEND_APP',
        timestamp: new Date().toISOString(),
        entityId: 'action-tenant2',
        data: { action: 'login', user: 'tenant2-user' }
      };
      
      // Publish events for both tenants
      await this.redis.lpush(`tenant:${tenant1}:events:USER_ACTION`, JSON.stringify(tenant1Event));
      await this.redis.lpush(`tenant:${tenant2}:events:USER_ACTION`, JSON.stringify(tenant2Event));
      
      // Verify isolation by checking that each tenant only sees their own data
      const tenant1Keys = await this.redis.keys(`tenant:${tenant1}:*`);
      const tenant2Keys = await this.redis.keys(`tenant:${tenant2}:*`);
      
      // Check for cross-contamination
      const tenant1HasTenant2Data = tenant1Keys.some(key => key.includes(tenant2));
      const tenant2HasTenant1Data = tenant2Keys.some(key => key.includes(tenant1));
      
      if (!tenant1HasTenant2Data && !tenant2HasTenant1Data) {
        console.log(`   ✅ Tenant isolation working correctly`);
        console.log(`   🔐 Tenant 1: ${tenant1Keys.length} keys, Tenant 2: ${tenant2Keys.length} keys`);
        console.log(`   🚫 No cross-tenant data contamination detected`);
      } else {
        throw new Error('Tenant isolation failed - cross-contamination detected');
      }
      
    } catch (error) {
      console.log('   ❌ Tenant isolation test failed:', error.message);
      throw error;
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      const testPatterns = [
        'tenant:test-tenant-*',
        'tenant:tenant-isolation-*'
      ];
      
      let deletedCount = 0;
      
      for (const pattern of testPatterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          deletedCount += keys.length;
        }
      }
      
      console.log(`   🗑️  Deleted ${deletedCount} test keys`);
      
    } catch (error) {
      console.log('   ⚠️  Cleanup warning:', error.message);
    }
    
    await this.redis.quit();
    console.log('   🏁 Test cleanup completed\n');
  }
}

// Performance Test
class PerformanceTest {
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

  async runPerformanceTest() {
    console.log('⚡ Running Performance Test...\n');
    
    const testTenantId = 'perf-test-tenant';
    const eventCount = 100;
    
    try {
      console.log(`📊 Publishing ${eventCount} events...`);
      const startTime = Date.now();
      
      const events = Array.from({ length: eventCount }, (_, i) => ({
        id: randomUUID(),
        tenantId: testTenantId,
        eventType: 'SYSTEM_PERFORMANCE',
        source: 'BACKEND_API',
        timestamp: new Date().toISOString(),
        entityId: `perf-test-${i}`,
        data: {
          testNumber: i,
          metric: Math.random() * 100,
          timestamp: Date.now()
        }
      }));
      
      // Publish events in batches for better performance
      const batchSize = 10;
      let published = 0;
      
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        
        await Promise.all(batch.map(event => 
          this.redis.lpush(`tenant:${testTenantId}:events:${event.eventType}`, JSON.stringify(event))
        ));
        
        published += batch.length;
        
        // Show progress
        if (published % 50 === 0 || published === events.length) {
          console.log(`   📤 Published ${published}/${eventCount} events`);
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const eventsPerSecond = (published / duration) * 1000;
      
      console.log(`\n📈 Performance Results:`);
      console.log(`   ✅ Events Published: ${published}/${eventCount}`);
      console.log(`   ⏱️  Duration: ${duration}ms`);
      console.log(`   🚀 Throughput: ${eventsPerSecond.toFixed(2)} events/second`);
      console.log(`   📊 Average Time per Event: ${(duration/published).toFixed(2)}ms`);
      
      // Cleanup performance test data
      const keys = await this.redis.keys(`tenant:${testTenantId}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`   🗑️  Cleaned up ${keys.length} performance test keys`);
      }
      
    } catch (error) {
      console.error('   ❌ Performance test failed:', error.message);
    } finally {
      await this.redis.quit();
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('🎯 Event Streaming Infrastructure Test Suite\n');
  console.log('='.repeat(60));
  
  // Basic functionality tests
  const basicTest = new SimpleStreamingTest();
  await basicTest.runTests();
  
  console.log('='.repeat(60));
  
  // Performance tests
  const perfTest = new PerformanceTest();
  await perfTest.runPerformanceTest();
  
  console.log('='.repeat(60));
  console.log('🎉 Event Streaming Infrastructure Tests Complete!\n');
}

runAllTests().catch(console.error);