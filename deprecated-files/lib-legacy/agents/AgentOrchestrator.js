/**
 * GRC Agent Orchestrator
 * Coordinates multiple specialized agents and synthesizes their results
 */

import { GRCAgent } from './AgentBase.js';
import { RiskAnalysisAgent } from './RiskAgent.js';

export class GRCOrchestrator {
  constructor(llmClient, mcpClient, config = {}) {
    this.llmClient = llmClient;
    this.mcpClient = mcpClient;
    this.config = {
      enableAgents: true,
      fallbackToLLM: true,
      maxConcurrentAgents: 3,
      timeoutMs: 120000, // 2 minutes for orchestration
      maxRetries: 2, // Maximum retry attempts per agent
      circuitBreakerThreshold: 5, // Number of failures before circuit opens
      ...config
    };
    
    // Circuit breaker state
    this.circuitBreaker = {
      failureCount: 0,
      lastFailureTime: null,
      state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
    };

    // Initialize specialized agents
    this.agents = this.initializeAgents();
    this.activeWorkflows = new Map();
    this.stats = {
      totalRequests: 0,
      agentRequests: 0,
      fallbackRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    };
  }

  /**
   * Initialize all specialized agents
   */
  initializeAgents() {
    const agents = {};

    try {
      // Risk Analysis Agent
      agents.risk = new RiskAnalysisAgent(this.llmClient, this.mcpClient, {
        analysisDepth: 'comprehensive'
      });

      // Placeholder for other agents (to be implemented)
      agents.compliance = new GRCAgent('ComplianceAnalyst', 'compliance analysis', this.llmClient, this.mcpClient);
      agents.control = new GRCAgent('ControlAnalyst', 'control effectiveness', this.llmClient, this.mcpClient);
      agents.executive = new GRCAgent('ExecutiveAnalyst', 'executive insights', this.llmClient, this.mcpClient);
      agents.recommendation = new GRCAgent('RecommendationEngine', 'strategic recommendations', this.llmClient, this.mcpClient);

      console.log(`[Orchestrator] Initialized ${Object.keys(agents).length} specialized agents`);
      return agents;

    } catch (error) {
      console.error('[Orchestrator] Failed to initialize agents:', error.message);
      return {};
    }
  }

  /**
   * Main orchestration method - backwards compatible with existing API
   */
  async generateInsights(request) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      const {
        tenantId,
        tenantData,
        focusArea = 'overall',
        insightType = 'summary',
        executiveSummary = false,
        useAgents = this.config.enableAgents, // Backwards compatibility
        agentMode = 'auto' // auto, single, multi
      } = request;

      console.log(`[Orchestrator] Processing request: ${focusArea}/${insightType} for ${tenantData?.tenant?.name || tenantId}`);

      // Prepare context for agents
      const context = {
        tenantId,
        tenantData,
        timestamp: Date.now(),
        requestId: this.generateRequestId()
      };

      const task = {
        focusArea,
        insightType,
        executiveSummary,
        priority: this.determinePriority(insightType)
      };

      // Track active workflow
      this.activeWorkflows.set(context.requestId, {
        startTime,
        task,
        context,
        status: 'running'
      });

      let result;

      if (useAgents && Object.keys(this.agents).length > 0 && this.isCircuitClosed()) {
        this.stats.agentRequests++;
        result = await this.executeAgentWorkflow(task, context, agentMode);
        this.recordSuccess();
      } else {
        if (!this.isCircuitClosed()) {
          console.warn('[Orchestrator] Circuit breaker OPEN - falling back to direct LLM');
        }
        this.stats.fallbackRequests++;
        result = await this.fallbackToDirectLLM(task, context);
      }

      // Update workflow status
      this.activeWorkflows.get(context.requestId).status = 'completed';
      this.stats.successfulRequests++;

