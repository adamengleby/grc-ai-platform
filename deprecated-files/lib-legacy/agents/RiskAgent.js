/**
 * Risk Analysis Agent
 * Specialized in risk assessment, forecasting, and pattern analysis
 */

import { GRCAgent } from './AgentBase.js';

export class RiskAnalysisAgent extends GRCAgent {
  constructor(llmClient, mcpClient, config = {}) {
    super('RiskAnalyst', 'risk analysis', llmClient, mcpClient, {
      maxSteps: 6,
      timeoutMs: 90000, // Longer timeout for risk modeling
      ...config
    });
    
    this.riskCategories = ['Financial', 'Operational', 'Strategic', 'Compliance', 'Reputational'];
    this.analysisDepth = config.analysisDepth || 'comprehensive'; // basic, standard, comprehensive
  }

  /**
   * Override planning for risk-specific workflow
   */
  async planApproach(task, context) {
    const { focusArea, insightType } = task;
    const steps = [];

    // Step 1: Always start with current risk landscape
    steps.push({
      action: 'useTool',
      tool: 'get_risk_summary',
      params: this.prepareToolParams({ name: 'get_risk_summary' }, context),
      purpose: 'Assess current risk landscape'
    });

    // Step 2: Analyze historical patterns if available
    if (context.tenantData.riskData?.risks?.length > 0) {
      steps.push({
        action: 'useTool',
        tool: 'analyze_risk_patterns',
        params: {
          tenant_id: context.tenantId,
          analysis_period: 365,
          pattern_types: ['seasonal', 'trending', 'cyclical'],
          significance_level: 0.05
        },
        purpose: 'Identify risk patterns and trends'
      });
    }

    // Step 3: Forward-looking analysis for predictions
    if (insightType === 'predictions' || insightType === 'summary') {
      steps.push({
        action: 'useTool',
        tool: 'forecast_risk_trajectory',
        params: {
          tenant_id: context.tenantId,
          forecast_horizon: 90,
          confidence_interval: 0.95,
          risk_categories: this.riskCategories
        },
        purpose: 'Generate risk forecasts and trajectories'
      });
    }

    // Step 4: Anomaly detection for early warning
    if (this.analysisDepth === 'comprehensive') {
      steps.push({
        action: 'useTool',
        tool: 'detect_anomalies',
        params: {
          tenant_id: context.tenantId,
          detection_methods: ['statistical', 'ml_based'],
          sensitivity: 0.8,
          time_window: 30
        },
        purpose: 'Detect risk anomalies and emerging threats'
      });
    }

    // Step 5: Comprehensive data analysis for context
    steps.push({
      action: 'useTool',
      tool: 'analyze_grc_data',
      params: {
        tenant_id: context.tenantId,
        query: this.buildRiskQuery(task, context),
        include_history: true,
        include_predictions: true
      },
      purpose: 'Comprehensive risk data analysis'
    });

    return {
      steps,
      reasoning: `Risk analysis workflow for ${focusArea} focus with ${insightType} insights`,
      estimatedDuration: steps.length * 7000, // Risk analysis takes longer
      analysisType: 'risk-focused'
    };
  }

  /**
   * Build risk-specific query
   */
  buildRiskQuery(task, context) {
    const { tenant } = context.tenantData;
    const { focusArea, insightType } = task;
    
    let query = `Comprehensive risk analysis for ${tenant.name} in ${tenant.industry} industry. `;
    
    switch (insightType) {
      case 'predictions':
        query += 'Focus on risk forecasting, emerging threats, and predictive indicators.';
        break;
      case 'recommendations':
        query += 'Focus on risk mitigation strategies and improvement recommendations.';
        break;
      case 'alerts':
        query += 'Focus on immediate risk concerns and urgent attention items.';
        break;
      default:
        query += 'Provide overall risk assessment including current posture, trends, and key concerns.';
    }
    
    return query;
  }

  /**
   * Override tool selection for risk focus
   */
  selectRelevantTools(availableTools, task) {
    const riskTools = [
      'get_risk_summary',
      'analyze_risk_patterns', 
      'forecast_risk_trajectory',
      'detect_anomalies',
      'analyze_grc_data'
    ];
    
    return availableTools.filter(tool => riskTools.includes(tool.name));
  }

  /**
   * Override insight generation with risk expertise
   */
  async generateInsights(results, task, context) {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      throw new Error('No successful risk analysis tools executed');
    }

    // Extract risk-specific data
    const riskData = this.extractRiskData(successfulResults);
    
    // Build specialized risk prompt
    const prompt = this.buildRiskInsightPrompt(riskData, task, context);
    
    // Generate insights with risk specialization
    const insights = await this.llmClient.generateInsights({
      tenantData: context.tenantData,
      focusArea: 'risks', // Always use risks focus for this agent
      insightType: task.insightType,
      executiveSummary: task.executiveSummary,
      agentContext: {
        agent: this.name,
        specialization: 'Advanced Risk Analysis',
        riskData,
        analysisDepth: this.analysisDepth,
        toolResults: successfulResults,
        riskCategories: this.riskCategories
      }
    });

