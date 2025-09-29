/**
 * LLM Client Service for GRC Platform
 * Supports Claude API, OpenAI, and local Ollama with fallback mechanisms
 * Enhanced with AI Agent capabilities for intelligent multi-step analysis
 */

import { GRCOrchestrator } from './agents/AgentOrchestrator.js';

class LLMClient {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'azure', // 'claude', 'openai', 'azure', or 'ollama'
      apiKey: config.apiKey || this.getDefaultApiKey(config.provider),
      model: config.model || this.getDefaultModel(config.provider),
      maxTokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.3,
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      fallbackToMock: config.fallbackToMock !== false,
      // Azure-specific config
      azureEndpoint: config.azureEndpoint || process.env.AZURE_OPENAI_ENDPOINT,
      azureApiVersion: config.azureApiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
      azureDeployment: config.azureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT,
      // Ollama-specific config
      ollamaUrl: config.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434',
      // Agent configuration
      enableAgents: config.enableAgents !== false, // Default to enabled
      agentMode: config.agentMode || 'auto' // auto, single, multi
    };

    this.requestCount = 0;
    this.lastRequest = 0;
    this.rateLimit = {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    };

    // Track request history for rate limiting
    this.requestHistory = [];
    
    // Initialize agent orchestrator (will be set up when first needed)
    this.orchestrator = null;
    this.mcpClient = null; // Will be injected when available
  }

  /**
   * Get default API key for provider
   */
  getDefaultApiKey(provider) {
    switch (provider) {
      case 'claude':
        return process.env.ANTHROPIC_API_KEY;
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'azure':
        return process.env.AZURE_OPENAI_API_KEY;
      case 'ollama':
        return null; // No API key needed for Ollama
      default:
        return process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY;
    }
  }

  /**
   * Get default model for provider
   */
  getDefaultModel(provider) {
    switch (provider) {
      case 'openai':
        return 'gpt-4';
      case 'azure':
        return 'gpt-4'; // Will use deployment name in Azure
      case 'ollama':
        return 'llama2'; // or 'mistral', 'codellama', etc.
      case 'claude':
      default:
        return 'claude-3-sonnet-20240229';
    }
  }

  /**
   * Set MCP client for agent tool usage
   */
  setMCPClient(mcpClient) {
    this.mcpClient = mcpClient;
    // Reset orchestrator to reinitialize with new MCP client
    this.orchestrator = null;
  }

  /**
   * Initialize agent orchestrator (lazy loading)
   */
  initializeOrchestrator() {
    if (!this.orchestrator && this.config.enableAgents) {
      try {
        this.orchestrator = new GRCOrchestrator(this, this.mcpClient, {
          enableAgents: this.config.enableAgents,
          agentMode: this.config.agentMode
        });
        console.log('[LLM Client] Agent orchestrator initialized');
      } catch (error) {
        console.warn('[LLM Client] Failed to initialize orchestrator:', error.message);
        this.orchestrator = null;
      }
    }
  }

  /**
   * Generate AI insights using LLM or Agents
   * @param {Object} params - Parameters for insight generation
   * @returns {Promise<string>} Generated insights
   */
  async generateInsights(params) {
    const { 
      tenantData, 
      focusArea = 'overall', 
      insightType = 'summary', 
      executiveSummary = false,
      mlPredictions = null,
      useAgents = this.config.enableAgents, // Backwards compatibility
      agentMode = this.config.agentMode
    } = params;

    try {
      // Check rate limits
      await this.checkRateLimit();

      // Agent-based insights (if enabled and available)
      if (useAgents && this.mcpClient) {
        try {
          this.initializeOrchestrator();
          
          if (this.orchestrator && this.orchestrator.isHealthy()) {
            console.log('[LLM Client] Using agent-based insights generation');
            
            const agentResult = await this.orchestrator.generateInsights({
              tenantId: this.extractTenantId(tenantData),
              tenantData,
              focusArea,
              insightType,
              executiveSummary,
              useAgents: true,
              agentMode
            });

            // Return agent result if successful
            if (agentResult && agentResult.content) {
              return agentResult.content;
            }
          }
        } catch (agentError) {
          console.warn('[LLM Client] Agent-based generation failed:', agentError.message);
          // Fall through to direct LLM
        }
      }

      // Direct LLM generation (original behavior)
      console.log('[LLM Client] Using direct LLM generation');
      
      // Generate the prompt
      const prompt = this.buildGRCPrompt(tenantData, focusArea, insightType, executiveSummary, mlPredictions);

      // Make LLM request
      const response = await this.makeRequest(prompt);

      // Parse and validate response
      const insights = this.parseInsightResponse(response, focusArea, insightType);

      return insights;

    } catch (error) {
      console.error('[LLM Client] Request failed:', error.message);
      
      if (this.config.fallbackToMock) {
        console.log('[LLM Client] Falling back to mock response');
        return this.generateMockInsights(tenantData, focusArea, insightType, executiveSummary);
      }
      
      throw error;
    }
  }

  /**
   * Build GRC-specific prompt based on parameters
   */
  buildGRCPrompt(tenantData, focusArea, insightType, executiveSummary, mlPredictions) {
    const { tenant, riskData, controlData, complianceData, incidentData } = tenantData;
    
    let prompt = `You are a senior GRC (Governance, Risk, and Compliance) analyst with expertise in ${tenant.industry} industry regulations and risk management. `;
    
    // Context setting
    prompt += `\n\nANALYZE the following organizational data for ${tenant.name}:\n`;
    prompt += `- Industry: ${tenant.industry}\n`;
    prompt += `- Risk Profile: ${this.summarizeRiskData(riskData)}\n`;
    prompt += `- Control Effectiveness: ${this.summarizeControlData(controlData)}\n`;
    prompt += `- Compliance Status: ${this.summarizeComplianceData(complianceData)}\n`;
    prompt += `- Recent Incidents: ${this.summarizeIncidentData(incidentData)}\n`;

    // Add ML predictions if available
    if (mlPredictions) {
      prompt += `\n- ML Predictions: ${JSON.stringify(mlPredictions, null, 2)}\n`;
    }

    // Focus area specific instructions
    prompt += this.getFocusAreaInstructions(focusArea);

    // Insight type specific instructions
    prompt += this.getInsightTypeInstructions(insightType);

    // Executive summary requirements
    if (executiveSummary) {
      prompt += this.getExecutiveSummaryInstructions();
    }

    // Output format requirements
    prompt += this.getOutputFormatInstructions(focusArea, insightType, executiveSummary);

    return prompt;
  }

  /**
   * Focus area specific prompt instructions
   */
  getFocusAreaInstructions(focusArea) {
    const instructions = {
      overall: `\n\nFOCUS: Provide a comprehensive organizational risk overview covering all GRC domains.`,
      risks: `\n\nFOCUS: Analyze risk exposure, trending, and mitigation effectiveness. Identify emerging threats and risk concentration areas.`,
      controls: `\n\nFOCUS: Evaluate control design and operating effectiveness. Identify control gaps, redundancies, and optimization opportunities.`,
      compliance: `\n\nFOCUS: Assess regulatory compliance status, upcoming requirements, and compliance program effectiveness.`,
      incidents: `\n\nFOCUS: Analyze incident patterns, root causes, and prevention strategies. Evaluate incident response effectiveness.`
    };

    return instructions[focusArea] || instructions.overall;
  }

  /**
   * Insight type specific prompt instructions
   */
  getInsightTypeInstructions(insightType) {
    const instructions = {
      summary: `\n\nTYPE: Generate high-level insights with key metrics and trends. Focus on current state and immediate actionable items.`,
      predictions: `\n\nTYPE: Provide forward-looking analysis with risk forecasts, trend predictions, and scenario planning. Use quantitative projections where possible.`,
      recommendations: `\n\nTYPE: Generate specific, actionable recommendations with implementation priorities, resource requirements, and expected outcomes.`,
      alerts: `\n\nTYPE: Identify urgent issues requiring immediate attention. Focus on critical risks, control failures, and compliance violations.`
    };

    return instructions[insightType] || instructions.summary;
  }

  /**
   * Executive summary specific requirements
   */
  getExecutiveSummaryInstructions() {
    return `\n\nEXECUTIVE SUMMARY: Include a board-ready executive summary with:
- Overall risk posture assessment
- Key findings that require executive attention  
- Strategic recommendations with business impact
- Confidence levels and supporting evidence`;
  }

  /**
   * Output format requirements
   */
  getOutputFormatInstructions(focusArea, insightType, executiveSummary) {
    return `\n\nOUTPUT FORMAT:
Use the following markdown structure:

# 🧠 AI-Generated Insights: ${focusArea.charAt(0).toUpperCase() + focusArea.slice(1)} Analysis

**Industry**: [Industry] | **Focus**: ${focusArea} | **Type**: ${insightType}
**Analysis Generated**: ${new Date().toISOString()}
**AI Confidence**: [85-95]%

## 📊 Current State Analysis
[Analyze current state with specific metrics and trends]

## 🎯 Key Findings
- [Finding 1 with supporting data]
- [Finding 2 with supporting data]
- [Finding 3 with supporting data]

## 🔮 Predictive Insights
[Forward-looking analysis and trend predictions]

## 💡 Recommendations
- **Priority 1**: [Specific recommendation with timeline]
- **Priority 2**: [Specific recommendation with timeline]
- **Priority 3**: [Specific recommendation with timeline]

${executiveSummary ? `## 📋 Executive Summary
[2-3 paragraph board-ready summary highlighting key risks, opportunities, and strategic recommendations]

### 🎯 Key Findings
- [Executive-level finding 1]
- [Executive-level finding 2]
- [Executive-level finding 3]

### 📝 Priority Actions
- [Action 1 with business impact]
- [Action 2 with business impact]
- [Action 3 with business impact]` : ''}

*Generated by AI Insights Engine with ${focusArea === 'overall' ? 'comprehensive' : focusArea} intelligence analysis*`;
  }

  /**
   * Make the actual LLM API request
   */
  async makeRequest(prompt) {
    const startTime = Date.now();
    this.recordRequest();

    try {
      if (this.config.provider === 'claude') {
        return await this.makeClaudeRequest(prompt);
      } else if (this.config.provider === 'openai') {
        return await this.makeOpenAIRequest(prompt);
      } else if (this.config.provider === 'azure') {
        return await this.makeAzureRequest(prompt);
      } else if (this.config.provider === 'ollama') {
        return await this.makeOllamaRequest(prompt);
      } else {
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[LLM Client] Request failed after ${duration}ms:`, error.message);
      throw error;
    }
  }

  /**
   * Make Claude API request
   */
  async makeClaudeRequest(prompt) {
    if (!this.config.apiKey) {
      throw new Error('Claude API key not configured. Set ANTHROPIC_API_KEY environment variable.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Make OpenAI API request  
   */
  async makeOpenAIRequest(prompt) {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior GRC analyst with expertise in risk management and compliance.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Make Azure OpenAI API request
   */
  async makeAzureRequest(prompt) {
    if (!this.config.apiKey) {
      throw new Error('Azure OpenAI API key not configured. Set AZURE_OPENAI_API_KEY environment variable.');
    }

    if (!this.config.azureEndpoint) {
      throw new Error('Azure OpenAI endpoint not configured. Set AZURE_OPENAI_ENDPOINT environment variable.');
    }

    if (!this.config.azureDeployment) {
      throw new Error('Azure OpenAI deployment not configured. Set AZURE_OPENAI_DEPLOYMENT environment variable.');
    }

    const endpoint = `${this.config.azureEndpoint}/openai/deployments/${this.config.azureDeployment}/chat/completions?api-version=${this.config.azureApiVersion}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a senior GRC analyst with expertise in risk management and compliance.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: null
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Make Ollama API request
   */
  async makeOllamaRequest(prompt) {
    const response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens
        }
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.response;
  }

  /**
   * Parse and validate LLM response
   */
  parseInsightResponse(response, focusArea, insightType) {
    // Basic validation
    if (!response || response.trim().length < 100) {
      throw new Error('LLM response too short or empty');
    }

    // Ensure response has required sections
    const requiredSections = ['Current State Analysis', 'Key Findings', 'Recommendations'];
    for (const section of requiredSections) {
      if (!response.includes(section)) {
        console.warn(`[LLM Client] Missing section: ${section}`);
      }
    }

    return response;
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit() {
    const now = Date.now();
    
    // Remove requests older than 1 hour
    this.requestHistory = this.requestHistory.filter(time => now - time < 3600000);
    
    // Check hourly limit
    if (this.requestHistory.length >= this.rateLimit.requestsPerHour) {
      throw new Error('Hourly rate limit exceeded');
    }

    // Check per-minute limit
    const recentRequests = this.requestHistory.filter(time => now - time < 60000);
    if (recentRequests.length >= this.rateLimit.requestsPerMinute) {
      const waitTime = 60000 - (now - recentRequests[0]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Record request for rate limiting
   */
  recordRequest() {
    this.requestHistory.push(Date.now());
    this.requestCount++;
    this.lastRequest = Date.now();
  }

  /**
   * Helper methods for data summarization
   */
  summarizeRiskData(riskData) {
    if (!riskData || !riskData.risks) return 'No risk data available';
    const total = riskData.risks.length;
    const critical = riskData.risks.filter(r => r.severity === 'critical').length;
    const high = riskData.risks.filter(r => r.severity === 'high').length;
    return `${total} total risks (${critical} critical, ${high} high)`;
  }

  summarizeControlData(controlData) {
    if (!controlData || !controlData.controls) return 'No control data available';
    const total = controlData.controls.length;
    const effective = controlData.controls.filter(c => c.effectiveness > 0.8).length;
    return `${total} controls (${effective} highly effective)`;
  }

  summarizeComplianceData(complianceData) {
    if (!complianceData) return 'No compliance data available';
    const score = complianceData.overall_score || 0;
    return `${(score * 100).toFixed(1)}% compliance score`;
  }

  summarizeIncidentData(incidentData) {
    if (!incidentData || !incidentData.incidents) return 'No recent incidents';
    const recent = incidentData.incidents.filter(i => 
      new Date(i.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;
    return `${recent} incidents in last 30 days`;
  }

  /**
   * Fallback mock insights generation
   */
  generateMockInsights(tenantData, focusArea, insightType, executiveSummary) {
    const { tenant } = tenantData;
    
    let insights = `# 🧠 AI-Generated Insights: ${focusArea.charAt(0).toUpperCase() + focusArea.slice(1)} Analysis\n\n`;
    insights += `**Industry**: ${tenant.industry} | **Focus**: ${focusArea} | **Type**: ${insightType}\n`;
    insights += `**Analysis Generated**: ${new Date().toISOString()}\n`;
    insights += `**AI Confidence**: 87% (Fallback Mode)\n\n`;

    insights += `## 📊 Current State Analysis\n`;
    insights += `${tenant.name} demonstrates moderate risk exposure typical for ${tenant.industry} organizations. `;
    insights += `Control frameworks are generally effective with opportunities for optimization.\n\n`;

    insights += `## 🎯 Key Findings\n`;
    insights += `- Risk profile aligns with industry benchmarks\n`;
    insights += `- Control effectiveness shows upward trend\n`;
    insights += `- Compliance posture remains stable\n\n`;

    insights += `## 💡 Recommendations\n`;
    insights += `- **Priority 1**: Enhance monitoring capabilities\n`;
    insights += `- **Priority 2**: Update risk assessment methodology\n`;
    insights += `- **Priority 3**: Strengthen incident response procedures\n\n`;

    if (executiveSummary) {
      insights += `## 📋 Executive Summary\n`;
      insights += `${tenant.name} maintains adequate risk management with moderate exposure levels. `;
      insights += `Strategic focus should be on proactive risk identification and control optimization.\n\n`;
    }

    insights += `*Generated by AI Insights Engine (Fallback Mode) with ${focusArea} intelligence analysis*`;

    return insights;
  }

  /**
   * Extract tenant ID from tenant data
   */
  extractTenantId(tenantData) {
    if (tenantData && tenantData.tenant) {
      // Use the actual tenant ID if available
      if (tenantData.tenant.id) {
        return tenantData.tenant.id;
      }
      
      // For agent compatibility, check if this is a known tenant mapping
      const tenantName = tenantData.tenant.name?.toLowerCase();
      const tenantMappings = {
        'fintech solutions corp': 'tenant-fintech-001',
        'fintech-solutions-corp': 'tenant-fintech-001',
        'healthcare corp': 'tenant-healthcare-002',
        'manufacturing inc': 'tenant-manufacturing-003'
      };
      
      // Check exact name mapping first
      if (tenantName && tenantMappings[tenantName]) {
        return tenantMappings[tenantName];
      }
      
      // Check if any mapping key contains the name
      for (const [key, value] of Object.entries(tenantMappings)) {
        if (tenantName && (key.includes(tenantName) || tenantName.includes(key.replace(/-/g, ' ')))) {
          return value;
        }
      }
      
      // Fallback to sanitized name
      return tenantData.tenant.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown-tenant';
    }
    return 'unknown-tenant';
  }

  /**
   * Enable/disable agent mode
   */
  setAgentMode(enabled, mode = 'auto') {
    this.config.enableAgents = enabled;
    this.config.agentMode = mode;
    
    if (this.orchestrator) {
      this.orchestrator.setAgentMode(enabled);
    }
    
    console.log(`[LLM Client] Agent mode ${enabled ? 'enabled' : 'disabled'} (${mode})`);
  }

  /**
   * Get agent statistics
   */
  getAgentStats() {
    if (this.orchestrator) {
      return this.orchestrator.getStats();
    }
    return { available: false, reason: 'Orchestrator not initialized' };
  }

  /**
   * Get client statistics
   */
  getStats() {
    const baseStats = {
      provider: this.config.provider,
      model: this.config.model,
      requestCount: this.requestCount,
      lastRequest: this.lastRequest,
      requestHistory: this.requestHistory.length,
      rateLimit: this.rateLimit,
      agentsEnabled: this.config.enableAgents,
      agentMode: this.config.agentMode
    };

    // Add agent stats if available
    if (this.orchestrator) {
      baseStats.agentStats = this.orchestrator.getStats();
    }

    return baseStats;
  }
}

export { LLMClient };