      console.log(`[Orchestrator] Request completed in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      this.stats.failedRequests++;
      this.recordFailure();
      console.error('[Orchestrator] Request failed:', error.message);

      // Final fallback to basic LLM
      if (this.config.fallbackToLLM) {
        return await this.emergencyFallback(request, error);
      }

      throw error;

    } finally {
      // Cleanup completed workflow
      setTimeout(() => {
        this.activeWorkflows.delete(request.requestId);
      }, 30000); // Keep for 30 seconds for debugging
    }
  }

  /**
   * Execute agent-based workflow
   */
  async executeAgentWorkflow(task, context, agentMode) {
    const { focusArea, insightType, executiveSummary } = task;

    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Agent workflow timeout')), this.config.timeoutMs);
    });

    try {
      return await Promise.race([
        this.executeAgentWorkflowInternal(task, context, agentMode),
        timeoutPromise
      ]);
    } catch (error) {
      if (error.message === 'Agent workflow timeout') {
        console.error('[Orchestrator] Agent workflow timed out after', this.config.timeoutMs, 'ms');
      }
      throw error;
    }
  }

  /**
   * Internal agent workflow execution
   */
  async executeAgentWorkflowInternal(task, context, agentMode) {
    const { focusArea, insightType, executiveSummary } = task;

    // Select agents based on focus area and mode
    const selectedAgents = this.selectAgents(focusArea, agentMode);
    
    if (selectedAgents.length === 0) {
      throw new Error('No suitable agents available for this request');
    }

    console.log(`[Orchestrator] Selected ${selectedAgents.length} agents: ${selectedAgents.map(a => a.name).join(', ')}`);

    let agentResults;

    if (selectedAgents.length === 1 || agentMode === 'single') {
      // Single agent execution
      agentResults = await this.executeSingleAgent(selectedAgents[0], task, context);
    } else {
      // Multi-agent execution
      agentResults = await this.executeMultiAgent(selectedAgents, task, context);
    }

    // Synthesize results if multiple agents were used
    if (Array.isArray(agentResults) && agentResults.length > 1) {
      return await this.synthesizeAgentResults(agentResults, task, context);
    } else {
      // Single agent result or fallback
      const result = Array.isArray(agentResults) ? agentResults[0] : agentResults;
      return this.formatAgentResult(result, task, context);
    }
  }

  /**
   * Select appropriate agents based on focus area
   */
  selectAgents(focusArea, agentMode = 'auto') {
    const agents = [];

    switch (focusArea) {
      case 'risks':
        if (this.agents.risk) agents.push(this.agents.risk);
        if (agentMode === 'multi' && this.agents.recommendation) {
          agents.push(this.agents.recommendation);
        }
        break;

      case 'controls':
        if (this.agents.control) agents.push(this.agents.control);
        if (agentMode === 'multi' && this.agents.recommendation) {
          agents.push(this.agents.recommendation);
        }
        break;

      case 'compliance':
        if (this.agents.compliance) agents.push(this.agents.compliance);
        if (agentMode === 'multi' && this.agents.recommendation) {
          agents.push(this.agents.recommendation);
        }
        break;

      case 'overall':
      default:
        // For overall analysis, use multiple agents if available
        if (agentMode === 'single') {
          // Pick the most comprehensive agent
          if (this.agents.risk) agents.push(this.agents.risk);
        } else {
          // Use multiple agents for comprehensive analysis
          if (this.agents.risk) agents.push(this.agents.risk);
          if (this.agents.compliance) agents.push(this.agents.compliance);
          if (this.agents.control) agents.push(this.agents.control);
          
          // Add executive agent for summary tasks
          if (this.agents.executive) agents.push(this.agents.executive);
        }
        break;
    }

    // Fallback to any available agent if none selected
    if (agents.length === 0 && Object.keys(this.agents).length > 0) {
      const availableAgent = Object.values(this.agents)[0];
      if (availableAgent) agents.push(availableAgent);
    }

    return agents.slice(0, this.config.maxConcurrentAgents);
  }

  /**
   * Execute single agent
   */
  async executeSingleAgent(agent, task, context) {
    console.log(`[Orchestrator] Executing single agent: ${agent.name}`);

    try {
      const result = await agent.execute(task, context);
      return result;
    } catch (error) {
      console.error(`[Orchestrator] Agent ${agent.name} failed:`, error.message);
      throw new Error(`Agent execution failed: ${error.message}`);
    }
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeMultiAgent(agents, task, context) {
    console.log(`[Orchestrator] Executing ${agents.length} agents in parallel`);

    const agentPromises = agents.map(async (agent) => {
      try {
        const result = await agent.execute(task, context);
        return { agent: agent.name, result, success: true };
      } catch (error) {
        console.error(`[Orchestrator] Agent ${agent.name} failed:`, error.message);
        return { agent: agent.name, error: error.message, success: false };
      }
    });

    const results = await Promise.allSettled(agentPromises);
    
    // Extract successful results
    const successfulResults = results
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .map(r => r.value);

    if (successfulResults.length === 0) {
      throw new Error('All agents failed to execute');
    }

    console.log(`[Orchestrator] ${successfulResults.length}/${agents.length} agents completed successfully`);
    return successfulResults;
  }

  /**
   * Synthesize results from multiple agents
   */
  async synthesizeAgentResults(agentResults, task, context) {
    console.log(`[Orchestrator] Synthesizing results from ${agentResults.length} agents`);

    try {
      // Prepare synthesis context
      const synthesisPrompt = this.buildSynthesisPrompt(agentResults, task, context);
      
      // Use LLM to synthesize agent results
      const synthesizedInsights = await this.llmClient.generateInsights({
        tenantData: context.tenantData,
        focusArea: task.focusArea,
        insightType: task.insightType,
        executiveSummary: task.executiveSummary,
        agentContext: {
          orchestrator: 'GRCOrchestrator',
          agentResults,
          synthesisPrompt,
          agentCount: agentResults.length
        }
      });

      return {
        content: synthesizedInsights,
        confidence: this.calculateSynthesisConfidence(agentResults),
        summary: this.extractSynthesisSummary(synthesizedInsights, agentResults),
        agentsUsed: agentResults.map(r => r.agent),
        synthesized: true,
        orchestrator: 'GRCOrchestrator',
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('[Orchestrator] Synthesis failed:', error.message);
      
      // Fallback: return the best single result
      const bestResult = this.selectBestResult(agentResults);
      return this.formatAgentResult(bestResult.result, task, context);
    }
  }

  /**
   * Build synthesis prompt for LLM
   */
  buildSynthesisPrompt(agentResults, task, context) {
    let prompt = `Acting as a senior GRC orchestrator, synthesize the following specialized agent analyses:\n\n`;

    agentResults.forEach((agentResult, index) => {
      prompt += `AGENT ${index + 1}: ${agentResult.agent}\n`;
      prompt += `Confidence: ${agentResult.result.confidence || 'N/A'}\n`;
      prompt += `Summary: ${agentResult.result.summary || 'No summary available'}\n`;
      prompt += `Key Tools Used: ${(agentResult.result.toolsUsed || []).join(', ')}\n`;
      prompt += `Analysis Preview: ${(agentResult.result.content || '').substring(0, 300)}...\n\n`;
    });

    prompt += `SYNTHESIS REQUIREMENTS:\n`;
    prompt += `1. Integrate insights from all agents coherently\n`;
    prompt += `2. Resolve any conflicts or contradictions\n`;
    prompt += `3. Highlight cross-agent patterns and correlations\n`;
    prompt += `4. Provide unified recommendations based on all analyses\n`;
    prompt += `5. Maintain focus on ${task.focusArea} for ${context.tenantData.tenant.name}\n`;

    if (task.executiveSummary) {
      prompt += `6. Include executive-level summary suitable for board presentation\n`;
    }

    return prompt;
  }

  /**
   * Calculate confidence for synthesized results
   */
  calculateSynthesisConfidence(agentResults) {
    if (agentResults.length === 0) return 0.5;

    const confidences = agentResults
      .map(r => r.result.confidence || 0.7)
      .filter(c => c > 0);

    if (confidences.length === 0) return 0.7;

    // Weighted average with bonus for multiple agents
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const consensusBonus = Math.min(0.1, (agentResults.length - 1) * 0.05);
    
    return Math.min(0.95, avgConfidence + consensusBonus);
  }

  /**
   * Extract synthesis summary
   */
  extractSynthesisSummary(synthesizedInsights, agentResults) {
    // Look for synthesis-specific summary
    const lines = synthesizedInsights.split('\n');
    const summaryLine = lines.find(line => 
      line.toLowerCase().includes('synthesis') || 
      line.toLowerCase().includes('integrated') ||
      line.toLowerCase().includes('unified')
    );

    if (summaryLine) {
      return summaryLine.replace(/[#*-]/g, '').trim().substring(0, 200);
    }

    // Fallback: create summary from agent count and focus
    const agentNames = agentResults.map(r => r.agent).join(', ');
    return `Synthesized analysis from ${agentResults.length} specialized agents: ${agentNames}`;
  }

  /**
   * Select best result when synthesis fails
   */
  selectBestResult(agentResults) {
    return agentResults.reduce((best, current) => {
      const currentConfidence = current.result.confidence || 0;
      const bestConfidence = best.result.confidence || 0;
      return currentConfidence > bestConfidence ? current : best;
    });
  }

  /**
   * Format agent result for consistent output
   */
  formatAgentResult(result, task, context) {
    return {
      content: result.content,
      confidence: result.confidence,
      summary: result.summary,
      agent: result.agent,
      specialization: result.specialization,
      toolsUsed: result.toolsUsed || [],
      agentMode: true,
      timestamp: result.timestamp || Date.now()
    };
  }

  /**
   * Fallback to direct LLM when agents unavailable
   */
  async fallbackToDirectLLM(task, context) {
    console.log('[Orchestrator] Falling back to direct LLM');

    return await this.llmClient.generateInsights({
      tenantData: context.tenantData,
      focusArea: task.focusArea,
      insightType: task.insightType,
      executiveSummary: task.executiveSummary,
      agentContext: {
        fallback: true,
        reason: 'Agents unavailable'
      }
    });
  }

  /**
   * Emergency fallback for critical failures
   */
  async emergencyFallback(request, originalError) {
    console.log('[Orchestrator] Emergency fallback activated');

    return {
      content: `GRC analysis temporarily unavailable. Please try again shortly.\n\nError: ${originalError.message}`,
      confidence: 0.3,
      summary: 'System temporarily unavailable',
      emergency: true,
      error: originalError.message,
      timestamp: Date.now()
    };
  }

  /**
   * Utility methods
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  determinePriority(insightType) {
    const priorities = {
      'alerts': 'high',
      'predictions': 'medium',
      'recommendations': 'medium',
      'summary': 'low'
    };
    return priorities[insightType] || 'low';
  }

  /**
   * Get orchestrator statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeWorkflows: this.activeWorkflows.size,
      availableAgents: Object.keys(this.agents).length,
      agentStats: Object.fromEntries(
        Object.entries(this.agents).map(([name, agent]) => [name, agent.getStats()])
      )
    };
  }

  /**
   * Health check
   */
  isHealthy() {
    const hasAgents = Object.keys(this.agents).length > 0;
    const hasLLM = this.llmClient !== null;
    const hasMCP = this.mcpClient !== null;
    
    return hasAgents && hasLLM && hasMCP;
  }

  /**
   * Enable/disable agent mode
   */
  setAgentMode(enabled) {
    this.config.enableAgents = enabled;
    console.log(`[Orchestrator] Agent mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Circuit breaker methods
   */
  isCircuitClosed() {
    const now = Date.now();
    
    if (this.circuitBreaker.state === 'OPEN') {
      // Check if enough time has passed to try half-open
      if (this.circuitBreaker.lastFailureTime && 
          (now - this.circuitBreaker.lastFailureTime) > 60000) { // 1 minute cooldown
        this.circuitBreaker.state = 'HALF_OPEN';
        console.log('[Orchestrator] Circuit breaker moving to HALF_OPEN');
        return true;
      }
      return false;
    }
    
    return this.circuitBreaker.state !== 'OPEN';
  }

  recordSuccess() {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failureCount = 0;
      console.log('[Orchestrator] Circuit breaker CLOSED - agents restored');
    }
  }

  recordFailure() {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
      this.circuitBreaker.state = 'OPEN';
      console.warn(`[Orchestrator] Circuit breaker OPEN - ${this.circuitBreaker.failureCount} failures detected`);
    }
  }

  resetCircuitBreaker() {
    this.circuitBreaker.state = 'CLOSED';
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.lastFailureTime = null;
    console.log('[Orchestrator] Circuit breaker manually reset');
  }
}

export default GRCOrchestrator;