    // Add risk-specific enhancements
    const enhancedInsights = this.enhanceRiskInsights(insights, riskData, context);

    return {
      content: enhancedInsights,
      confidence: this.calculateRiskConfidence(successfulResults, riskData),
      summary: this.extractRiskSummary(enhancedInsights, riskData),
      riskMetrics: this.calculateRiskMetrics(riskData),
      toolsUsed: successfulResults.map(r => r.step.tool),
      agent: this.name,
      specialization: 'risk analysis',
      timestamp: Date.now()
    };
  }

  /**
   * Extract risk-specific data from tool results
   */
  extractRiskData(results) {
    const riskData = {
      currentRisks: [],
      patterns: [],
      forecasts: [],
      anomalies: [],
      trends: []
    };

    results.forEach(result => {
      const toolName = result.step.tool;
      const data = result.result;

      switch (toolName) {
        case 'get_risk_summary':
          if (data && data.content) {
            riskData.currentRisks = this.parseRiskSummary(data.content);
          }
          break;
          
        case 'analyze_risk_patterns':
          if (data && data.content) {
            riskData.patterns = this.parseRiskPatterns(data.content);
          }
          break;
          
        case 'forecast_risk_trajectory':
          if (data && data.content) {
            riskData.forecasts = this.parseRiskForecasts(data.content);
          }
          break;
          
        case 'detect_anomalies':
          if (data && data.content) {
            riskData.anomalies = this.parseAnomalies(data.content);
          }
          break;
          
        case 'analyze_grc_data':
          if (data && data.content) {
            riskData.trends = this.parseGRCTrends(data.content);
          }
          break;
      }
    });

    return riskData;
  }

  /**
   * Build risk-specific LLM prompt
   */
  buildRiskInsightPrompt(riskData, task, context) {
    let prompt = `As a senior risk analyst with expertise in ${context.tenantData.tenant.industry} industry, `;
    prompt += `analyze the following risk assessment data for ${context.tenantData.tenant.name}:\n\n`;

    // Current risk landscape
    if (riskData.currentRisks.length > 0) {
      prompt += `CURRENT RISK LANDSCAPE:\n`;
      riskData.currentRisks.forEach(risk => {
        prompt += `- ${risk}\n`;
      });
      prompt += `\n`;
    }

    // Risk patterns and trends
    if (riskData.patterns.length > 0) {
      prompt += `RISK PATTERNS IDENTIFIED:\n`;
      riskData.patterns.forEach(pattern => {
        prompt += `- ${pattern}\n`;
      });
      prompt += `\n`;
    }

    // Forward-looking forecasts
    if (riskData.forecasts.length > 0) {
      prompt += `RISK FORECASTS:\n`;
      riskData.forecasts.forEach(forecast => {
        prompt += `- ${forecast}\n`;
      });
      prompt += `\n`;
    }

    // Anomalies and alerts
    if (riskData.anomalies.length > 0) {
      prompt += `RISK ANOMALIES DETECTED:\n`;
      riskData.anomalies.forEach(anomaly => {
        prompt += `- ${anomaly}\n`;
      });
      prompt += `\n`;
    }

    // Historical context
    const recentInsights = this.memory.getRecentInsights(context.tenantId, 'risks');
    if (recentInsights.length > 0) {
      prompt += `RECENT RISK ANALYSIS CONTEXT:\n`;
      recentInsights.forEach(insight => {
        prompt += `- ${insight.summary}\n`;
      });
      prompt += `\n`;
    }

    prompt += `Provide ${task.insightType} insights focusing on:\n`;
    prompt += `1. Risk exposure assessment\n`;
    prompt += `2. Emerging risk identification\n`;
    prompt += `3. Risk mitigation priorities\n`;
    prompt += `4. Strategic risk recommendations\n`;
    
    if (task.executiveSummary) {
      prompt += `5. Executive-level risk communication\n`;
    }

    return prompt;
  }

  /**
   * Enhance insights with risk-specific intelligence
   */
  enhanceRiskInsights(insights, riskData, context) {
    let enhanced = insights;

    // Add risk scoring if we have current risks
    if (riskData.currentRisks.length > 0) {
      enhanced += `\n\n## 📊 Risk Score Summary\n`;
      enhanced += `- **Overall Risk Level**: ${this.calculateOverallRiskLevel(riskData)}\n`;
      enhanced += `- **Risk Velocity**: ${this.calculateRiskVelocity(riskData)}\n`;
      enhanced += `- **Risk Diversity**: ${riskData.currentRisks.length} distinct risk areas identified\n`;
    }

    // Add early warning indicators
    if (riskData.anomalies.length > 0) {
      enhanced += `\n\n## ⚠️ Early Warning Indicators\n`;
      riskData.anomalies.slice(0, 3).forEach(anomaly => {
        enhanced += `- ${anomaly}\n`;
      });
    }

    // Add industry context
    enhanced += `\n\n## 🏭 Industry Context\n`;
    enhanced += `Analysis tailored for ${context.tenantData.tenant.industry} sector with `;
    enhanced += `emphasis on sector-specific risk factors and regulatory requirements.\n`;

    return enhanced;
  }

  /**
   * Calculate risk-specific confidence
   */
  calculateRiskConfidence(successfulResults, riskData) {
    let confidence = 0.7; // Base confidence
    
    // Boost confidence based on data richness
    if (riskData.currentRisks.length > 0) confidence += 0.1;
    if (riskData.patterns.length > 0) confidence += 0.1;
    if (riskData.forecasts.length > 0) confidence += 0.05;
    if (riskData.anomalies.length > 0) confidence += 0.05;
    
    // Factor in tool success rate
    const toolSuccessRate = successfulResults.length / (successfulResults.length + 1);
    confidence *= toolSuccessRate;
    
    return Math.min(0.95, Math.round(confidence * 100) / 100);
  }

  /**
   * Extract risk-focused summary
   */
  extractRiskSummary(insights, riskData) {
    // Look for risk-specific summary patterns
    const lines = insights.split('\n');
    const riskSummaryLine = lines.find(line => 
      line.toLowerCase().includes('risk') && 
      (line.includes('summary') || line.includes('assessment') || line.includes('overview'))
    );
    
    if (riskSummaryLine) {
      return riskSummaryLine.replace(/[#*-]/g, '').trim().substring(0, 200);
    }
    
    // Fallback: create summary from risk data
    const riskCount = riskData.currentRisks.length;
    const anomalyCount = riskData.anomalies.length;
    
    return `Risk analysis identified ${riskCount} risk areas${anomalyCount > 0 ? ` with ${anomalyCount} anomalies requiring attention` : ''}`;
  }

  /**
   * Calculate risk metrics
   */
  calculateRiskMetrics(riskData) {
    return {
      riskCount: riskData.currentRisks.length,
      patternCount: riskData.patterns.length,
      forecastCount: riskData.forecasts.length,
      anomalyCount: riskData.anomalies.length,
      overallRiskLevel: this.calculateOverallRiskLevel(riskData),
      riskVelocity: this.calculateRiskVelocity(riskData)
    };
  }

  /**
   * Helper methods for parsing tool results
   */
  parseRiskSummary(content) {
    // Extract risk items from content
    const riskPattern = /(?:risk|threat|exposure|vulnerability).*?(?=\n|$)/gi;
    const risks = content.match(riskPattern) || [];
    return risks.slice(0, 10); // Limit to top 10 risks
  }

  parseRiskPatterns(content) {
    const patternKeywords = ['pattern', 'trend', 'correlation', 'seasonal', 'cyclical'];
    const lines = content.split('\n');
    return lines.filter(line => 
      patternKeywords.some(keyword => line.toLowerCase().includes(keyword))
    ).slice(0, 5);
  }

  parseRiskForecasts(content) {
    const forecastKeywords = ['forecast', 'prediction', 'projected', 'expected', 'likely'];
    const lines = content.split('\n');
    return lines.filter(line => 
      forecastKeywords.some(keyword => line.toLowerCase().includes(keyword))
    ).slice(0, 5);
  }

  parseAnomalies(content) {
    const anomalyKeywords = ['anomaly', 'unusual', 'deviation', 'spike', 'outlier'];
    const lines = content.split('\n');
    return lines.filter(line => 
      anomalyKeywords.some(keyword => line.toLowerCase().includes(keyword))
    ).slice(0, 3);
  }

  parseGRCTrends(content) {
    const trendKeywords = ['increasing', 'decreasing', 'improving', 'deteriorating', 'stable'];
    const lines = content.split('\n');
    return lines.filter(line => 
      trendKeywords.some(keyword => line.toLowerCase().includes(keyword))
    ).slice(0, 5);
  }

  calculateOverallRiskLevel(riskData) {
    if (riskData.anomalies.length > 2) return 'HIGH';
    if (riskData.currentRisks.length > 5) return 'MEDIUM-HIGH';
    if (riskData.currentRisks.length > 2) return 'MEDIUM';
    return 'LOW-MEDIUM';
  }

  calculateRiskVelocity(riskData) {
    if (riskData.patterns.some(p => p.includes('increasing') || p.includes('accelerating'))) {
      return 'ACCELERATING';
    }
    if (riskData.patterns.some(p => p.includes('decreasing') || p.includes('slowing'))) {
      return 'DECELERATING';
    }
    return 'STABLE';
  }

  /**
   * Override basic tool for risk fallback
   */
  getBasicTool() {
    return {
      name: 'get_risk_summary',
      params: (context) => ({
        tenant_id: context.tenantId,
        summary_type: 'basic',
        include_scores: true
      })
    };
  }
}

export default RiskAnalysisAgent;