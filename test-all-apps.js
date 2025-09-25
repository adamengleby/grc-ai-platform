#!/usr/bin/env node

/**
 * Test script to verify record counts for all Archer applications
 */

const baseURL = 'http://localhost:3005';
const headers = { 'Authorization': 'Bearer mock-token' };

async function testEndpoint(endpoint, name) {
  try {
    console.log(`\n🔍 Testing ${name}...`);
    const response = await fetch(`${baseURL}${endpoint}`, { headers });
    
    if (!response.ok) {
      console.error(`❌ ${name} failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ ${name} error:`, error.message);
    return null;
  }
}

async function clearAllCache() {
  console.log('🧹 Clearing all analytics cache...');
  try {
    const response = await fetch(`${baseURL}/api/v1/analytics/cache?tenantId=acme-corp`, {
      method: 'DELETE',
      headers
    });
    const result = await response.json();
    console.log('✅ Cache cleared:', result.data?.message);
  } catch (error) {
    console.error('❌ Failed to clear cache:', error.message);
  }
}

async function testAllApplications() {
  console.log('🚀 COMPREHENSIVE APPLICATION RECORD COUNT TEST');
  console.log('='.repeat(60));
  
  // Clear cache first for fresh data
  await clearAllCache();
  
  // Wait for server to process
  console.log('⏳ Waiting 3 seconds for fresh data...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test core analytics endpoints
  const tests = [
    { endpoint: '/api/v1/analytics/metrics', name: 'Real-Time Metrics' },
    { endpoint: '/api/v1/analytics/risk', name: 'Risk Analytics' },
    { endpoint: '/api/v1/analytics/controls', name: 'Control Analytics' },
    { endpoint: '/api/v1/analytics/compliance', name: 'Compliance Analytics' }
  ];

  const results = {};

  for (const test of tests) {
    const result = await testEndpoint(test.endpoint, test.name);
    results[test.name] = result;
    
    if (result?.success && result.data) {
      console.log(`✅ ${test.name} successful`);
      
      // Extract key metrics
      if (test.name === 'Real-Time Metrics') {
        const metrics = result.data.metrics;
        console.log(`   📊 Events Today: ${metrics.totalEventsToday}`);
        console.log(`   📈 Top Event Types:`);
        metrics.topEventTypes?.forEach(event => {
          console.log(`      - ${event.type}: ${event.count} records`);
        });
      }
      
      if (test.name === 'Risk Analytics') {
        console.log(`   🎯 Total Risks: ${result.data.totalRisks}`);
        console.log(`   📊 High Risks: ${result.data.highRisks}`);
        console.log(`   ⚠️  Critical Risks: ${result.data.criticalRisks}`);
      }
      
      if (test.name === 'Control Analytics') {
        console.log(`   🛡️  Total Controls: ${result.data.totalControls}`);
        console.log(`   ✅ Effective Controls: ${result.data.effectiveControls}`);
        console.log(`   ❌ Failed Controls: ${result.data.failedControls}`);
        console.log(`   📈 Control Effectiveness: ${result.data.controlEffectiveness}%`);
      }
      
      if (test.name === 'Compliance Analytics') {
        console.log(`   📋 Total Assessments: ${result.data.totalAssessments}`);
        console.log(`   ✅ Compliant: ${result.data.compliant}`);
        console.log(`   ⚠️  Non-Compliant: ${result.data.nonCompliant}`);
        console.log(`   📊 Compliance Rate: ${result.data.complianceRate}%`);
      }
    } else {
      console.log(`❌ ${test.name} failed or returned no data`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY OF RECORD COUNTS');
  console.log('='.repeat(60));

  const riskData = results['Risk Analytics'];
  const controlData = results['Control Analytics'];
  const complianceData = results['Compliance Analytics'];
  const metricsData = results['Real-Time Metrics'];

  console.log(`🎯 Risk Register Records: ${riskData?.data?.totalRisks || 0}`);
  console.log(`🛡️  Controls Records: ${controlData?.data?.totalControls || 0}`);
  console.log(`📋 Compliance Assessment Records: ${complianceData?.data?.totalAssessments || 0}`);
  
  if (metricsData?.data?.metrics?.topEventTypes) {
    console.log(`\n📈 Event Type Breakdown:`);
    metricsData.data.metrics.topEventTypes.forEach(event => {
      console.log(`   ${event.type}: ${event.count}`);
    });
  }

  // Determine if live data is working
  const hasLiveData = 
    (riskData?.data?.totalRisks > 0) ||
    (controlData?.data?.totalControls > 0) ||
    (complianceData?.data?.totalAssessments > 0);

  console.log('\n' + '='.repeat(60));
  if (hasLiveData) {
    console.log('✅ LIVE DATA IS WORKING! Records found in Archer applications.');
  } else {
    console.log('❌ NO LIVE DATA DETECTED. All record counts are zero.');
    console.log('   This indicates authentication or data retrieval issues.');
    console.log('   Recommendation: Implement debug interface for investigation.');
  }
  console.log('='.repeat(60));
}

// Run the test
testAllApplications().catch(console.error);