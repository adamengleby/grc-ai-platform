/**
 * Base Agent Class for GRC Platform
 * Provides core functionality for all specialized agents
 */

export class AgentMemory {
  constructor() {
    this.sessionContext = new Map();
    this.recentInsights = [];
    this.patterns = new Map();
    this.maxInsights = 10; // Limit memory usage
  }

  addInsight(insight) {
    const summary = {
      timestamp: Date.now(),
      summary: insight.summary || insight.substring(0, 200),
      confidence: insight.confidence || 0.85,
      tenantId: insight.tenantId,
      focusArea: insight.focusArea,
      type: insight.type
    };

    this.recentInsights.push(summary);

    // Keep only recent insights (stateless, no persistence)
    if (this.recentInsights.length > this.maxInsights) {
      this.recentInsights.shift();
    }
  }

  getRecentInsights(tenantId, focusArea = null) {
    return this.recentInsights.filter(insight => {
      if (insight.tenantId !== tenantId) return false;
      if (focusArea && insight.focusArea !== focusArea) return false;
      return true;
    });
  }

  addPattern(key, pattern) {
    this.patterns.set(key, {
      pattern,
      timestamp: Date.now(),
      frequency: (this.patterns.get(key)?.frequency || 0) + 1
    });
  }

  getPatterns(tenantId) {
    const tenantPatterns = [];
    for (const [key, data] of this.patterns.entries()) {
      if (key.includes(tenantId)) {
        tenantPatterns.push({ key, ...data });
      }
    }
    return tenantPatterns;
  }

  setContext(key, value) {
    this.sessionContext.set(key, value);
  }

  getContext(key) {
    return this.sessionContext.get(key);
  }

  clearSession() {
    this.sessionContext.clear();
  }
}

export class GRCAgent {
  constructor(name, specialization, llmClient, mcpClient, config = {}) {
    this.name = name;
    this.specialization = specialization;
    this.llmClient = llmClient;
    this.mcpClient = mcpClient;
    this.config = {
      maxSteps: 5,
      timeoutMs: 60000,
      retries: 2,
      ...config
    };
    this.memory = new AgentMemory();
    this.toolCallCount = 0;
    this.isActive = false;
  }

