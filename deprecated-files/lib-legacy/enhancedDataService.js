#!/usr/bin/env node

/**
 * Enhanced Data Service for Phase 2 Intelligence Layer
 * Manages historical time-series data and feature engineering
 */

import { GRCDataGenerator } from './dataGenerator.js';

class EnhancedDataService {
  constructor() {
    this.generator = new GRCDataGenerator();
    this.historicalData = {};
    this.features = {};
    this.initialized = false;
  }

  /**
   * Initialize enhanced data for all tenants
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🔄 Initializing enhanced historical data...');
    
    const tenantConfigs = {
      'tenant-fintech-001': {
        name: 'FinTech Solutions Corp',
        industry: 'Financial Services',
        risks: [
          { id: 1, title: 'Credit Risk Exposure', baseScore: 8.5, category: 'Financial' },
          { id: 2, title: 'Data Breach Risk', baseScore: 9.2, category: 'Security' },
          { id: 3, title: 'Regulatory Compliance Gap', baseScore: 6.8, category: 'Compliance' }
        ],
        controls: [
          { id: 1, name: 'Multi-Factor Authentication', baseEffectiveness: 0.92, maintenance_frequency: 'high' },
          { id: 2, name: 'Credit Monitoring System', baseEffectiveness: 0.75, maintenance_frequency: 'medium' }
        ]
      },
      'tenant-healthcare-002': {
        name: 'Global Healthcare Systems',
        industry: 'Healthcare',
        risks: [
          { id: 1, title: 'HIPAA Violation Risk', baseScore: 9.0, category: 'Compliance' },
          { id: 2, title: 'Patient Data Security', baseScore: 8.7, category: 'Security' },
          { id: 3, title: 'Medical Device Vulnerability', baseScore: 7.2, category: 'Operational' }
        ],
        controls: [
          { id: 1, name: 'HIPAA Access Controls', baseEffectiveness: 0.88, maintenance_frequency: 'high' },
          { id: 2, name: 'Patient Data Encryption', baseEffectiveness: 0.94, maintenance_frequency: 'high' }
        ]
      },
      'tenant-manufacturing-003': {
        name: 'Advanced Manufacturing Ltd',
        industry: 'Manufacturing',
        risks: [
          { id: 1, title: 'Supply Chain Disruption', baseScore: 8.3, category: 'Operational' },
          { id: 2, title: 'Environmental Compliance', baseScore: 6.5, category: 'Compliance' },
          { id: 3, title: 'Cybersecurity Threat', baseScore: 7.9, category: 'Security' }
        ],
        controls: [
          { id: 1, name: 'Supplier Risk Assessment', baseEffectiveness: 0.70, maintenance_frequency: 'medium' },
          { id: 2, name: 'Environmental Monitoring', baseEffectiveness: 0.85, maintenance_frequency: 'high' }
        ]
      }
    };

    // Generate historical data for each tenant
    for (const [tenantId, config] of Object.entries(tenantConfigs)) {
      console.log(`📊 Generating data for ${config.name}...`);
      
      this.historicalData[tenantId] = {
        tenant: config,
        risks: {},
        controls: {},
        incidents: [],
        features: {}
      };

      // Generate risk time series
      for (const risk of config.risks) {
        console.log(`  📈 Risk: ${risk.title}`);
        const timeSeries = this.generator.generateRiskTimeSeries(risk.baseScore, risk.id, config);
        this.historicalData[tenantId].risks[risk.id] = {
          ...risk,
          timeSeries,
          current: timeSeries[timeSeries.length - 1]
        };
      }

      // Generate incidents based on risk patterns
      for (const risk of config.risks) {
        console.log(`  🚨 Incidents for: ${risk.title}`);
        const riskData = this.historicalData[tenantId].risks[risk.id];
        const incidents = this.generator.generateIncidentHistory(riskData.timeSeries, risk);
        this.historicalData[tenantId].incidents.push(...incidents);
      }

      // Generate control effectiveness history
      for (const control of config.controls) {
        console.log(`  🛡️ Control: ${control.name}`);
        const tenantIncidents = this.historicalData[tenantId].incidents;
        const effectivenessHistory = this.generator.generateControlEffectivenessHistory(
          control.baseEffectiveness, 
          control, 
          tenantIncidents
        );
        this.historicalData[tenantId].controls[control.id] = {
          ...control,
          effectivenessHistory,
          current: effectivenessHistory[effectivenessHistory.length - 1]
        };
      }

      // Calculate features for each risk
      for (const riskId of Object.keys(this.historicalData[tenantId].risks)) {
        const riskData = this.historicalData[tenantId].risks[riskId];
        const features = this.generator.calculateFeatures(riskData.timeSeries);
        this.historicalData[tenantId].features[riskId] = features;
      }
    }

    this.initialized = true;
    console.log('✅ Enhanced historical data initialization complete');
    this.logDataSummary();
  }

  /**
   * Get enhanced data for a specific tenant and analysis type
   */
  getTenantData(tenantId, options = {}) {
    if (!this.initialized) {
      throw new Error('Enhanced data service not initialized. Call initialize() first.');
    }

    const data = this.historicalData[tenantId];
    if (!data) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const result = {
      tenant: data.tenant,
      current_state: this.getCurrentState(tenantId),
      historical: {}
    };

    // Include historical data based on options
    if (options.includeRiskHistory) {
      result.historical.risks = data.risks;
    }

    if (options.includeControlHistory) {
      result.historical.controls = data.controls;
    }

    if (options.includeIncidents) {
      result.historical.incidents = data.incidents;
    }

    if (options.includeFeatures) {
      result.historical.features = data.features;
    }

    if (options.timeRange) {
      result.historical = this.filterByTimeRange(result.historical, options.timeRange);
    }

    return result;
  }

