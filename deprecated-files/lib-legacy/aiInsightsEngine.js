#!/usr/bin/env node

/**
 * AI Insights Engine - Phase 2C Implementation
 * Generates natural language insights from ML predictions and statistical analysis
 */

class AIInsightsEngine {
  constructor() {
    this.insightTemplates = this.initializeInsightTemplates();
    this.industryContext = this.initializeIndustryContext();
    this.riskFactors = this.initializeRiskFactors();
    this.executiveLanguage = this.initializeExecutiveLanguage();
  }

  /**
   * Generate comprehensive AI insights for a tenant
   */
  generateTenantInsights(tenantData, mlPredictions, options = {}) {
    const {
      focusArea = 'overall',
      insightType = 'summary',
      executiveSummary = false,
      includeRecommendations = true,
      includeMetrics = true
    } = options;

    const insights = {
      tenant: tenantData.tenant.name,
      industry: tenantData.tenant.industry,
      generated: new Date().toISOString(),
      focusArea,
      insightType,
      narratives: [],
      keyFindings: [],
      recommendations: [],
      executiveSummary: null,
      confidence: 0,
      riskLevel: 'medium'
    };

    // Generate narrative insights based on focus area
    switch (focusArea) {
      case 'overall':
        insights.narratives = this.generateOverallInsights(tenantData, mlPredictions);
        break;
      case 'risks':
        insights.narratives = this.generateRiskInsights(tenantData, mlPredictions);
        break;
      case 'controls':
        insights.narratives = this.generateControlInsights(tenantData, mlPredictions);
        break;
      case 'compliance':
        insights.narratives = this.generateComplianceInsights(tenantData, mlPredictions);
        break;
      case 'incidents':
        insights.narratives = this.generateIncidentInsights(tenantData, mlPredictions);
        break;
    }

    // Extract key findings
    insights.keyFindings = this.extractKeyFindings(tenantData, mlPredictions, insights.narratives);

    // Generate recommendations
    if (includeRecommendations) {
      insights.recommendations = this.generateRecommendations(tenantData, mlPredictions, insights.keyFindings);
    }

    // Generate executive summary
    if (executiveSummary) {
      insights.executiveSummary = this.generateExecutiveSummary(insights);
    }

    // Calculate overall confidence and risk level
    insights.confidence = this.calculateInsightConfidence(tenantData, mlPredictions);
    insights.riskLevel = this.assessOverallRiskLevel(tenantData, mlPredictions);

    return insights;
  }

  /**
   * Generate overall organizational insights
   */
  generateOverallInsights(tenantData, mlPredictions) {
    const narratives = [];
    const { tenant, current_state } = tenantData;
    
    // Portfolio overview narrative
    const portfolioNarrative = this.generatePortfolioNarrative(current_state, tenant.industry);
    narratives.push(portfolioNarrative);

    // Trend analysis narrative
    if (mlPredictions.patterns) {
      const trendNarrative = this.generateTrendNarrative(mlPredictions.patterns, tenant.industry);
      narratives.push(trendNarrative);
    }

    // Predictive insights narrative
    if (mlPredictions.forecasts) {
      const predictiveNarrative = this.generatePredictiveNarrative(mlPredictions.forecasts, tenant.industry);
      narratives.push(predictiveNarrative);
    }

    // Performance narrative
    const performanceNarrative = this.generatePerformanceNarrative(current_state, tenant.industry);
    narratives.push(performanceNarrative);

    return narratives;
  }

  /**
   * Generate risk-focused insights
   */
  generateRiskInsights(tenantData, mlPredictions) {
    const narratives = [];
    const { current_state, tenant } = tenantData;

    current_state.risks.forEach(risk => {
      const riskNarrative = this.generateIndividualRiskNarrative(risk, tenant.industry, mlPredictions);
      narratives.push(riskNarrative);
    });

    // Risk correlation insights
    if (current_state.risks.length > 1) {
      const correlationNarrative = this.generateRiskCorrelationNarrative(current_state.risks, tenant.industry);
      narratives.push(correlationNarrative);
    }

    return narratives;
  }