  /**
   * Main execution method - template pattern
   */
  async execute(task, context) {
    this.isActive = true;
    this.toolCallCount = 0;
    const startTime = Date.now();
    
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Agent ${this.name} timeout after ${this.config.timeoutMs}ms`)), this.config.timeoutMs);
    });
    
    try {
      return await Promise.race([
        this.executeInternal(task, context, startTime),
        timeoutPromise
      ]);
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.error(`[${this.name}] Agent execution timed out after ${this.config.timeoutMs}ms`);
      }
      
      console.error(`[${this.name}] Task failed:`, error.message);
      
      // Fallback to basic analysis
      return await this.fallbackAnalysis(task, context, error);
      
    } finally {
      this.isActive = false;
    }
  }

  /**
   * Internal execution method
   */
  async executeInternal(task, context, startTime) {
    console.log(`[${this.name}] Starting task: ${task.type || 'analysis'}`);
    
    // 1. Plan the approach
    const plan = await this.planApproach(task, context);
    console.log(`[${this.name}] Execution plan: ${plan.steps.length} steps`);
    
    // Validate plan doesn't exceed limits
    if (plan.steps.length > this.config.maxSteps) {
      console.warn(`[${this.name}] Plan truncated from ${plan.steps.length} to ${this.config.maxSteps} steps`);
      plan.steps = plan.steps.slice(0, this.config.maxSteps);
    }
    
    // 2. Execute the plan
    const results = await this.executePlan(plan, context);
    
    // 3. Generate insights from results
    const insights = await this.generateInsights(results, task, context);
    
    // 4. Store in memory for future reference
    this.memory.addInsight({
      ...insights,
      tenantId: context.tenantId,
      focusArea: task.focusArea,
      type: task.type
    });
    
    const duration = Date.now() - startTime;
    console.log(`[${this.name}] Task completed successfully in ${duration}ms`);
    return insights;
  }

  /**
   * Plan the approach - to be overridden by specialized agents
   */
  async planApproach(task, context) {
    // Default planning logic
    const availableTools = await this.getAvailableTools();
    const relevantTools = this.selectRelevantTools(availableTools, task);
    
    return {
      steps: relevantTools.map(tool => ({
        action: 'useTool',
        tool: tool.name,
        params: this.prepareToolParams(tool, context),
        purpose: `Gather ${tool.description}`
      })),
      reasoning: `Standard ${this.specialization} analysis workflow`,
      estimatedDuration: relevantTools.length * 5000 // 5s per tool call
    };
  }

  /**
   * Execute the planned steps
   */
  async executePlan(plan, context) {
    const results = [];
    
    for (const step of plan.steps) {
      try {
        console.log(`[${this.name}] Executing: ${step.purpose}`);
        
        const result = await this.executeStep(step, context);
        results.push({
          step,
          result,
          success: true,
          timestamp: Date.now()
        });
        
      } catch (error) {
        console.warn(`[${this.name}] Step failed: ${step.purpose} - ${error.message}`);
        results.push({
          step,
          error: error.message,
          success: false,
          timestamp: Date.now()
        });
        
        // Continue with other steps even if one fails
      }
    }
    
    return results;
  }

  /**
   * Execute a single step
   */
  async executeStep(step, context) {
    switch (step.action) {
      case 'useTool':
        return await this.useTool(step.tool, step.params);
      
      case 'analyze':
        return await this.performAnalysis(step.data, step.method);
      
      case 'synthesize':
        return await this.synthesizeResults(step.inputs);
      
      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }
  }

  /**
   * Use an MCP tool
   */
  async useTool(toolName, params) {
    this.toolCallCount++;
    
    if (this.toolCallCount > this.config.maxSteps) {
      throw new Error(`Maximum tool calls exceeded (${this.config.maxSteps})`);
    }

    console.log(`[${this.name}] Using tool: ${toolName}`);
    
    try {
      const result = await this.mcpClient.callTool(toolName, params);
      return result;
    } catch (error) {
      throw new Error(`Tool ${toolName} failed: ${error.message}`);
    }
  }

  /**
   * Generate insights - to be overridden by specialized agents
   */
  async generateInsights(results, task, context) {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    if (successfulResults.length === 0) {
      throw new Error('No successful tool calls to generate insights from');
    }

    // Prepare context for LLM
    const prompt = this.buildInsightPrompt(successfulResults, task, context);
    
    // Generate insights using LLM
    const insights = await this.llmClient.generateInsights({
      tenantData: context.tenantData,
      focusArea: task.focusArea,
      insightType: task.insightType,
      executiveSummary: task.executiveSummary,
      agentContext: {
        agent: this.name,
        specialization: this.specialization,
        toolResults: successfulResults,
        reasoning: prompt
      }
    });

    return {
      content: insights,
      confidence: this.calculateConfidence(successfulResults, failedResults),
      summary: this.extractSummary(insights),
      toolsUsed: successfulResults.map(r => r.step.tool),
      agent: this.name,
      timestamp: Date.now()
    };
  }

  /**
   * Build LLM prompt with agent context
   */
  buildInsightPrompt(results, task, context) {
    let prompt = `Acting as a specialized ${this.specialization} agent, analyze the following data:\n\n`;
    
    results.forEach((result, index) => {
      prompt += `Tool ${index + 1}: ${result.step.tool}\n`;
      prompt += `Purpose: ${result.step.purpose}\n`;
      prompt += `Result: ${JSON.stringify(result.result, null, 2)}\n\n`;
    });

    // Add agent-specific context
    const recentInsights = this.memory.getRecentInsights(context.tenantId, task.focusArea);
    if (recentInsights.length > 0) {
      prompt += `Previous insights for context:\n`;
      recentInsights.forEach(insight => {
        prompt += `- ${insight.summary}\n`;
      });
    }

    prompt += `\nProvide ${this.specialization}-focused insights for ${context.tenantData.tenant.name}.`;
    
    return prompt;
  }

  /**
   * Calculate confidence based on successful vs failed tool calls
   */
  calculateConfidence(successful, failed) {
    const total = successful.length + failed.length;
    if (total === 0) return 0.5;
    
    const successRate = successful.length / total;
    const baseConfidence = 0.7 + (successRate * 0.3); // 70-100% range
    
    return Math.round(baseConfidence * 100) / 100;
  }

  /**
   * Extract summary from insights
   */
  extractSummary(insights) {
    const lines = insights.split('\n');
    const summaryLines = lines.filter(line => 
      line.includes('summary') || 
      line.includes('conclusion') || 
      line.includes('key finding')
    );
    
    if (summaryLines.length > 0) {
      return summaryLines[0].replace(/[#*-]/g, '').trim().substring(0, 200);
    }
    
    // Fallback to first meaningful line
    const meaningfulLine = lines.find(line => 
      line.length > 50 && 
      !line.startsWith('#') && 
      !line.includes('**')
    );
    
    return meaningfulLine ? meaningfulLine.trim().substring(0, 200) : 'Analysis completed';
  }

  /**
   * Fallback analysis when main execution fails
   */
  async fallbackAnalysis(task, context, error) {
    console.log(`[${this.name}] Executing fallback analysis`);
    
    try {
      // Try basic analysis with just one tool
      const basicTool = this.getBasicTool();
      const result = await this.useTool(basicTool.name, basicTool.params(context));
      
      return {
        content: `Basic ${this.specialization} analysis completed. ${result.content || 'Data retrieved successfully.'}`,
        confidence: 0.6,
        summary: `Fallback analysis due to: ${error.message}`,
        toolsUsed: [basicTool.name],
        agent: this.name,
        fallback: true,
        timestamp: Date.now()
      };
      
    } catch (fallbackError) {
      return {
        content: `Unable to complete ${this.specialization} analysis. Error: ${error.message}`,
        confidence: 0.3,
        summary: 'Analysis failed',
        toolsUsed: [],
        agent: this.name,
        failed: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get available MCP tools
   */
  async getAvailableTools() {
    // This would typically query the MCP server for available tools
    // For now, return the known tools
    return [
      { name: 'analyze_grc_data', description: 'GRC data analysis' },
      { name: 'get_risk_summary', description: 'Risk summary data' },
      { name: 'detect_anomalies', description: 'Anomaly detection' },
      { name: 'forecast_risk_trajectory', description: 'Risk forecasting' },
      { name: 'predict_control_failures', description: 'Control failure prediction' },
      { name: 'analyze_risk_patterns', description: 'Risk pattern analysis' }
    ];
  }

  /**
   * Select relevant tools - to be overridden by specialized agents
   */
  selectRelevantTools(availableTools, task) {
    // Default: use analyze_grc_data for general analysis
    return availableTools.filter(tool => tool.name === 'analyze_grc_data');
  }

  /**
   * Prepare tool parameters
   */
  prepareToolParams(tool, context) {
    return {
      tenant_id: context.tenantId,
      query: `${this.specialization} analysis for ${context.tenantData.tenant.name}`,
      include_history: true,
      include_predictions: true
    };
  }

  /**
   * Get basic tool for fallback
   */
  getBasicTool() {
    return {
      name: 'analyze_grc_data',
      params: (context) => ({
        tenant_id: context.tenantId,
        query: `Basic ${this.specialization} analysis`,
        include_history: false,
        include_predictions: false
      })
    };
  }

  /**
   * Get agent statistics
   */
  getStats() {
    return {
      name: this.name,
      specialization: this.specialization,
      isActive: this.isActive,
      toolCallCount: this.toolCallCount,
      memorySize: this.memory.recentInsights.length,
      patternsLearned: this.memory.patterns.size
    };
  }
}

export default GRCAgent;