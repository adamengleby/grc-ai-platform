/**
 * Risk Data Simulator for GRC AI Platform
 * Generates realistic risk management data for testing and demonstration
 */

class RiskDataSimulator {
  constructor() {
    this.currentDate = new Date();
    this.riskIdCounter = 1000;
    this.incidentIdCounter = 5000;
    this.controlIdCounter = 3000;
  }

  /**
   * Generate a complete risk register with realistic entries
   */
  generateRiskRegister(count = 50) {
    const risks = [];
    const categories = ['operational', 'financial', 'compliance', 'strategic', 'cybersecurity'];
    const owners = [
      'Chief Risk Officer',
      'Chief Information Security Officer',
      'Chief Financial Officer',
      'Chief Operating Officer',
      'Chief Compliance Officer',
      'VP Engineering',
      'VP Sales',
      'Director of IT',
      'Director of HR'
    ];

    for (let i = 0; i < count; i++) {
      const category = this.selectWeighted(categories, [0.35, 0.25, 0.20, 0.10, 0.10]);
      const risk = this.generateRisk(category, owners);
      risks.push(risk);
    }

    return this.calculatePortfolioMetrics(risks);
  }

  /**
   * Generate a single risk entry with all required fields
   */
  generateRisk(category, owners) {
    const riskTemplates = this.getRiskTemplates()[category];
    const template = riskTemplates[Math.floor(Math.random() * riskTemplates.length)];
    
    const inherentLikelihood = this.generateLikelihood();
    const inherentImpact = this.generateImpact(category);
    const controls = this.generateControls(category, 2 + Math.floor(Math.random() * 3));
    const controlEffectiveness = this.calculateAggregateEffectiveness(controls);
    
    const residualLikelihood = Math.max(1, Math.round(inherentLikelihood * (1 - controlEffectiveness * 0.3)));
    const residualImpact = Math.max(1, Math.round(inherentImpact * (1 - controlEffectiveness * 0.2)));
    
    const risk = {
      riskId: `RISK-${this.currentDate.getFullYear()}-${String(this.riskIdCounter++).padStart(4, '0')}`,
      title: template.title,
      description: template.description,
      category: category,
      subcategory: template.subcategory,
      riskOwner: owners[Math.floor(Math.random() * owners.length)],
      
      inherentRisk: {
        likelihood: inherentLikelihood,
        impact: inherentImpact,
        score: inherentLikelihood * inherentImpact,
        rating: this.getRiskRating(inherentLikelihood * inherentImpact),
        financialExposure: this.calculateFinancialExposure(inherentLikelihood, inherentImpact)
      },
      
      controls: controls,
      controlEffectiveness: Math.round(controlEffectiveness * 100),
      
      residualRisk: {
        likelihood: residualLikelihood,
        impact: residualImpact,
        score: residualLikelihood * residualImpact,
        rating: this.getRiskRating(residualLikelihood * residualImpact),
        financialExposure: this.calculateFinancialExposure(residualLikelihood, residualImpact)
      },
      
      riskAppetiteStatus: this.determineAppetiteStatus(residualLikelihood * residualImpact, category),
      trend: this.selectWeighted(['Increasing', 'Stable', 'Decreasing'], [0.3, 0.5, 0.2]),
      velocity: this.selectWeighted(['High', 'Medium', 'Low'], [0.2, 0.5, 0.3]),
      
      treatment: this.generateTreatmentPlan(residualLikelihood * residualImpact),
      kris: this.generateKRIs(category, template.subcategory),
      
      lastAssessment: this.generatePastDate(90),
      nextAssessment: this.generateFutureDate(90),
      createdDate: this.generatePastDate(365),
      modifiedDate: this.generatePastDate(30),
      
      aiMetrics: {
        classificationConfidence: 0.75 + Math.random() * 0.23,
        anomalyScore: Math.random() * 0.3,
        similarRisksIdentified: Math.floor(Math.random() * 15),
        predictedLikelihoodChange: -0.1 + Math.random() * 0.2
      }
    };
    
    return risk;
  }