  /**
   * Get current state (latest values) for a tenant
   */
  getCurrentState(tenantId) {
    const data = this.historicalData[tenantId];
    if (!data) return null;

    const risks = Object.entries(data.risks).map(([id, risk]) => ({
      id: parseInt(id),
      title: risk.title,
      severity: this.calculateSeverity(risk.current.score),
      score: risk.current.score,
      category: risk.category,
      trend: this.calculateRecentTrend(risk.timeSeries),
      volatility: this.calculateRecentVolatility(risk.timeSeries)
    }));

    const controls = Object.entries(data.controls).map(([id, control]) => ({
      id: parseInt(id),
      name: control.name,
      status: control.current.effectiveness > 0.8 ? 'Effective' : 'Needs Review',
      effectiveness: control.current.effectiveness,
      trend: this.calculateControlTrend(control.effectivenessHistory),
      last_tested: control.current.testing_date
    }));

    const recentIncidents = data.incidents
      .filter(inc => {
        const daysSince = (new Date() - inc.date) / (1000 * 60 * 60 * 24);
        return daysSince <= 90; // Last 90 days
      })
      .length;

    return {
      risks,
      controls,
      summary: {
        total_risks: risks.length,
        critical_risks: risks.filter(r => r.severity === 'Critical').length,
        high_risks: risks.filter(r => r.severity === 'High').length,
        avg_risk_score: risks.reduce((sum, r) => sum + r.score, 0) / risks.length,
        control_effectiveness: controls.reduce((sum, c) => sum + c.effectiveness, 0) / controls.length,
        recent_incidents: recentIncidents,
        last_updated: new Date().toISOString()
      }
    };
  }

  /**
   * Get risk forecast data for ML predictions
   */
  getRiskForecastData(tenantId, riskId, options = {}) {
    const data = this.historicalData[tenantId];
    if (!data || !data.risks[riskId]) {
      throw new Error(`Risk ${riskId} not found for tenant ${tenantId}`);
    }

    const risk = data.risks[riskId];
    const features = data.features[riskId];
    
    // Prepare training data (features + target)
    const trainingData = features.map((point, index) => ({
      // Input features
      current_score: point.score,
      rolling_avg_7d: point.rolling_avg_7d || point.score,
      rolling_avg_30d: point.rolling_avg_30d || point.score,
      trend_7d: point.trend_7d || 0,
      trend_30d: point.trend_30d || 0,
      volatility_7d: point.volatility_7d || 0,
      volatility_30d: point.volatility_30d || 0,
      day_of_week: point.day_of_week,
      month_of_year: point.month_of_year,
      quarter: point.quarter,
      is_month_end: point.is_month_end ? 1 : 0,
      is_quarter_end: point.is_quarter_end ? 1 : 0,
      
      // Target (next day's score)
      target: index < features.length - 1 ? features[index + 1].score : null,
      
      // Metadata
      date: point.date,
      original_point: point
    })).filter(point => point.target !== null); // Remove last point (no target)

    return {
      risk_info: {
        id: riskId,
        title: risk.title,
        category: risk.category,
        current_score: risk.current.score
      },
      training_data: trainingData,
      statistics: this.calculateDataStatistics(trainingData),
      data_quality: this.assessDataQuality(trainingData)
    };
  }