  /**
   * Generate performance narrative
   */
  generatePerformanceNarrative(currentState, industry) {
    const controlEffectiveness = currentState.summary.control_effectiveness;
    const recentIncidents = currentState.summary.recent_incidents;
    const avgRiskScore = currentState.summary.avg_risk_score;
    
    let narrative = `Organizational performance metrics indicate `;
    
    // Control performance assessment
    if (controlEffectiveness > 0.9) {
      narrative += `exceptional control performance with ${(controlEffectiveness * 100).toFixed(1)}% average effectiveness, `;
    } else if (controlEffectiveness > 0.8) {
      narrative += `strong control performance at ${(controlEffectiveness * 100).toFixed(1)}% effectiveness, `;
    } else if (controlEffectiveness > 0.7) {
      narrative += `adequate control performance at ${(controlEffectiveness * 100).toFixed(1)}% effectiveness, `;
    } else {
      narrative += `concerning control performance at ${(controlEffectiveness * 100).toFixed(1)}% effectiveness requiring attention, `;
    }
    
    // Incident rate assessment
    const industryBenchmark = this.getIndustryBenchmark(industry);
    if (recentIncidents < industryBenchmark.incidentRate * 0.8) {
      narrative += `with below-average incident rates (${recentIncidents} vs industry average ${industryBenchmark.incidentRate}). `;
    } else if (recentIncidents > industryBenchmark.incidentRate * 1.2) {
      narrative += `with elevated incident rates (${recentIncidents} vs industry average ${industryBenchmark.incidentRate}) requiring investigation. `;
    } else {
      narrative += `with incident rates aligned to industry norms (${recentIncidents} vs ${industryBenchmark.incidentRate} average). `;
    }
    
    // Overall performance summary
    if (controlEffectiveness > 0.85 && recentIncidents < industryBenchmark.incidentRate) {
      narrative += `This combination demonstrates a mature risk management framework with effective operational controls.`;
    } else if (controlEffectiveness < 0.75 || recentIncidents > industryBenchmark.incidentRate * 1.3) {
      narrative += `Performance indicators suggest the need for enhanced risk management strategies and control optimization.`;
    } else {
      narrative += `Overall performance reflects standard risk management capabilities with opportunities for targeted improvements.`;
    }

    return {
      type: 'performance_analysis',
      title: 'Operational Performance Assessment',
      content: narrative,
      confidence: 0.88,
      severity: controlEffectiveness < 0.75 ? 'medium' : 'low',
      metrics: {
        controlEffectiveness,
        recentIncidents,
        industryComparison: recentIncidents / industryBenchmark.incidentRate
      }
    };
  }

  /**
   * Generate control-focused insights
   */
  generateControlInsights(tenantData, mlPredictions) {
    const narratives = [];
    const { current_state, tenant } = tenantData;

    // Control effectiveness narrative
    const effectivenessNarrative = this.generateControlEffectivenessNarrative(current_state.controls, tenant.industry);
    narratives.push(effectivenessNarrative);

    // Control failure predictions
    if (mlPredictions.controlFailures) {
      const failureNarrative = this.generateControlFailureNarrative(mlPredictions.controlFailures, tenant.industry);
      narratives.push(failureNarrative);
    }

    // Control optimization narrative
    const optimizationNarrative = this.generateControlOptimizationNarrative(current_state.controls, tenant.industry);
    narratives.push(optimizationNarrative);

    return narratives;
  }

  /**
   * Generate portfolio narrative
   */
  generatePortfolioNarrative(currentState, industry) {
    const avgRiskScore = currentState.summary.avg_risk_score;
    const criticalRisks = currentState.summary.critical_risks;
    const totalRisks = currentState.summary.total_risks;
    
    const industryBenchmark = this.getIndustryBenchmark(industry);
    const relativePerformance = avgRiskScore - industryBenchmark.avgRisk;
    
    let narrative = `Your ${industry.toLowerCase()} organization maintains a risk portfolio with an average severity of ${avgRiskScore.toFixed(1)} out of 10. `;
    
    if (relativePerformance > 0.5) {
      narrative += `This is ${relativePerformance.toFixed(1)} points above the industry average of ${industryBenchmark.avgRisk}, indicating elevated risk exposure requiring immediate attention. `;
    } else if (relativePerformance < -0.5) {
      narrative += `This is ${Math.abs(relativePerformance).toFixed(1)} points below the industry average of ${industryBenchmark.avgRisk}, reflecting strong risk management practices. `;
    } else {
      narrative += `This aligns closely with the industry average of ${industryBenchmark.avgRisk}, indicating typical risk exposure for your sector. `;
    }

    const criticalRatio = criticalRisks / totalRisks;
    if (criticalRatio > 0.3) {
      narrative += `With ${criticalRisks} critical risks out of ${totalRisks} total risks (${(criticalRatio * 100).toFixed(0)}%), your organization faces a concerning concentration of high-severity exposures that demand executive attention.`;
    } else if (criticalRatio > 0.15) {
      narrative += `The presence of ${criticalRisks} critical risks represents ${(criticalRatio * 100).toFixed(0)}% of your portfolio, requiring focused mitigation efforts.`;
    } else {
      narrative += `Your portfolio shows good risk distribution with only ${criticalRisks} critical risks (${(criticalRatio * 100).toFixed(0)}% of total), indicating effective risk management.`;
    }

    return {
      type: 'portfolio_overview',
      title: 'Risk Portfolio Analysis',
      content: narrative,
      confidence: 0.92,
      severity: criticalRatio > 0.3 ? 'high' : criticalRatio > 0.15 ? 'medium' : 'low',
      metrics: {
        avgRiskScore,
        criticalRiskRatio: criticalRatio,
        industryComparison: relativePerformance
      }
    };
  }