  /**
   * Generate realistic controls for a risk
   */
  generateControls(category, count) {
    const controlTypes = ['Preventive', 'Detective', 'Corrective', 'Compensating'];
    const controlTemplates = this.getControlTemplates()[category];
    const controls = [];
    
    for (let i = 0; i < count; i++) {
      const template = controlTemplates[Math.floor(Math.random() * controlTemplates.length)];
      const designScore = 60 + Math.random() * 40;
      const operationalScore = 50 + Math.random() * 50;
      const effectiveness = (designScore * 0.4 + operationalScore * 0.6) / 100;
      
      controls.push({
        id: `CTRL-${String(this.controlIdCounter++).padStart(4, '0')}`,
        name: template.name,
        type: controlTypes[Math.floor(Math.random() * controlTypes.length)],
        framework: template.framework,
        
        effectiveness: effectiveness,
        designScore: Math.round(designScore),
        operationalScore: Math.round(operationalScore),
        
        automationLevel: this.selectWeighted(['Manual', 'Semi-Automated', 'Fully Automated'], [0.4, 0.4, 0.2]),
        frequency: template.frequency,
        
        lastTested: this.generatePastDate(60),
        nextTest: this.generateFutureDate(30),
        
        gaps: this.generateControlGaps(operationalScore),
        remediationStatus: operationalScore < 70 ? 'In Progress' : 'Not Required',
        
        cost: {
          implementation: template.implementationCost,
          annual: template.annualCost
        }
      });
    }
    
    return controls;
  }

  /**
   * Generate Key Risk Indicators
   */
  generateKRIs(category, subcategory) {
    const kriTemplates = this.getKRITemplates()[category];
    const kris = [];
    
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const template = kriTemplates[Math.floor(Math.random() * kriTemplates.length)];
      const current = template.target * (0.7 + Math.random() * 0.6);
      
      kris.push({
        name: template.name,
        current: Math.round(current * 100) / 100,
        target: template.target,
        threshold: template.threshold,
        unit: template.unit,
        trend: this.generateTrend(current, template.target),
        status: this.getKRIStatus(current, template.target, template.threshold),
        frequency: template.frequency,
        lastUpdated: this.generatePastDate(7)
      });
    }
    