  /**
   * Calculate data statistics for ML readiness
   */
  calculateDataStatistics(data) {
    const scores = data.map(d => d.current_score);
    const targets = data.map(d => d.target);
    
    return {
      sample_count: data.length,
      score_range: {
        min: Math.min(...scores),
        max: Math.max(...scores),
        mean: scores.reduce((a, b) => a + b, 0) / scores.length,
        std: Math.sqrt(scores.reduce((a, b) => a + Math.pow(b - scores.reduce((x, y) => x + y, 0) / scores.length, 2), 0) / scores.length)
      },
      target_correlation: this.calculateCorrelation(scores.slice(0, -1), targets.slice(1)),
      missing_values: data.filter(d => Object.values(d).some(v => v === null || v === undefined)).length,
      outliers: scores.filter(s => Math.abs(s - scores.reduce((a, b) => a + b, 0) / scores.length) > 2 * Math.sqrt(scores.reduce((a, b) => a + Math.pow(b - scores.reduce((x, y) => x + y, 0) / scores.length, 2), 0) / scores.length)).length
    };
  }

  /**
   * Assess data quality for ML training
   */
  assessDataQuality(data) {
    const stats = this.calculateDataStatistics(data);
    
    return {
      sample_size_adequate: stats.sample_count >= 100,
      low_missing_values: stats.missing_values < stats.sample_count * 0.05,
      reasonable_variance: stats.score_range.std > 0.1 && stats.score_range.std < 3,
      low_outliers: stats.outliers < stats.sample_count * 0.05,
      temporal_correlation: Math.abs(stats.target_correlation) > 0.1,
      overall_quality: 'good' // TODO: Calculate based on above metrics
    };
  }

  // Helper methods
  calculateSeverity(score) {
    if (score >= 8.5) return 'Critical';
    if (score >= 7.0) return 'High';
    if (score >= 5.0) return 'Medium';
    return 'Low';
  }

  calculateRecentTrend(timeSeries, days = 30) {
    if (timeSeries.length < days) return 0;
    const recent = timeSeries.slice(-days);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, p) => sum + p.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.score, 0) / secondHalf.length;
    
    return Math.round((secondAvg - firstAvg) * 100) / 100;
  }

  calculateRecentVolatility(timeSeries, days = 30) {
    if (timeSeries.length < days) return 0;
    const recent = timeSeries.slice(-days);
    let sumSquaredDiffs = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const diff = recent[i].score - recent[i-1].score;
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.round(Math.sqrt(sumSquaredDiffs / (recent.length - 1)) * 100) / 100;
  }

  calculateControlTrend(effectivenessHistory, weeks = 8) {
    if (effectivenessHistory.length < weeks) return 0;
    const recent = effectivenessHistory.slice(-weeks);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, p) => sum + p.effectiveness, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.effectiveness, 0) / secondHalf.length;
    
    return Math.round((secondAvg - firstAvg) * 100) / 100;
  }

  calculateCorrelation(arr1, arr2) {
    const n = Math.min(arr1.length, arr2.length);
    const sum1 = arr1.slice(0, n).reduce((a, b) => a + b, 0);
    const sum2 = arr2.slice(0, n).reduce((a, b) => a + b, 0);
    const sum1Sq = arr1.slice(0, n).reduce((a, b) => a + b * b, 0);
    const sum2Sq = arr2.slice(0, n).reduce((a, b) => a + b * b, 0);
    const pSum = arr1.slice(0, n).reduce((a, b, i) => a + b * arr2[i], 0);
    
    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
    
    return den === 0 ? 0 : num / den;
  }

  filterByTimeRange(data, timeRange) {
    // TODO: Implement time range filtering
    return data;
  }

  logDataSummary() {
    console.log('\n📊 Enhanced Data Summary:');
    Object.entries(this.historicalData).forEach(([tenantId, data]) => {
      const riskCount = Object.keys(data.risks).length;
      const controlCount = Object.keys(data.controls).length;
      const incidentCount = data.incidents.length;
      const avgTimeSeries = Object.values(data.risks)[0]?.timeSeries?.length || 0;
      
      console.log(`  ${data.tenant.name}:`);
      console.log(`    📈 ${riskCount} risks, ${avgTimeSeries} time points each`);
      console.log(`    🛡️ ${controlCount} controls with effectiveness history`);
      console.log(`    🚨 ${incidentCount} historical incidents generated`);
    });
    console.log('');
  }
}

export { EnhancedDataService };