  /**
   * Generate trend narrative
   */
  generateTrendNarrative(patterns, industry) {
    let narrative = "Analysis of your risk patterns reveals ";
    const trendInsights = [];

    if (patterns.seasonal && patterns.seasonal.detected) {
      const seasonalInsight = this.generateSeasonalInsight(patterns.seasonal, industry);
      trendInsights.push(seasonalInsight);
    }

    if (patterns.trending && Math.abs(patterns.trending.slope) > 0.001) {
      const trendInsight = this.generateTrendInsight(patterns.trending, industry);
      trendInsights.push(trendInsight);
    }

    if (patterns.cyclical && patterns.cyclical.detected) {
      const cyclicalInsight = this.generateCyclicalInsight(patterns.cyclical, industry);
      trendInsights.push(cyclicalInsight);
    }

    if (trendInsights.length === 0) {
      narrative += "stable risk patterns with minimal volatility, suggesting well-controlled operational environments and effective risk management processes.";
    } else {
      narrative += trendInsights.join(", and ") + ".";
    }

    narrative += ` These patterns provide valuable insights for proactive risk management and resource allocation optimization.`;

    return {
      type: 'trend_analysis',
      title: 'Risk Pattern Intelligence',
      content: narrative,
      confidence: 0.87,
      severity: trendInsights.length > 2 ? 'medium' : 'low',
      patterns: patterns
    };
  }

  /**
   * Generate predictive narrative
   */
  generatePredictiveNarrative(forecasts, industry) {
    let narrative = "Predictive analytics indicate ";
    
    const riskForecasts = forecasts.risks || [];
    const increasingRisks = riskForecasts.filter(f => f.trend === 'increasing').length;
    const decreasingRisks = riskForecasts.filter(f => f.trend === 'decreasing').length;
    const stableRisks = riskForecasts.filter(f => f.trend === 'stable').length;

    if (increasingRisks > decreasingRisks) {
      narrative += `an emerging risk elevation pattern, with ${increasingRisks} risks projected to increase over the next 30 days. `;
      narrative += `This upward trajectory requires proactive intervention to prevent threshold breaches and potential incident escalation. `;
    } else if (decreasingRisks > increasingRisks) {
      narrative += `positive risk reduction momentum, with ${decreasingRisks} risks forecasted to decrease. `;
      narrative += `This downward trajectory reflects effective risk mitigation strategies and improving control performance. `;
    } else {
      narrative += `balanced risk dynamics with ${stableRisks} risks maintaining stable trajectories. `;
      narrative += `This equilibrium suggests well-calibrated risk management processes operating within acceptable parameters. `;
    }

    // Add industry-specific context
    const industryInsight = this.getIndustryForecastContext(industry, { increasingRisks, decreasingRisks, stableRisks });
    narrative += industryInsight;

    return {
      type: 'predictive_analysis',
      title: 'Risk Trajectory Forecasting',
      content: narrative,
      confidence: 0.89,
      severity: increasingRisks > decreasingRisks ? 'medium' : 'low',
      forecasts: { increasingRisks, decreasingRisks, stableRisks }
    };
  }