    return kris;
  }

  /**
   * Generate incident data for AI classification testing
   */
  generateIncidents(count = 100) {
    const incidents = [];
    const incidentTypes = {
      'Data Breach': {
        category: 'cybersecurity',
        severity: [0.1, 0.2, 0.3, 0.3, 0.1],
        avgCost: 150000,
        avgResolutionHours: 72
      },
      'System Outage': {
        category: 'operational',
        severity: [0.2, 0.3, 0.3, 0.15, 0.05],
        avgCost: 75000,
        avgResolutionHours: 8
      },
      'Compliance Violation': {
        category: 'compliance',
        severity: [0.15, 0.25, 0.35, 0.2, 0.05],
        avgCost: 50000,
        avgResolutionHours: 168
      },
      'Financial Misstatement': {
        category: 'financial',
        severity: [0.1, 0.2, 0.3, 0.25, 0.15],
        avgCost: 200000,
        avgResolutionHours: 240
      },
      'Process Failure': {
        category: 'operational',
        severity: [0.3, 0.35, 0.25, 0.08, 0.02],
        avgCost: 25000,
        avgResolutionHours: 24
      }
    };
    
    for (let i = 0; i < count; i++) {
      const type = Object.keys(incidentTypes)[Math.floor(Math.random() * Object.keys(incidentTypes).length)];
      const config = incidentTypes[type];
      const severity = this.selectWeighted([1, 2, 3, 4, 5], config.severity);
      
      incidents.push({
        incidentId: `INC-${String(this.incidentIdCounter++).padStart(6, '0')}`,
        title: `${type} - ${this.generateIncidentTitle(type)}`,
        type: type,
        category: config.category,
        
        severity: severity,
        priority: this.calculatePriority(severity),
        status: this.selectWeighted(['Open', 'In Progress', 'Resolved', 'Closed'], [0.15, 0.35, 0.3, 0.2]),
        
        discoveryDate: this.generatePastDate(30),
        reportedBy: this.generateReporter(),
        assignedTo: this.generateAssignee(config.category),
        
        description: this.generateIncidentDescription(type),
        rootCause: severity >= 3 ? this.generateRootCause(type) : null,
        
        impact: {
          financial: config.avgCost * (0.5 + Math.random() * 2),
          operational: this.generateOperationalImpact(severity),
          reputational: severity >= 4 ? 'High' : severity >= 3 ? 'Medium' : 'Low',
          regulatory: config.category === 'compliance' || severity >= 4
        },
        
        resolution: {
          timeToDetect: Math.round(Math.random() * 72),
          timeToRespond: Math.round(Math.random() * 4),
          timeToResolve: Math.round(config.avgResolutionHours * (0.5 + Math.random() * 1.5)),
          cost: Math.round(config.avgCost * (0.3 + Math.random() * 0.7))
        },
        
        aiClassification: {
          confidence: 0.65 + Math.random() * 0.35,
          suggestedCategory: config.category,
          suggestedSeverity: severity,
          similarIncidents: Math.floor(Math.random() * 20),
          anomalyDetected: Math.random() > 0.8
        },
        
        lessonsLearned: severity >= 3 ? this.generateLessonsLearned(type) : null,
        preventiveMeasures: severity >= 3 ? this.generatePreventiveMeasures(type) : null
      });
    }
    
    return incidents;
  }

  /**
   * Generate compliance assessment data
   */
  generateComplianceAssessment(framework = 'ISO27001') {
    const frameworks = {
      'ISO27001': { controls: 93, categories: 4 },
      'SOC2': { controls: 64, categories: 5 },
      'PCI-DSS': { controls: 258, categories: 12 },
      'GDPR': { controls: 99, categories: 11 },
      'HIPAA': { controls: 54, categories: 5 }
    };
    
    const config = frameworks[framework];
    const assessment = {
      framework: framework,
      assessmentId: `ASSESS-${this.currentDate.getFullYear()}-${Math.floor(Math.random() * 9999)}`,
      assessmentDate: this.currentDate.toISOString(),
      
      overallCompliance: 75 + Math.random() * 20,
      maturityLevel: Math.floor(2 + Math.random() * 3),
      
      controlResults: [],
      gaps: [],
      recommendations: [],
      
      metrics: {
        totalControls: config.controls,
        compliantControls: 0,
        partiallyCompliantControls: 0,
        nonCompliantControls: 0,
        notApplicableControls: 0
      }
    };
    
    // Generate control assessment results
    for (let i = 0; i < config.controls; i++) {
      const status = this.selectWeighted(
        ['Compliant', 'Partially Compliant', 'Non-Compliant', 'Not Applicable'],
        [0.65, 0.20, 0.10, 0.05]
      );
      
      const result = {
        controlId: `${framework}-${String(i + 1).padStart(3, '0')}`,
        status: status,
        evidence: status === 'Compliant' ? 'Documented and tested' : null,
        gap: status !== 'Compliant' && status !== 'Not Applicable' ? this.generateComplianceGap() : null,
        remediationPriority: status === 'Non-Compliant' ? 'High' : status === 'Partially Compliant' ? 'Medium' : 'Low',
        estimatedRemediationEffort: status !== 'Compliant' ? Math.floor(Math.random() * 40) + 10 : 0
      };
      
      assessment.controlResults.push(result);
      
      // Update metrics
      switch(status) {
        case 'Compliant':
          assessment.metrics.compliantControls++;
          break;
        case 'Partially Compliant':
          assessment.metrics.partiallyCompliantControls++;
          break;
        case 'Non-Compliant':
          assessment.metrics.nonCompliantControls++;
          break;
        case 'Not Applicable':
          assessment.metrics.notApplicableControls++;
          break;
      }
    }
    
    // Generate high-level gaps and recommendations
    assessment.gaps = this.generateHighLevelGaps(framework);
    assessment.recommendations = this.generateRecommendations(assessment.gaps);
    
    return assessment;
  }

  /**
   * Generate risk heatmap data
   */
  generateRiskHeatmap(risks) {
    const heatmap = {
      matrix: Array(5).fill(null).map(() => Array(5).fill(null).map(() => [])),
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        negligible: 0
      }
    };
    
    risks.forEach(risk => {
      const likelihood = risk.residualRisk.likelihood - 1;
      const impact = risk.residualRisk.impact - 1;
      
      heatmap.matrix[likelihood][impact].push({
        id: risk.riskId,
        title: risk.title,
        owner: risk.riskOwner,
        trend: risk.trend
      });
      
      // Update summary
      const rating = risk.residualRisk.rating.toLowerCase();
      if (heatmap.summary[rating] !== undefined) {
        heatmap.summary[rating]++;
      }
    });
    
    return heatmap;
  }

  // Helper methods
  selectWeighted(options, weights) {
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < options.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return options[i];
      }
    }
    
    return options[options.length - 1];
  }

  generateLikelihood() {
    return this.selectWeighted([1, 2, 3, 4, 5], [0.1, 0.2, 0.4, 0.2, 0.1]);
  }

  generateImpact(category) {
    const impactWeights = {
      'operational': [0.15, 0.25, 0.35, 0.20, 0.05],
      'financial': [0.10, 0.20, 0.30, 0.25, 0.15],
      'compliance': [0.05, 0.15, 0.40, 0.30, 0.10],
      'strategic': [0.05, 0.10, 0.25, 0.35, 0.25],
      'cybersecurity': [0.05, 0.15, 0.30, 0.30, 0.20]
    };
    
    return this.selectWeighted([1, 2, 3, 4, 5], impactWeights[category]);
  }

  getRiskRating(score) {
    if (score >= 20) return 'Critical';
    if (score >= 13) return 'High';
    if (score >= 7) return 'Medium';
    if (score >= 4) return 'Low';
    return 'Negligible';
  }

  calculateFinancialExposure(likelihood, impact) {
    const baseExposure = [10000, 50000, 250000, 1000000, 5000000];
    const probabilityFactor = likelihood / 5;
    return Math.round(baseExposure[impact - 1] * probabilityFactor);
  }

  calculateAggregateEffectiveness(controls) {
    if (controls.length === 0) return 0;
    
    // Use complementary probability for multiple controls
    let ineffectiveness = 1;
    controls.forEach(control => {
      ineffectiveness *= (1 - control.effectiveness);
    });
    
    return 1 - ineffectiveness;
  }

  determineAppetiteStatus(score, category) {
    const appetiteThresholds = {
      'operational': 12,
      'financial': 10,
      'compliance': 6,
      'strategic': 15,
      'cybersecurity': 8
    };
    
    const threshold = appetiteThresholds[category];
    
    if (score <= threshold * 0.5) return 'Well Within Tolerance';
    if (score <= threshold) return 'Within Tolerance';
    if (score <= threshold * 1.5) return 'Approaching Limit';
    return 'Exceeds Tolerance';
  }

  generateTreatmentPlan(riskScore) {
    if (riskScore < 4) {
      return {
        strategy: 'Tolerate',
        actions: ['Continue monitoring', 'Review annually'],
        investment: 0,
        targetDate: this.generateFutureDate(365)
      };
    }
    
    if (riskScore < 10) {
      return {
        strategy: 'Treat',
        actions: [
          'Enhance monitoring procedures',
          'Implement additional detective controls',
          'Update training materials'
        ],
        investment: 25000 + Math.floor(Math.random() * 50000),
        targetDate: this.generateFutureDate(90)
      };
    }
    
    if (riskScore < 16) {
      return {
        strategy: 'Treat',
        actions: [
          'Implement new preventive controls',
          'Redesign process',
          'Deploy technology solution',
          'Enhance governance structure'
        ],
        investment: 75000 + Math.floor(Math.random() * 150000),
        targetDate: this.generateFutureDate(180)
      };
    }
    
    return {
      strategy: this.selectWeighted(['Treat', 'Transfer', 'Terminate'], [0.6, 0.3, 0.1]),
      actions: [
        'Executive review required',
        'Consider strategic alternatives',
        'Implement comprehensive control framework',
        'Evaluate insurance options'
      ],
      investment: 200000 + Math.floor(Math.random() * 300000),
      targetDate: this.generateFutureDate(60)
    };
  }

  generatePastDate(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
    return date.toISOString().split('T')[0];
  }

  generateFutureDate(daysAhead) {
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead));
    return date.toISOString().split('T')[0];
  }

  calculatePortfolioMetrics(risks) {
    const portfolio = {
      risks: risks,
      summary: {
        totalRisks: risks.length,
        averageInherentScore: 0,
        averageResidualScore: 0,
        totalInherentExposure: 0,
        totalResidualExposure: 0,
        risksAboveAppetite: 0,
        risksByCategory: {},
        risksByRating: {},
        topRisks: []
      }
    };
    
    // Calculate metrics
    risks.forEach(risk => {
      portfolio.summary.averageInherentScore += risk.inherentRisk.score;
      portfolio.summary.averageResidualScore += risk.residualRisk.score;
      portfolio.summary.totalInherentExposure += risk.inherentRisk.financialExposure;
      portfolio.summary.totalResidualExposure += risk.residualRisk.financialExposure;
      
      if (risk.riskAppetiteStatus.includes('Exceeds')) {
        portfolio.summary.risksAboveAppetite++;
      }
      
      // Count by category
      if (!portfolio.summary.risksByCategory[risk.category]) {
        portfolio.summary.risksByCategory[risk.category] = 0;
      }
      portfolio.summary.risksByCategory[risk.category]++;
      
      // Count by rating
      if (!portfolio.summary.risksByRating[risk.residualRisk.rating]) {
        portfolio.summary.risksByRating[risk.residualRisk.rating] = 0;
      }
      portfolio.summary.risksByRating[risk.residualRisk.rating]++;
    });
    
    // Calculate averages
    portfolio.summary.averageInherentScore /= risks.length;
    portfolio.summary.averageResidualScore /= risks.length;
    
    // Get top risks
    portfolio.summary.topRisks = risks
      .sort((a, b) => b.residualRisk.score - a.residualRisk.score)
      .slice(0, 10)
      .map(r => ({
        id: r.riskId,
        title: r.title,
        score: r.residualRisk.score,
        owner: r.riskOwner
      }));
    
    return portfolio;
  }

  // Template methods
  getRiskTemplates() {
    return {
      operational: [
        { title: 'Critical System Failure', description: 'Core business system becomes unavailable', subcategory: 'System Downtime' },
        { title: 'Supply Chain Disruption', description: 'Key supplier unable to deliver', subcategory: 'Third-Party Failure' },
        { title: 'Process Automation Failure', description: 'RPA bots producing errors', subcategory: 'Process Failure' },
        { title: 'Data Quality Issues', description: 'Inaccurate data affecting decisions', subcategory: 'Data Management' },
        { title: 'Change Management Failure', description: 'Failed deployment causing outage', subcategory: 'Change Management' }
      ],
      financial: [
        { title: 'Credit Default', description: 'Major customer payment default', subcategory: 'Credit Risk' },
        { title: 'FX Exposure', description: 'Adverse currency movements', subcategory: 'Market Risk' },
        { title: 'Budget Overrun', description: 'Project exceeding approved budget', subcategory: 'Budget Management' },
        { title: 'Liquidity Shortage', description: 'Insufficient cash for operations', subcategory: 'Liquidity Risk' },
        { title: 'Investment Loss', description: 'Strategic investment underperforming', subcategory: 'Investment Risk' }
      ],
      compliance: [
        { title: 'GDPR Violation', description: 'Non-compliance with data protection', subcategory: 'Data Privacy' },
        { title: 'SOX Non-Compliance', description: 'Financial reporting control failure', subcategory: 'Financial Reporting' },
        { title: 'License Breach', description: 'Operating without required licenses', subcategory: 'Licensing' },
        { title: 'Policy Violation', description: 'Systematic breach of internal policies', subcategory: 'Internal Compliance' },
        { title: 'Regulatory Reporting Failure', description: 'Late or inaccurate regulatory filing', subcategory: 'Regulatory Reporting' }
      ],
      strategic: [
        { title: 'Market Share Loss', description: 'Competitor taking market share', subcategory: 'Competition' },
        { title: 'Digital Disruption', description: 'New technology making products obsolete', subcategory: 'Technology' },
        { title: 'Reputation Damage', description: 'Negative media coverage', subcategory: 'Reputation' },
        { title: 'M&A Integration Failure', description: 'Acquisition not delivering value', subcategory: 'M&A' },
        { title: 'Talent Retention Crisis', description: 'Key employees leaving', subcategory: 'Human Capital' }
      ],
      cybersecurity: [
        { title: 'Ransomware Attack', description: 'Malware encrypting critical data', subcategory: 'Malware' },
        { title: 'Data Breach', description: 'Unauthorized access to sensitive data', subcategory: 'Data Security' },
        { title: 'Insider Threat', description: 'Malicious employee activity', subcategory: 'Insider Risk' },
        { title: 'Zero-Day Vulnerability', description: 'Unpatched critical vulnerability', subcategory: 'Vulnerabilities' },
        { title: 'DDoS Attack', description: 'Service availability attack', subcategory: 'Availability' }
      ]
    };
  }

  getControlTemplates() {
    return {
      operational: [
        { name: 'Business Continuity Plan', framework: 'ISO22301', frequency: 'Annual', implementationCost: 75000, annualCost: 15000 },
        { name: 'Change Advisory Board', framework: 'ITIL', frequency: 'Weekly', implementationCost: 25000, annualCost: 50000 },
        { name: 'Automated Monitoring', framework: 'COBIT', frequency: 'Continuous', implementationCost: 100000, annualCost: 20000 },
        { name: 'Vendor Risk Assessment', framework: 'ISO27001', frequency: 'Quarterly', implementationCost: 35000, annualCost: 10000 }
      ],
      financial: [
        { name: 'Credit Checks', framework: 'Basel III', frequency: 'Per Transaction', implementationCost: 50000, annualCost: 25000 },
        { name: 'Budget Variance Analysis', framework: 'COSO', frequency: 'Monthly', implementationCost: 20000, annualCost: 5000 },
        { name: 'Treasury Management System', framework: 'ISO31000', frequency: 'Daily', implementationCost: 200000, annualCost: 40000 },
        { name: 'Financial Reconciliation', framework: 'SOX', frequency: 'Daily', implementationCost: 45000, annualCost: 15000 }
      ],
      compliance: [
        { name: 'Privacy Impact Assessment', framework: 'GDPR', frequency: 'Per Project', implementationCost: 30000, annualCost: 20000 },
        { name: 'Compliance Training', framework: 'ISO19600', frequency: 'Annual', implementationCost: 25000, annualCost: 30000 },
        { name: 'Policy Management System', framework: 'ISO27001', frequency: 'Continuous', implementationCost: 60000, annualCost: 12000 },
        { name: 'Regulatory Change Monitoring', framework: 'COSO', frequency: 'Weekly', implementationCost: 40000, annualCost: 35000 }
      ],
      strategic: [
        { name: 'Competitive Intelligence', framework: 'Custom', frequency: 'Monthly', implementationCost: 80000, annualCost: 60000 },
        { name: 'Innovation Pipeline', framework: 'Stage-Gate', frequency: 'Quarterly', implementationCost: 150000, annualCost: 100000 },
        { name: 'Reputation Monitoring', framework: 'ISO31000', frequency: 'Daily', implementationCost: 45000, annualCost: 30000 },
        { name: 'Strategic Planning Process', framework: 'Balanced Scorecard', frequency: 'Annual', implementationCost: 100000, annualCost: 50000 }
      ],
      cybersecurity: [
        { name: 'Endpoint Detection & Response', framework: 'NIST CSF', frequency: 'Continuous', implementationCost: 150000, annualCost: 50000 },
        { name: 'Security Awareness Training', framework: 'ISO27001', frequency: 'Quarterly', implementationCost: 35000, annualCost: 25000 },
        { name: 'Vulnerability Management', framework: 'NIST CSF', frequency: 'Weekly', implementationCost: 75000, annualCost: 20000 },
        { name: 'Identity Access Management', framework: 'ISO27001', frequency: 'Continuous', implementationCost: 200000, annualCost: 40000 }
      ]
    };
  }

  getKRITemplates() {
    return {
      operational: [
        { name: 'System Availability %', target: 99.5, threshold: 99.0, unit: '%', frequency: 'Real-time' },
        { name: 'Incident Resolution Time', target: 4, threshold: 8, unit: 'hours', frequency: 'Daily' },
        { name: 'Change Success Rate %', target: 95, threshold: 90, unit: '%', frequency: 'Weekly' },
        { name: 'Process Cycle Time', target: 24, threshold: 48, unit: 'hours', frequency: 'Daily' }
      ],
      financial: [
        { name: 'Days Sales Outstanding', target: 45, threshold: 60, unit: 'days', frequency: 'Weekly' },
        { name: 'Budget Variance %', target: 5, threshold: 10, unit: '%', frequency: 'Monthly' },
        { name: 'Working Capital Ratio', target: 1.5, threshold: 1.2, unit: 'ratio', frequency: 'Weekly' },
        { name: 'Cost Per Transaction', target: 10, threshold: 15, unit: '$', frequency: 'Daily' }
      ],
      compliance: [
        { name: 'Audit Finding Closure %', target: 90, threshold: 75, unit: '%', frequency: 'Monthly' },
        { name: 'Policy Exception Rate %', target: 5, threshold: 10, unit: '%', frequency: 'Monthly' },
        { name: 'Training Completion %', target: 95, threshold: 85, unit: '%', frequency: 'Quarterly' },
        { name: 'Regulatory Filing Timeliness', target: 100, threshold: 98, unit: '%', frequency: 'Monthly' }
      ],
      strategic: [
        { name: 'Customer Satisfaction Score', target: 85, threshold: 75, unit: 'score', frequency: 'Monthly' },
        { name: 'Market Share %', target: 25, threshold: 20, unit: '%', frequency: 'Quarterly' },
        { name: 'Employee Turnover %', target: 10, threshold: 15, unit: '%', frequency: 'Monthly' },
        { name: 'Innovation Pipeline Value', target: 10000000, threshold: 5000000, unit: '$', frequency: 'Quarterly' }
      ],
      cybersecurity: [
        { name: 'Phishing Click Rate %', target: 3, threshold: 5, unit: '%', frequency: 'Monthly' },
        { name: 'Patch Compliance %', target: 95, threshold: 90, unit: '%', frequency: 'Weekly' },
        { name: 'Security Incidents', target: 5, threshold: 10, unit: 'count', frequency: 'Monthly' },
        { name: 'Mean Time to Detect', target: 24, threshold: 48, unit: 'hours', frequency: 'Monthly' }
      ]
    };
  }

  generateControlGaps(score) {
    const gaps = [];
    
    if (score < 90) gaps.push('Documentation incomplete');
    if (score < 80) gaps.push('Testing not performed regularly');
    if (score < 70) gaps.push('Manual processes prone to error');
    if (score < 60) gaps.push('No monitoring in place');
    if (score < 50) gaps.push('Control design flaws identified');
    
    return gaps;
  }

  generateTrend(current, target) {
    const performance = current / target;
    
    if (performance > 1.1) return 'Significantly Above Target';
    if (performance > 1.0) return 'Above Target';
    if (performance > 0.9) return 'Near Target';
    if (performance > 0.75) return 'Below Target';
    return 'Significantly Below Target';
  }

  getKRIStatus(current, target, threshold) {
    if (current <= target) return 'Green';
    if (current <= threshold) return 'Amber';
    return 'Red';
  }

  generateIncidentTitle(type) {
    const titles = {
      'Data Breach': ['Customer PII exposed', 'Employee data leak', 'Third-party breach', 'Database misconfiguration'],
      'System Outage': ['Production server down', 'Network failure', 'Database corruption', 'Load balancer failure'],
      'Compliance Violation': ['Missing audit evidence', 'Unapproved change', 'Policy breach', 'Late regulatory filing'],
      'Financial Misstatement': ['Revenue recognition error', 'Expense misclassification', 'Asset valuation issue', 'Journal entry error'],
      'Process Failure': ['Batch job failure', 'Workflow breakdown', 'Integration error', 'Data sync failure']
    };
    
    const options = titles[type];
    return options[Math.floor(Math.random() * options.length)];
  }

  generateIncidentDescription(type) {
    const descriptions = {
      'Data Breach': 'Unauthorized access detected to sensitive data repository. Initial investigation indicates potential exposure of customer records.',
      'System Outage': 'Critical production system experiencing unexpected downtime. Business operations impacted, emergency response team activated.',
      'Compliance Violation': 'Routine audit identified non-compliance with regulatory requirements. Remediation plan required within 30 days.',
      'Financial Misstatement': 'Error identified in financial reporting process. Correction required before period-end close.',
      'Process Failure': 'Automated process failed to complete successfully. Manual intervention required to restore normal operations.'
    };
    
    return descriptions[type];
  }

  generateRootCause(type) {
    const causes = {
      'Data Breach': ['Weak access controls', 'Unpatched vulnerability', 'Social engineering', 'Insider threat'],
      'System Outage': ['Hardware failure', 'Software bug', 'Configuration error', 'Capacity exceeded'],
      'Compliance Violation': ['Process not followed', 'Training gap', 'System limitation', 'Documentation missing'],
      'Financial Misstatement': ['Manual error', 'System calculation error', 'Process gap', 'Control failure'],
      'Process Failure': ['Code defect', 'Data quality issue', 'Integration failure', 'Resource constraint']
    };
    
    const options = causes[type];
    return options[Math.floor(Math.random() * options.length)];
  }

  generateReporter() {
    const reporters = ['Security Team', 'Internal Audit', 'Business User', 'IT Operations', 'External Auditor', 'Customer', 'Automated Monitoring'];
    return reporters[Math.floor(Math.random() * reporters.length)];
  }

  generateAssignee(category) {
    const assignees = {
      'cybersecurity': ['Security Analyst', 'CISO', 'SOC Team', 'Incident Response Team'],
      'operational': ['Operations Manager', 'IT Support', 'DevOps Team', 'Service Desk'],
      'compliance': ['Compliance Officer', 'Legal Team', 'Internal Audit', 'Risk Manager'],
      'financial': ['CFO', 'Controller', 'Finance Team', 'Accounting'],
      'strategic': ['Executive Team', 'Strategy Team', 'PMO', 'Business Development']
    };
    
    const options = assignees[category];
    return options[Math.floor(Math.random() * options.length)];
  }

  generateOperationalImpact(severity) {
    const impacts = [
      'Minimal - No business impact',
      'Minor - Some inconvenience to users',
      'Moderate - Partial service degradation',
      'Major - Significant service disruption',
      'Critical - Complete service failure'
    ];
    
    return impacts[severity - 1];
  }

  calculatePriority(severity) {
    if (severity >= 4) return 'P1';
    if (severity >= 3) return 'P2';
    if (severity >= 2) return 'P3';
    return 'P4';
  }

  generateLessonsLearned(type) {
    const lessons = {
      'Data Breach': 'Need to strengthen access controls and implement regular security assessments',
      'System Outage': 'Improve monitoring and alerting capabilities, enhance disaster recovery procedures',
      'Compliance Violation': 'Enhance compliance monitoring and training programs',
      'Financial Misstatement': 'Strengthen financial controls and review processes',
      'Process Failure': 'Implement better testing procedures and rollback capabilities'
    };
    
    return lessons[type];
  }

  generatePreventiveMeasures(type) {
    const measures = {
      'Data Breach': ['Implement MFA', 'Regular security audits', 'Enhanced monitoring', 'Security training'],
      'System Outage': ['Redundancy improvements', 'Capacity planning', 'Automated failover', 'Regular DR testing'],
      'Compliance Violation': ['Process automation', 'Regular compliance checks', 'Training programs', 'Policy updates'],
      'Financial Misstatement': ['Automated reconciliation', 'Additional review steps', 'System validations', 'Training'],
      'Process Failure': ['Automated testing', 'Monitoring alerts', 'Process documentation', 'Backup procedures']
    };
    
    return measures[type];
  }

  generateComplianceGap() {
    const gaps = [
      'Control not implemented',
      'Documentation missing',
      'Evidence not retained',
      'Process not formalized',
      'Testing not performed',
      'Monitoring inadequate',
      'Training not provided',
      'Review not conducted'
    ];
    
    return gaps[Math.floor(Math.random() * gaps.length)];
  }

  generateHighLevelGaps(framework) {
    const gaps = {
      'ISO27001': [
        'Information Security Policy needs updating',
        'Risk assessment methodology not fully implemented',
        'Incident response procedures require enhancement',
        'Access control processes need strengthening'
      ],
      'SOC2': [
        'Change management controls need improvement',
        'Logical access reviews not consistently performed',
        'Monitoring and alerting capabilities insufficient',
        'Vendor management processes incomplete'
      ],
      'PCI-DSS': [
        'Network segmentation not properly implemented',
        'Encryption standards need updating',
        'Security testing frequency insufficient',
        'Access logging and monitoring gaps'
      ],
      'GDPR': [
        'Privacy notices require updates',
        'Data retention policies not consistently applied',
        'Consent management process needs improvement',
        'Data subject rights procedures incomplete'
      ],
      'HIPAA': [
        'Access controls need strengthening',
        'Audit logging insufficient',
        'Business associate agreements incomplete',
        'Security awareness training needs improvement'
      ]
    };
    
    return gaps[framework] || ['Generic compliance gaps identified'];
  }

  generateRecommendations(gaps) {
    return gaps.map(gap => ({
      gap: gap,
      recommendation: `Address ${gap.toLowerCase()} through targeted remediation efforts`,
      priority: this.selectWeighted(['High', 'Medium', 'Low'], [0.3, 0.5, 0.2]),
      estimatedEffort: `${Math.floor(Math.random() * 30) + 10} days`,
      estimatedCost: Math.floor(Math.random() * 50000) + 10000
    }));
  }
}

