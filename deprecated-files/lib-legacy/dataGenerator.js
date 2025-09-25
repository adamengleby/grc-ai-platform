#!/usr/bin/env node

/**
 * Enhanced Data Generator for Phase 2 Intelligence Layer
 * Generates realistic historical time-series data for GRC analytics
 */

class GRCDataGenerator {
  constructor() {
    this.startDate = new Date();
    this.startDate.setFullYear(this.startDate.getFullYear() - 1); // 12 months ago
    this.endDate = new Date();
  }

  /**
   * Generate realistic risk score time-series with seasonality and trends
   */
  generateRiskTimeSeries(baseScore, riskId, tenantConfig) {
    const timePoints = [];
    const currentDate = new Date(this.startDate);
    
    // Risk-specific parameters
    const volatility = this.getRiskVolatility(riskId);
    const seasonality = this.getRiskSeasonality(riskId, tenantConfig.industry);
    const trendDirection = this.getRiskTrend(riskId, tenantConfig.industry);
    
    while (currentDate <= this.endDate) {
      const dayOfYear = this.getDayOfYear(currentDate);
      const monthOfYear = currentDate.getMonth();
      const quarter = Math.floor(monthOfYear / 3);
      
      // Base seasonal adjustment
      const seasonalFactor = seasonality.amplitude * 
        Math.sin(2 * Math.PI * dayOfYear / 365 + seasonality.phase) + 1;
      
      // Quarterly business cycle (stronger for financial services)
      const quarterlyFactor = tenantConfig.industry === 'Financial Services' ?
        0.1 * Math.sin(2 * Math.PI * quarter / 4) + 1 : 1;
      
      // Long-term trend
      const daysSinceStart = (currentDate - this.startDate) / (1000 * 60 * 60 * 24);
      const trendFactor = 1 + (trendDirection * daysSinceStart / 365 * 0.2);
      
      // Random daily variation
      const randomFactor = 1 + (Math.random() - 0.5) * volatility;
      
      // Calculate final score
      let score = baseScore * seasonalFactor * quarterlyFactor * trendFactor * randomFactor;
      
      // Add incident spikes (random events that increase risk)
      if (Math.random() < 0.02) { // 2% chance per day
        score *= 1.3 + Math.random() * 0.5; // 30-80% increase
      }
      
      // Clamp to realistic range
      score = Math.max(0, Math.min(10, score));
      
      timePoints.push({
        date: new Date(currentDate),
        score: Math.round(score * 100) / 100,
        factors: {
          seasonal: Math.round(seasonalFactor * 1000) / 1000,
          quarterly: Math.round(quarterlyFactor * 1000) / 1000,
          trend: Math.round(trendFactor * 1000) / 1000,
          random: Math.round(randomFactor * 1000) / 1000
        }
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return timePoints;
  }

  /**
   * Generate incident patterns correlated with risk scores
   */
  generateIncidentHistory(riskTimeSeries, riskProfile) {
    const incidents = [];
    
    riskTimeSeries.forEach((point, index) => {
      // Probability of incident based on risk score
      const incidentProbability = Math.pow(point.score / 10, 2) * 0.05; // Higher risk = more incidents
      
      if (Math.random() < incidentProbability) {
        const severity = this.getIncidentSeverity(point.score);
        const impact = this.calculateIncidentImpact(severity, riskProfile);
        
        incidents.push({
          id: `INC-${incidents.length + 1}-${point.date.getFullYear()}`,
          date: new Date(point.date),
          riskId: riskProfile.id,
          severity,
          impact,
          title: this.generateIncidentTitle(riskProfile, severity),
          description: this.generateIncidentDescription(riskProfile, severity),
          resolution_days: this.getResolutionTime(severity),
          cost_impact: this.getCostImpact(severity, impact),
          contributing_factors: this.getContributingFactors(point, riskProfile)
        });
      }
    });
    
    return incidents;
  }

  /**
   * Generate control effectiveness trends over time
   */
  generateControlEffectivenessHistory(baseEffectiveness, controlProfile, incidents) {
    const timePoints = [];
    const currentDate = new Date(this.startDate);
    
    while (currentDate <= this.endDate) {
      let effectiveness = baseEffectiveness;
      
      // Gradual degradation over time (controls need maintenance)
      const daysSinceStart = (currentDate - this.startDate) / (1000 * 60 * 60 * 24);
      const degradationFactor = Math.max(0.7, 1 - (daysSinceStart / 365 * 0.1));
      
      // Impact of recent incidents
      const recentIncidents = incidents.filter(inc => 
        Math.abs(inc.date - currentDate) < 30 * 24 * 60 * 60 * 1000 // Within 30 days
      );
      const incidentImpact = recentIncidents.length > 0 ? 
        Math.max(0.6, 1 - (recentIncidents.length * 0.1)) : 1;
      
      // Random testing variations
      const testingVariation = 0.95 + Math.random() * 0.1; // ±5% variation
      
      // Improvement events (patches, updates, training)
      const improvementChance = controlProfile.maintenance_frequency === 'high' ? 0.05 : 0.02;
      const improvementFactor = Math.random() < improvementChance ? 1.1 + Math.random() * 0.1 : 1;
      
      effectiveness = effectiveness * degradationFactor * incidentImpact * testingVariation * improvementFactor;
      effectiveness = Math.max(0.3, Math.min(1.0, effectiveness)); // Realistic bounds
      
      timePoints.push({
        date: new Date(currentDate),
        effectiveness: Math.round(effectiveness * 1000) / 1000,
        factors: {
          degradation: Math.round(degradationFactor * 1000) / 1000,
          incident_impact: Math.round(incidentImpact * 1000) / 1000,
          testing: Math.round(testingVariation * 1000) / 1000,
          recent_incidents: recentIncidents.length
        },
        testing_date: this.shouldTest(currentDate, controlProfile) ? new Date(currentDate) : null,
        last_updated: this.getLastUpdateDate(currentDate, controlProfile)
      });
      
      currentDate.setDate(currentDate.getDate() + 7); // Weekly data points
    }
    
    return timePoints;
  }

  /**
   * Feature engineering - calculate derived metrics
   */
  calculateFeatures(timeSeries, windowSizes = [7, 30, 90]) {
    return timeSeries.map((point, index) => {
      const features = { ...point };
      
      windowSizes.forEach(window => {
        const windowStart = Math.max(0, index - window);
        const windowData = timeSeries.slice(windowStart, index + 1);
        
        if (windowData.length > 1) {
          features[`rolling_avg_${window}d`] = this.calculateAverage(windowData);
          features[`rolling_std_${window}d`] = this.calculateStdDev(windowData);
          features[`trend_${window}d`] = this.calculateTrend(windowData);
          features[`volatility_${window}d`] = this.calculateVolatility(windowData);
          features[`percentile_${window}d`] = this.calculatePercentile(windowData, point.score);
        }
      });
      
      // Additional features
      features.day_of_week = point.date.getDay();
      features.month_of_year = point.date.getMonth();
      features.quarter = Math.floor(point.date.getMonth() / 3);
      features.is_month_end = this.isMonthEnd(point.date);
      features.is_quarter_end = this.isQuarterEnd(point.date);
      features.is_year_end = this.isYearEnd(point.date);
      
      return features;
    });
  }

  // Helper methods for realistic data generation
  getRiskVolatility(riskId) {
    const volatilityMap = {
      1: 0.15, // Credit Risk - moderate volatility
      2: 0.25, // Data Breach - high volatility  
      3: 0.10  // Compliance - low volatility
    };
    return volatilityMap[riskId] || 0.15;
  }

  getRiskSeasonality(riskId, industry) {
    const seasonalityMap = {
      'Financial Services': {
        1: { amplitude: 0.2, phase: 0 },     // Credit risk peaks in Q4
        2: { amplitude: 0.15, phase: Math.PI }, // Cyber risk peaks mid-year
        3: { amplitude: 0.25, phase: Math.PI/2 } // Compliance peaks in Q1
      },
      'Healthcare': {
        1: { amplitude: 0.1, phase: Math.PI/4 },
        2: { amplitude: 0.2, phase: 0 },
        3: { amplitude: 0.15, phase: Math.PI }
      },
      'Manufacturing': {
        1: { amplitude: 0.15, phase: Math.PI },
        2: { amplitude: 0.1, phase: Math.PI/2 },
        3: { amplitude: 0.2, phase: 0 }
      }
    };
    return seasonalityMap[industry]?.[riskId] || { amplitude: 0.1, phase: 0 };
  }

  getRiskTrend(riskId, industry) {
    // Trend direction: positive = increasing risk, negative = decreasing
    const trendMap = {
      'Financial Services': [0.1, -0.05, 0.02], // Credit up, Data down, Compliance stable
      'Healthcare': [-0.02, 0.15, -0.1],        // HIPAA stable, Data up, Device down
      'Manufacturing': [0.05, -0.08, 0.0]       // Supply up, Env down, Cyber stable
    };
    return trendMap[industry]?.[riskId - 1] || 0;
  }

  getIncidentSeverity(riskScore) {
    if (riskScore >= 8.5) return 'Critical';
    if (riskScore >= 7.0) return 'High';
    if (riskScore >= 5.0) return 'Medium';
    return 'Low';
  }

  calculateIncidentImpact(severity, riskProfile) {
    const baseImpacts = {
      'Critical': { financial: 100000, operational: 0.8, reputational: 0.9 },
      'High': { financial: 50000, operational: 0.5, reputational: 0.6 },
      'Medium': { financial: 10000, operational: 0.2, reputational: 0.3 },
      'Low': { financial: 2000, operational: 0.1, reputational: 0.1 }
    };
    
    const base = baseImpacts[severity];
    const variation = 0.5 + Math.random(); // 50-150% of base
    
    return {
      financial: Math.round(base.financial * variation),
      operational: Math.min(1.0, base.operational * variation),
      reputational: Math.min(1.0, base.reputational * variation)
    };
  }

  generateIncidentTitle(riskProfile, severity) {
    const templates = {
      'Credit Risk Exposure': [
        'Credit Default Spike Detected',
        'Portfolio Risk Threshold Exceeded',
        'Loan Default Rate Anomaly'
      ],
      'Data Breach Risk': [
        'Suspicious Access Pattern Detected',
        'Data Exfiltration Attempt',
        'Unauthorized System Access'
      ],
      'Regulatory Compliance Gap': [
        'Compliance Audit Finding',
        'Regulatory Violation Identified',
        'Policy Adherence Failure'
      ]
    };
    
    const categoryTemplates = templates[riskProfile.title] || ['Generic Incident'];
    return categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];
  }

  generateIncidentDescription(riskProfile, severity) {
    const descriptions = {
      'Credit Risk Exposure': [
        'Automated monitoring detected unusual patterns in credit default rates across portfolio segments.',
        'Risk threshold exceeded due to concentration in high-risk borrower categories.',
        'Statistical analysis identified anomalous default patterns requiring investigation.'
      ],
      'Data Breach Risk': [
        'Security monitoring systems detected suspicious access patterns in customer data repositories.',
        'Potential data exfiltration attempt identified through anomalous network traffic analysis.',
        'Unauthorized access attempt to sensitive systems detected by intrusion detection systems.'
      ],
      'Regulatory Compliance Gap': [
        'Internal audit identified non-compliance with regulatory reporting requirements.',
        'Compliance monitoring detected policy violations requiring corrective action.',
        'Regulatory framework adherence failure identified through systematic review.'
      ]
    };
    
    const categoryDescriptions = descriptions[riskProfile.title] || ['Generic incident requiring investigation.'];
    return categoryDescriptions[Math.floor(Math.random() * categoryDescriptions.length)];
  }

  getResolutionTime(severity) {
    const baseDays = {
      'Critical': 1,
      'High': 3,
      'Medium': 7,
      'Low': 14
    };
    
    const base = baseDays[severity] || 7;
    return base + Math.floor(Math.random() * base); // Add some variation
  }

  getCostImpact(severity, impact) {
    const baseCosts = {
      'Critical': 50000,
      'High': 25000,
      'Medium': 10000,
      'Low': 2000
    };
    
    const base = baseCosts[severity] || 10000;
    const variation = 0.7 + Math.random() * 0.6; // 70-130% of base
    return Math.round(base * variation);
  }

  getContributingFactors(point, riskProfile) {
    const factors = [];
    
    if (point.factors.seasonal > 1.1) {
      factors.push('Seasonal business cycle impact');
    }
    
    if (point.factors.trend > 1.05) {
      factors.push('Upward risk trend acceleration');
    }
    
    if (point.factors.random > 1.2) {
      factors.push('Unusual operational circumstances');
    }
    
    if (point.factors.quarterly > 1.05) {
      factors.push('Quarter-end business pressures');
    }
    
    return factors.length > 0 ? factors : ['Standard operational factors'];
  }

  shouldTest(currentDate, controlProfile) {
    // Simulate testing schedule based on maintenance frequency
    const frequencies = {
      'high': 30,    // Every 30 days
      'medium': 90,  // Every 90 days  
      'low': 180     // Every 180 days
    };
    
    const frequency = frequencies[controlProfile.maintenance_frequency] || 90;
    const daysSinceStart = (currentDate - new Date(2023, 0, 1)) / (1000 * 60 * 60 * 24);
    
    return daysSinceStart % frequency < 7; // Testing week
  }

  getLastUpdateDate(currentDate, controlProfile) {
    // Simulate last update based on control profile
    const updateIntervals = {
      'high': 60,    // Updated every 60 days
      'medium': 120, // Updated every 120 days
      'low': 365     // Updated yearly
    };
    
    const interval = updateIntervals[controlProfile.maintenance_frequency] || 120;
    const updateDate = new Date(currentDate);
    updateDate.setDate(updateDate.getDate() - Math.floor(Math.random() * interval));
    
    return updateDate;
  }

  // Statistical calculation helpers
  calculateAverage(data) {
    const sum = data.reduce((acc, point) => acc + point.score, 0);
    return Math.round((sum / data.length) * 100) / 100;
  }

  calculateStdDev(data) {
    const avg = this.calculateAverage(data);
    const variance = data.reduce((acc, point) => acc + Math.pow(point.score - avg, 2), 0) / data.length;
    return Math.round(Math.sqrt(variance) * 100) / 100;
  }

  calculateTrend(data) {
    if (data.length < 2) return 0;
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);
    
    return Math.round((secondAvg - firstAvg) * 100) / 100;
  }

  calculateVolatility(data) {
    if (data.length < 2) return 0;
    let sumSquaredDiffs = 0;
    
    for (let i = 1; i < data.length; i++) {
      const diff = data[i].score - data[i-1].score;
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.round(Math.sqrt(sumSquaredDiffs / (data.length - 1)) * 100) / 100;
  }

  calculatePercentile(data, value) {
    const sorted = data.map(d => d.score).sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    return Math.round((index / sorted.length) * 100);
  }

  // Date utility helpers
  getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  isMonthEnd(date) {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    return nextDay.getMonth() !== date.getMonth();
  }

  isQuarterEnd(date) {
    const month = date.getMonth();
    return this.isMonthEnd(date) && (month === 2 || month === 5 || month === 8 || month === 11);
  }

  isYearEnd(date) {
    return this.isMonthEnd(date) && date.getMonth() === 11;
  }
}

export { GRCDataGenerator };