  /**
   * Generate individual risk narrative
   */
  generateIndividualRiskNarrative(risk, industry, mlPredictions) {
    const riskContext = this.getRiskContext(risk.title, industry);
    const severityDescriptor = this.getSeverityDescriptor(risk.severity, risk.score);
    
    let narrative = `${risk.title} presents a ${severityDescriptor} exposure with a current severity score of ${risk.score}/10. `;
    
    // Add trend analysis
    if (risk.trend !== undefined) {
      const trendDescriptor = this.getTrendDescriptor(risk.trend);
      narrative += `Recent analysis shows ${trendDescriptor}, `;
    }

    // Add industry context
    narrative += riskContext.description + " ";

    // Add volatility insight
    if (risk.volatility > 1.0) {
      narrative += `The risk exhibits high volatility (${risk.volatility.toFixed(2)}), indicating unpredictable fluctuations that require enhanced monitoring and rapid response capabilities. `;
    } else if (risk.volatility > 0.5) {
      narrative += `Moderate volatility patterns suggest the need for regular assessment and adaptive risk controls. `;
    } else {
      narrative += `Low volatility indicates stable risk behavior, allowing for standard monitoring protocols. `;
    }

    // Add predictive insight
    if (mlPredictions.riskForecasts && mlPredictions.riskForecasts[risk.id]) {
      const forecast = mlPredictions.riskForecasts[risk.id];
      narrative += this.generateRiskForecastInsight(forecast);
    }

    return {
      type: 'individual_risk',
      title: risk.title,
      content: narrative,
      confidence: 0.85,
      severity: risk.severity.toLowerCase(),
      riskId: risk.id,
      metrics: {
        score: risk.score,
        trend: risk.trend,
        volatility: risk.volatility
      }
    };
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(insights) {
    const { tenant, industry, narratives, keyFindings, recommendations, riskLevel } = insights;
    
    let summary = `**Executive Summary - ${tenant}**\n\n`;
    
    // Risk level assessment
    const riskDescriptor = this.getRiskLevelDescriptor(riskLevel);
    summary += `Current organizational risk posture: **${riskDescriptor}**\n\n`;

    // Key highlights (top 3 findings)
    summary += `**Key Findings:**\n`;
    keyFindings.slice(0, 3).forEach((finding, index) => {
      summary += `${index + 1}. ${finding.summary}\n`;
    });
    summary += `\n`;

    // Priority recommendations (top 3)
    summary += `**Priority Actions:**\n`;
    recommendations.slice(0, 3).forEach((rec, index) => {
      summary += `${index + 1}. ${rec.action} (${rec.priority} priority)\n`;
    });
    summary += `\n`;

    // Industry context
    const industryContext = this.getIndustryExecutiveContext(industry, insights);
    summary += `**Industry Context:** ${industryContext}\n\n`;

    // Confidence and next review
    summary += `*Analysis confidence: ${insights.confidence}% | Recommended review: ${this.getReviewFrequency(riskLevel)}*`;

    return {
      content: summary,
      generated: new Date().toISOString(),
      confidence: insights.confidence,
      executiveLevel: true
    };
  }

  /**
   * Extract key findings from narratives
   */
  extractKeyFindings(tenantData, mlPredictions, narratives) {
    const findings = [];

    narratives.forEach(narrative => {
      if (narrative.severity === 'high' || narrative.confidence > 0.9) {
        findings.push({
          type: narrative.type,
          summary: this.extractKeyPoint(narrative.content),
          severity: narrative.severity,
          confidence: narrative.confidence,
          source: narrative.title
        });
      }
    });

    // Sort by severity and confidence
    return findings.sort((a, b) => {
      const severityWeight = { high: 3, medium: 2, low: 1 };
      const aWeight = severityWeight[a.severity] * a.confidence;
      const bWeight = severityWeight[b.severity] * b.confidence;
      return bWeight - aWeight;
    });
  }

  /**
   * Generate contextual recommendations
   */
  generateRecommendations(tenantData, mlPredictions, keyFindings) {
    const recommendations = [];
    const { current_state, tenant } = tenantData;

    // Risk-based recommendations
    current_state.risks.forEach(risk => {
      if (risk.severity === 'Critical' || risk.score > 8.0) {
        recommendations.push({
          action: `Implement immediate risk mitigation for ${risk.title}`,
          priority: 'urgent',
          rationale: `High severity score (${risk.score}/10) requires executive attention`,
          timeline: '7-14 days',
          resources: 'Risk management team, senior leadership',
          type: 'risk_mitigation'
        });
      }
    });

    // Control-based recommendations
    const ineffectiveControls = current_state.controls.filter(c => c.effectiveness < 0.8);
    if (ineffectiveControls.length > 0) {
      recommendations.push({
        action: `Review and enhance ${ineffectiveControls.length} underperforming controls`,
        priority: 'high',
        rationale: `Control effectiveness below 80% threshold`,
        timeline: '30-45 days',
        resources: 'Control owners, audit team',
        type: 'control_enhancement'
      });
    }

    // Pattern-based recommendations
    if (mlPredictions.patterns && mlPredictions.patterns.seasonal) {
      recommendations.push({
        action: 'Implement seasonal risk management protocols',
        priority: 'medium',
        rationale: 'Seasonal patterns detected requiring proactive preparation',
        timeline: '60-90 days',
        resources: 'Risk analytics team',
        type: 'process_improvement'
      });
    }

    // Industry-specific recommendations
    const industryRecs = this.getIndustryRecommendations(tenant.industry, current_state);
    recommendations.push(...industryRecs);

    return recommendations.slice(0, 8); // Limit to top 8 recommendations
  }

  generateControlOptimizationNarrative(controls, industry) {
    const ineffectiveControls = controls.filter(c => c.effectiveness < 0.8);
    const highPerformingControls = controls.filter(c => c.effectiveness > 0.9);
    
    let narrative = `Control optimization analysis reveals `;
    
    if (ineffectiveControls.length > 0) {
      narrative += `${ineffectiveControls.length} controls operating below the 80% effectiveness threshold, `;
      narrative += `presenting opportunities for targeted improvements. `;
    }
    
    if (highPerformingControls.length > 0) {
      narrative += `${highPerformingControls.length} controls demonstrating exceptional performance above 90% effectiveness, `;
      narrative += `which can serve as benchmarks for optimization efforts. `;
    }
    
    // Industry-specific optimization insights
    if (industry === 'Financial Services') {
      narrative += `For financial services organizations, focusing on regulatory compliance controls and fraud detection mechanisms typically yields the highest ROI on optimization investments.`;
    } else if (industry === 'Healthcare') {
      narrative += `Healthcare organizations should prioritize patient data protection and HIPAA compliance controls for maximum operational impact.`;
    } else if (industry === 'Manufacturing') {
      narrative += `Manufacturing environments benefit most from optimizing safety controls and supply chain risk management mechanisms.`;
    } else {
      narrative += `Cross-industry best practices suggest focusing optimization efforts on controls with the highest business impact and lowest implementation complexity.`;
    }

    return {
      type: 'control_optimization',
      title: 'Control Optimization Strategy',
      content: narrative,
      confidence: 0.84,
      severity: ineffectiveControls.length > controls.length * 0.3 ? 'medium' : 'low',
      metrics: {
        ineffectiveCount: ineffectiveControls.length,
        highPerformingCount: highPerformingControls.length,
        optimizationPotential: ineffectiveControls.length / controls.length
      }
    };
  }

  generateControlEffectivenessNarrative(controls, industry) {
    const avgEffectiveness = controls.reduce((sum, c) => sum + c.effectiveness, 0) / controls.length;
    const underperformingControls = controls.filter(c => c.effectiveness < 0.7);
    
    let narrative = `Control effectiveness analysis shows an average performance of ${(avgEffectiveness * 100).toFixed(1)}% across ${controls.length} implemented controls. `;
    
    const industryBenchmark = this.getIndustryBenchmark(industry);
    const relativePerformance = avgEffectiveness - industryBenchmark.controlEffectiveness;
    
    if (relativePerformance > 0.05) {
      narrative += `This exceeds the ${industry.toLowerCase()} industry benchmark of ${(industryBenchmark.controlEffectiveness * 100).toFixed(1)}% by ${(relativePerformance * 100).toFixed(1)} percentage points, `;
      narrative += `indicating superior control implementation and management practices. `;
    } else if (relativePerformance < -0.05) {
      narrative += `This falls short of the ${industry.toLowerCase()} industry benchmark of ${(industryBenchmark.controlEffectiveness * 100).toFixed(1)}% by ${(Math.abs(relativePerformance) * 100).toFixed(1)} percentage points, `;
      narrative += `suggesting opportunities for control enhancement and optimization. `;
    } else {
      narrative += `This aligns with the ${industry.toLowerCase()} industry benchmark of ${(industryBenchmark.controlEffectiveness * 100).toFixed(1)}%, `;
      narrative += `demonstrating competitive control performance. `;
    }
    
    if (underperformingControls.length > 0) {
      narrative += `${underperformingControls.length} controls are operating below 70% effectiveness and require immediate attention to prevent potential control failures.`;
    } else {
      narrative += `All controls are operating above minimum effectiveness thresholds, indicating a well-managed control environment.`;
    }

    return {
      type: 'control_effectiveness',
      title: 'Control Effectiveness Assessment',
      content: narrative,
      confidence: 0.91,
      severity: underperformingControls.length > 0 ? 'medium' : 'low',
      metrics: {
        avgEffectiveness,
        industryComparison: relativePerformance,
        underperformingCount: underperformingControls.length
      }
    };
  }

  generateControlFailureNarrative(controlFailures, industry) {
    const highRiskControls = controlFailures.filter(cf => cf.riskLevel === 'high');
    const avgFailureProbability = controlFailures.reduce((sum, cf) => sum + cf.failureProbability, 0) / controlFailures.length;
    
    let narrative = `Predictive control failure analysis indicates an average failure probability of ${(avgFailureProbability * 100).toFixed(1)}% across monitored controls. `;
    
    if (highRiskControls.length > 0) {
      narrative += `${highRiskControls.length} controls are classified as high failure risk, requiring immediate preventive action. `;
      narrative += `These controls represent potential single points of failure that could significantly impact operational resilience. `;
    } else {
      narrative += `No controls are currently classified as high failure risk, indicating stable control performance. `;
    }
    
    // Industry context for control failures
    if (industry === 'Financial Services') {
      narrative += `In financial services, control failures typically have regulatory implications and customer impact, making proactive maintenance critical.`;
    } else if (industry === 'Healthcare') {
      narrative += `Healthcare control failures can affect patient safety and HIPAA compliance, requiring immediate escalation protocols.`;
    } else {
      narrative += `Control failure prevention through predictive maintenance can reduce operational disruptions and compliance risks.`;
    }

    return {
      type: 'control_failure_prediction',
      title: 'Control Failure Risk Assessment',
      content: narrative,
      confidence: 0.86,
      severity: highRiskControls.length > 0 ? 'high' : avgFailureProbability > 0.3 ? 'medium' : 'low',
      metrics: {
        avgFailureProbability,
        highRiskCount: highRiskControls.length,
        totalControls: controlFailures.length
      }
    };
  }

  generateRiskCorrelationNarrative(risks, industry) {
    const criticalRisks = risks.filter(r => r.severity === 'Critical').length;
    const highRisks = risks.filter(r => r.severity === 'High').length;
    const trendingUpRisks = risks.filter(r => r.trend > 0.1).length;
    
    let narrative = `Risk correlation analysis across ${risks.length} monitored risks reveals `;
    
    if (trendingUpRisks > 1) {
      narrative += `${trendingUpRisks} risks exhibiting synchronized upward trends, suggesting systemic factors affecting multiple risk domains. `;
      narrative += `This correlation pattern indicates the need for holistic risk management approaches rather than isolated control measures. `;
    } else {
      narrative += `limited correlation between risk movements, indicating independent risk factors and effective risk segmentation. `;
    }
    
    const concentrationRatio = (criticalRisks + highRisks) / risks.length;
    if (concentrationRatio > 0.5) {
      narrative += `High concentration of critical and high-severity risks (${(concentrationRatio * 100).toFixed(0)}%) suggests potential cascade effects requiring integrated mitigation strategies.`;
    } else {
      narrative += `Balanced risk distribution minimizes correlation-driven cascade effects and supports resilient risk management.`;
    }

    return {
      type: 'risk_correlation',
      title: 'Risk Interdependency Analysis',
      content: narrative,
      confidence: 0.82,
      severity: concentrationRatio > 0.5 ? 'medium' : 'low',
      metrics: {
        correlatedRisks: trendingUpRisks,
        concentrationRatio,
        criticalCount: criticalRisks
      }
    };
  }

  generateComplianceInsights(tenantData, mlPredictions) {
    const narratives = [];
    const { current_state, tenant } = tenantData;
    
    // Basic compliance narrative based on risk patterns
    const complianceRisks = current_state.risks.filter(r => 
      r.title.toLowerCase().includes('compliance') || 
      r.title.toLowerCase().includes('regulatory') ||
      r.title.toLowerCase().includes('hipaa')
    );
    
    let narrative = `Compliance risk assessment identifies ${complianceRisks.length} regulatory risks requiring ongoing monitoring. `;
    
    if (complianceRisks.length > 0) {
      const avgComplianceScore = complianceRisks.reduce((sum, r) => sum + r.score, 0) / complianceRisks.length;
      narrative += `The average compliance risk severity of ${avgComplianceScore.toFixed(1)}/10 indicates ${
        avgComplianceScore > 7 ? 'elevated' : avgComplianceScore > 5 ? 'moderate' : 'manageable'
      } regulatory exposure. `;
      
      narrative += `Industry-specific compliance requirements for ${tenant.industry.toLowerCase()} demand continuous monitoring and proactive risk mitigation strategies.`;
    } else {
      narrative += `No specific compliance risks identified in current risk portfolio, suggesting either effective compliance management or potential gaps in risk identification.`;
    }
    
    narratives.push({
      type: 'compliance_assessment',
      title: 'Regulatory Compliance Analysis',
      content: narrative,
      confidence: 0.85,
      severity: complianceRisks.length > 0 && complianceRisks.some(r => r.score > 7) ? 'medium' : 'low',
      metrics: {
        complianceRiskCount: complianceRisks.length,
        avgScore: complianceRisks.length > 0 ? complianceRisks.reduce((sum, r) => sum + r.score, 0) / complianceRisks.length : 0
      }
    });
    
    return narratives;
  }

  generateIncidentInsights(tenantData, mlPredictions) {
    const narratives = [];
    const { current_state, tenant } = tenantData;
    
    const recentIncidents = current_state.summary.recent_incidents;
    const industryBenchmark = this.getIndustryBenchmark(tenant.industry);
    
    let narrative = `Incident analysis reveals ${recentIncidents} reported incidents over the past 90 days. `;
    
    if (recentIncidents > industryBenchmark.incidentRate * 1.5) {
      narrative += `This significantly exceeds the ${tenant.industry.toLowerCase()} industry average of ${industryBenchmark.incidentRate} incidents, `;
      narrative += `indicating potential systemic issues requiring root cause analysis and enhanced preventive controls. `;
    } else if (recentIncidents < industryBenchmark.incidentRate * 0.5) {
      narrative += `This is well below the ${tenant.industry.toLowerCase()} industry average of ${industryBenchmark.incidentRate} incidents, `;
      narrative += `demonstrating effective incident prevention and risk mitigation strategies. `;
    } else {
      narrative += `This aligns with typical ${tenant.industry.toLowerCase()} incident patterns, `;
      narrative += `suggesting standard operational risk exposure and management effectiveness. `;
    }
    
    // Add predictive insight
    if (recentIncidents > 0) {
      narrative += `Trend analysis suggests monitoring control effectiveness and implementing targeted risk reduction measures to prevent incident escalation.`;
    } else {
      narrative += `The absence of recent incidents reflects strong operational controls, though continued vigilance remains essential.`;
    }
    
    narratives.push({
      type: 'incident_analysis',
      title: 'Incident Pattern Assessment',
      content: narrative,
      confidence: 0.89,
      severity: recentIncidents > industryBenchmark.incidentRate * 1.5 ? 'high' : 'low',
      metrics: {
        recentIncidents,
        industryAverage: industryBenchmark.incidentRate,
        relativePerformance: recentIncidents / industryBenchmark.incidentRate
      }
    });
    
    return narratives;
  }

  // Helper methods for context and templates
  initializeInsightTemplates() {
    return {
      riskElevation: "indicates heightened risk exposure requiring immediate attention",
      riskReduction: "demonstrates effective risk mitigation strategies yielding positive outcomes",
      trendPositive: "shows improving trajectory with declining risk indicators",
      trendNegative: "reveals concerning upward risk progression demanding intervention",
      seasonalPattern: "exhibits predictable seasonal variations enabling proactive planning",
      volatilityHigh: "demonstrates significant unpredictability requiring enhanced monitoring",
      controlEffective: "maintains strong defensive posture with high effectiveness ratings",
      controlWeak: "shows concerning gaps in protective capabilities"
    };
  }

  initializeIndustryContext() {
    return {
      'Financial Services': {
        avgRisk: 6.8,
        keyRisks: ['Credit Risk', 'Regulatory Compliance', 'Data Security'],
        seasonality: 'Q4 elevated due to year-end reporting',
        benchmarks: { controlEffectiveness: 0.85, incidentRate: 2.1 }
      },
      'Healthcare': {
        avgRisk: 7.2,
        keyRisks: ['Patient Safety', 'HIPAA Compliance', 'Data Privacy'],
        seasonality: 'Flu season impacts operational risk',
        benchmarks: { controlEffectiveness: 0.88, incidentRate: 1.8 }
      },
      'Manufacturing': {
        avgRisk: 6.5,
        keyRisks: ['Supply Chain', 'Environmental', 'Safety'],
        seasonality: 'Summer peaks due to equipment stress',
        benchmarks: { controlEffectiveness: 0.82, incidentRate: 2.4 }
      }
    };
  }

  initializeRiskFactors() {
    return {
      'Credit Risk Exposure': {
        description: 'This exposure is typical for financial institutions and requires careful portfolio monitoring.',
        factors: ['economic conditions', 'borrower profiles', 'market volatility'],
        mitigation: 'diversification and enhanced underwriting'
      },
      'Data Breach Risk': {
        description: 'Cybersecurity threats continue to evolve, making this a persistent concern across all industries.',
        factors: ['threat landscape', 'system vulnerabilities', 'user behavior'],
        mitigation: 'layered security controls and user training'
      },
      'Regulatory Compliance Gap': {
        description: 'Regulatory environments are increasingly complex, requiring specialized expertise and continuous monitoring.',
        factors: ['regulatory changes', 'process adherence', 'documentation quality'],
        mitigation: 'regular compliance assessments and training'
      }
    };
  }

  initializeExecutiveLanguage() {
    return {
      severity: {
        low: 'manageable',
        medium: 'notable',
        high: 'significant',
        critical: 'urgent'
      },
      trend: {
        positive: 'improving favorably',
        negative: 'requiring immediate attention',
        stable: 'maintaining acceptable levels'
      },
      confidence: {
        high: 'with high analytical confidence',
        medium: 'based on current data trends',
        low: 'requiring additional monitoring'
      }
    };
  }

  // Utility methods
  getIndustryBenchmark(industry) {
    return this.industryContext[industry] || { avgRisk: 6.5, controlEffectiveness: 0.82 };
  }

  getSeverityDescriptor(severity, score) {
    if (score >= 9) return 'critical business threat';
    if (score >= 7) return 'significant operational concern';
    if (score >= 5) return 'moderate risk exposure';
    return 'manageable operational consideration';
  }

  getTrendDescriptor(trend) {
    if (trend > 0.1) return 'an increasing risk trajectory over recent periods';
    if (trend < -0.1) return 'a declining risk profile indicating effective mitigation';
    return 'stable risk levels within normal operating parameters';
  }

  getRiskContext(riskTitle, industry) {
    return this.riskFactors[riskTitle] || {
      description: 'This risk requires standard monitoring and mitigation protocols.',
      factors: ['operational factors'],
      mitigation: 'standard risk controls'
    };
  }

  generateSeasonalInsight(seasonal, industry) {
    const periodDesc = seasonal.period === 365 ? 'annual' : 
                      seasonal.period === 90 ? 'quarterly' : 
                      seasonal.period === 30 ? 'monthly' : 'cyclical';
    return `${periodDesc} seasonal patterns with ${(seasonal.strength * 100).toFixed(0)}% strength`;
  }

  generateTrendInsight(trending, industry) {
    const direction = trending.direction === 'increasing' ? 'upward' : 'downward';
    return `a ${direction} trend with ${(trending.rSquared * 100).toFixed(0)}% statistical confidence`;
  }

  generateCyclicalInsight(cyclical, industry) {
    return `${cyclical.period}-day cyclical patterns indicating predictable risk fluctuations`;
  }

  getIndustryForecastContext(industry, forecasts) {
    const context = this.industryContext[industry];
    if (!context) return 'These patterns align with typical organizational risk dynamics.';
    
    return `For ${industry.toLowerCase()} organizations, this forecast profile ${
      forecasts.increasingRisks > 2 ? 'suggests heightened attention to sector-specific risk factors' :
      'remains within expected industry parameters'
    }.`;
  }

  generateRiskForecastInsight(forecast) {
    return `Machine learning models predict ${forecast.direction} with ${forecast.confidence}% confidence over the next 30 days. `;
  }

  getRiskLevelDescriptor(riskLevel) {
    const descriptors = {
      low: 'Well-Controlled Risk Environment',
      medium: 'Managed Risk Exposure',
      high: 'Elevated Risk Requiring Attention',
      critical: 'Critical Risk Demanding Immediate Action'
    };
    return descriptors[riskLevel] || 'Moderate Risk Profile';
  }

  getIndustryExecutiveContext(industry, insights) {
    const context = this.industryContext[industry];
    if (!context) return 'Risk profile aligns with general industry standards.';
    
    return `Relative to ${industry.toLowerCase()} peers, your organization demonstrates ${
      insights.riskLevel === 'low' ? 'superior' : 
      insights.riskLevel === 'medium' ? 'competitive' : 'challenged'
    } risk management performance.`;
  }

  getReviewFrequency(riskLevel) {
    const frequencies = {
      low: 'Quarterly',
      medium: 'Monthly', 
      high: 'Bi-weekly',
      critical: 'Weekly'
    };
    return frequencies[riskLevel] || 'Monthly';
  }

  getIndustryRecommendations(industry, currentState) {
    const recommendations = [];
    const context = this.industryContext[industry];
    
    if (context) {
      recommendations.push({
        action: `Benchmark against ${industry.toLowerCase()} industry standards`,
        priority: 'medium',
        rationale: `Industry-specific compliance and best practices alignment`,
        timeline: '90 days',
        resources: 'Benchmarking team, external consultants',
        type: 'industry_alignment'
      });
    }
    
    return recommendations;
  }

  extractKeyPoint(content) {
    // Extract the first sentence as the key point
    const sentences = content.split(/[.!?]+/);
    return sentences[0].trim() + '.';
  }

  calculateInsightConfidence(tenantData, mlPredictions) {
    // Base confidence on data quality and ML model performance
    let confidence = 85; // Base confidence
    
    // Adjust based on data completeness
    if (tenantData.historical && Object.keys(tenantData.historical.risks).length > 2) {
      confidence += 5;
    }
    
    // Adjust based on ML predictions availability
    if (mlPredictions.forecasts && mlPredictions.patterns) {
      confidence += 8;
    }
    
    return Math.min(95, confidence);
  }

  assessOverallRiskLevel(tenantData, mlPredictions) {
    const avgRisk = tenantData.current_state.summary.avg_risk_score;
    const criticalRatio = tenantData.current_state.summary.critical_risks / tenantData.current_state.summary.total_risks;
    
    if (avgRisk >= 8.0 || criticalRatio > 0.4) return 'critical';
    if (avgRisk >= 6.5 || criticalRatio > 0.25) return 'high';
    if (avgRisk >= 4.5 || criticalRatio > 0.1) return 'medium';
    return 'low';
  }
}

export { AIInsightsEngine };