// Export for use in other modules
module.exports = RiskDataSimulator;

// Example usage
if (require.main === module) {
  const simulator = new RiskDataSimulator();
  
  // Generate comprehensive risk data
  console.log('Generating risk management data...');
  
  const riskRegister = simulator.generateRiskRegister(30);
  console.log(`Generated ${riskRegister.risks.length} risks`);
  console.log('Portfolio Summary:', riskRegister.summary);
  
  const incidents = simulator.generateIncidents(50);
  console.log(`\nGenerated ${incidents.length} incidents`);
  
  const compliance = simulator.generateComplianceAssessment('ISO27001');
  console.log(`\nCompliance Assessment: ${compliance.framework}`);
  console.log('Overall Compliance:', compliance.overallCompliance.toFixed(2) + '%');
  console.log('Metrics:', compliance.metrics);
  
  const heatmap = simulator.generateRiskHeatmap(riskRegister.risks);
  console.log('\nRisk Heatmap Summary:', heatmap.summary);
  
  // Save to files for testing
  const fs = require('fs');
  
  fs.writeFileSync('risk-register-sample.json', JSON.stringify(riskRegister, null, 2));
  fs.writeFileSync('incidents-sample.json', JSON.stringify(incidents, null, 2));
  fs.writeFileSync('compliance-assessment-sample.json', JSON.stringify(compliance, null, 2));
  fs.writeFileSync('risk-heatmap-sample.json', JSON.stringify(heatmap, null, 2));
  
  console.log('\nSample data files created successfully!');
}