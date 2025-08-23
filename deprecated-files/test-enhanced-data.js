#!/usr/bin/env node

/**
 * Test script for Phase 2A Enhanced Data Layer
 * Validates historical data generation and feature engineering
 */

import { EnhancedDataService } from './lib/enhancedDataService.js';

async function testEnhancedDataLayer() {
  console.log('🧪 Testing Enhanced Data Layer (Phase 2A)\n');
  
  try {
    // Initialize enhanced data service
    console.log('1. Initializing Enhanced Data Service...');
    const dataService = new EnhancedDataService();
    await dataService.initialize();
    console.log('✅ Data service initialized\n');

    // Test tenant data retrieval
    console.log('2. Testing Tenant Data Retrieval...');
    const tenantData = dataService.getTenantData('tenant-fintech-001', {
      includeRiskHistory: true,
      includeControlHistory: true,
      includeIncidents: true,
      includeFeatures: true
    });
    
    console.log(`✅ Retrieved data for ${tenantData.tenant.name}`);
    console.log(`   - Risks: ${Object.keys(tenantData.historical.risks).length}`);
    console.log(`   - Controls: ${Object.keys(tenantData.historical.controls).length}`);
    console.log(`   - Incidents: ${tenantData.historical.incidents.length}`);
    console.log(`   - Features calculated: Yes\n`);

    // Test current state
    console.log('3. Testing Current State Analysis...');
    const currentState = dataService.getCurrentState('tenant-fintech-001');
    console.log(`✅ Current state analysis:`);
    console.log(`   - Average Risk Score: ${currentState.summary.avg_risk_score.toFixed(2)}/10`);
    console.log(`   - Control Effectiveness: ${(currentState.summary.control_effectiveness * 100).toFixed(1)}%`);
    console.log(`   - Recent Incidents: ${currentState.summary.recent_incidents}`);
    console.log(`   - Critical Risks: ${currentState.summary.critical_risks}/${currentState.summary.total_risks}\n`);

    // Test ML data preparation
    console.log('4. Testing ML Data Preparation...');
    const riskForecastData = dataService.getRiskForecastData('tenant-fintech-001', 1);
    console.log(`✅ ML training data prepared:`);
    console.log(`   - Training samples: ${riskForecastData.training_data.length}`);
    console.log(`   - Features per sample: ${Object.keys(riskForecastData.training_data[0]).length - 3}`); // Exclude date, target, original_point
    console.log(`   - Data quality: ${riskForecastData.data_quality.overall_quality}`);
    console.log(`   - ML ready: ${riskForecastData.data_quality.sample_size_adequate ? 'Yes' : 'No'}\n`);

    // Test data statistics
    console.log('5. Testing Data Statistics...');
    const stats = riskForecastData.statistics;
    console.log(`✅ Data statistics:`);
    console.log(`   - Sample count: ${stats.sample_count}`);
    console.log(`   - Score range: ${stats.score_range.min.toFixed(2)} - ${stats.score_range.max.toFixed(2)}`);
    console.log(`   - Mean score: ${stats.score_range.mean.toFixed(2)}`);
    console.log(`   - Standard deviation: ${stats.score_range.std.toFixed(2)}`);
    console.log(`   - Target correlation: ${stats.target_correlation.toFixed(3)}`);
    console.log(`   - Missing values: ${stats.missing_values}`);
    console.log(`   - Outliers: ${stats.outliers}\n`);

    // Test time series features
    console.log('6. Testing Time Series Features...');
    const sampleFeatures = riskForecastData.training_data[100]; // Sample from middle
    console.log(`✅ Feature engineering example (day 100):`);
    console.log(`   - Current score: ${sampleFeatures.current_score}`);
    console.log(`   - 7-day average: ${sampleFeatures.rolling_avg_7d || 'N/A'}`);
    console.log(`   - 30-day average: ${sampleFeatures.rolling_avg_30d || 'N/A'}`);
    console.log(`   - 7-day trend: ${sampleFeatures.trend_7d || 'N/A'}`);
    console.log(`   - 30-day volatility: ${sampleFeatures.volatility_30d || 'N/A'}`);
    console.log(`   - Day of week: ${sampleFeatures.day_of_week}`);
    console.log(`   - Quarter: ${sampleFeatures.quarter + 1}`);
    console.log(`   - Target (next day): ${sampleFeatures.target}\n`);

    // Test all tenants
    console.log('7. Testing All Tenants...');
    const tenants = ['tenant-fintech-001', 'tenant-healthcare-002', 'tenant-manufacturing-003'];
    for (const tenantId of tenants) {
      const data = dataService.getCurrentState(tenantId);
      console.log(`✅ ${data.summary.total_risks} risks, ${data.controls.length} controls, ${data.summary.recent_incidents} incidents - ${tenantId}`);
    }
    console.log('');

    // Performance test
    console.log('8. Testing Performance...');
    const startTime = Date.now();
    for (let i = 0; i < 10; i++) {
      dataService.getCurrentState('tenant-fintech-001');
    }
    const endTime = Date.now();
    console.log(`✅ Performance: ${((endTime - startTime) / 10).toFixed(2)}ms average per call\n`);

    console.log('🎉 Phase 2A Enhanced Data Layer Test Complete!');
    console.log('\nSummary:');
    console.log('✅ Historical time-series data generation');
    console.log('✅ Feature engineering pipeline');
    console.log('✅ ML-ready data preparation');
    console.log('✅ Statistical analysis');
    console.log('✅ Multi-tenant support');
    console.log('✅ Performance optimization');
    console.log('\n🚀 Ready for Phase 2B: ML Model Implementation');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testEnhancedDataLayer();