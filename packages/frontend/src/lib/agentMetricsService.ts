// No imports needed for this service

export interface AgentMetrics {
  agentId: string;
  successRate: number;
  totalExecutions: number;
  averageExecutionTime: number; // in seconds
  lastExecution?: string;
  executionHistory: AgentExecution[];
  toolsUsed: string[];
}

export interface AgentExecution {
  id: string;
  timestamp: string;
  success: boolean;
  executionTime: number;
  toolsUsed: string[];
  errorMessage?: string;
}

export class AgentMetricsService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Get metrics for a specific agent
   */
  getAgentMetrics(agentId: string): AgentMetrics {
    const allMetrics = this.loadAllMetrics();
    
    if (!allMetrics[agentId]) {
      // Generate initial sample data for new agents
      allMetrics[agentId] = this.generateSampleMetrics(agentId);
      this.saveAllMetrics(allMetrics);
    }

    return allMetrics[agentId];
  }

  /**
   * Get metrics for all agents
   */
  getAllAgentMetrics(): Record<string, AgentMetrics> {
    return this.loadAllMetrics();
  }

  /**
   * Record a new execution for an agent
   */
  recordExecution(agentId: string, execution: Omit<AgentExecution, 'id'>): void {
    const allMetrics = this.loadAllMetrics();
    const agentMetrics = allMetrics[agentId] || this.generateSampleMetrics(agentId);

    // Add new execution
    const newExecution: AgentExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...execution
    };

    agentMetrics.executionHistory.push(newExecution);
    
    // Keep only last 100 executions
    if (agentMetrics.executionHistory.length > 100) {
      agentMetrics.executionHistory = agentMetrics.executionHistory.slice(-100);
    }

    // Update aggregate metrics
    this.recalculateMetrics(agentMetrics);
    
    allMetrics[agentId] = agentMetrics;
    this.saveAllMetrics(allMetrics);
  }

  /**
   * Generate realistic sample metrics for demonstration
   */
  public generateSampleMetrics(agentId: string): AgentMetrics {
    const agentProfiles = {
      'risk-specialist': {
        baseSuccessRate: 87,
        avgExecutions: 234,
        avgTime: 3.2,
        tools: ['get_risk_summary', 'forecast_risk_trajectory', 'detect_anomalies', 'analyze_grc_data']
      },
      'compliance-auditor': {
        baseSuccessRate: 92,
        avgExecutions: 156,
        avgTime: 2.8,
        tools: ['analyze_grc_data', 'detect_anomalies']
      },
      'grc-analyst': {
        baseSuccessRate: 89,
        avgExecutions: 198,
        avgTime: 2.1,
        tools: ['analyze_grc_data', 'generate_insights']
      },
      'executive-advisor': {
        baseSuccessRate: 94,
        avgExecutions: 89,
        avgTime: 4.5,
        tools: ['analyze_grc_data', 'generate_insights']
      }
    };

    // Determine profile based on agent ID or use default
    const profileKey = Object.keys(agentProfiles).find(key => 
      agentId.toLowerCase().includes(key.replace('-', ''))
    ) as keyof typeof agentProfiles;
    
    const profile = profileKey ? agentProfiles[profileKey] : agentProfiles['grc-analyst'];

    const executionHistory: AgentExecution[] = [];
    const now = new Date();
    
    // Generate execution history over the past 30 days
    for (let i = 0; i < profile.avgExecutions; i++) {
      const daysAgo = Math.random() * 30;
      const timestamp = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      
      const success = Math.random() < (profile.baseSuccessRate / 100);
      const executionTime = profile.avgTime + (Math.random() - 0.5) * 2; // ±1 second variation
      
      executionHistory.push({
        id: `exec-${i}-${agentId}`,
        timestamp: timestamp.toISOString(),
        success,
        executionTime: Math.max(0.1, executionTime),
        toolsUsed: this.sampleTools(profile.tools),
        errorMessage: success ? undefined : this.generateErrorMessage()
      });
    }

    // Sort by timestamp (oldest first)
    executionHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const metrics: AgentMetrics = {
      agentId,
      successRate: profile.baseSuccessRate,
      totalExecutions: profile.avgExecutions,
      averageExecutionTime: profile.avgTime,
      lastExecution: executionHistory.length > 0 ? executionHistory[executionHistory.length - 1].timestamp : undefined,
      executionHistory,
      toolsUsed: profile.tools
    };

    return metrics;
  }

  private sampleTools(availableTools: string[]): string[] {
    const count = Math.floor(Math.random() * availableTools.length) + 1;
    const shuffled = [...availableTools].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private generateErrorMessage(): string {
    const errors = [
      'Tool execution timeout',
      'MCP server connection failed',
      'Invalid parameters provided',
      'Data source temporarily unavailable',
      'Rate limit exceeded',
      'Authentication failed',
      'Network connectivity issue'
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  }

  /**
   * Recalculate aggregate metrics from execution history
   */
  private recalculateMetrics(agentMetrics: AgentMetrics): void {
    const { executionHistory } = agentMetrics;
    
    if (executionHistory.length === 0) return;

    const successfulExecutions = executionHistory.filter(e => e.success);
    agentMetrics.successRate = Math.round((successfulExecutions.length / executionHistory.length) * 100);
    agentMetrics.totalExecutions = executionHistory.length;
    
    const totalTime = executionHistory.reduce((sum, e) => sum + e.executionTime, 0);
    agentMetrics.averageExecutionTime = Math.round((totalTime / executionHistory.length) * 10) / 10;
    
    agentMetrics.lastExecution = executionHistory[executionHistory.length - 1]?.timestamp;
    
    // Update tools used (unique tools from recent executions)
    const recentExecutions = executionHistory.slice(-20); // Last 20 executions
    const allTools = recentExecutions.flatMap(e => e.toolsUsed);
    agentMetrics.toolsUsed = [...new Set(allTools)];
  }

  /**
   * Get aggregated platform statistics
   */
  getPlatformStats(): {
    totalAgents: number;
    activeAgents: number;
    totalExecutions: number;
    averageSuccessRate: number;
  } {
    const allMetrics = this.loadAllMetrics();
    const metricsArray = Object.values(allMetrics);
    
    if (metricsArray.length === 0) {
      return {
        totalAgents: 0,
        activeAgents: 0,
        totalExecutions: 0,
        averageSuccessRate: 0
      };
    }

    const totalExecutions = metricsArray.reduce((sum, m) => sum + m.totalExecutions, 0);
    const totalSuccessRate = metricsArray.reduce((sum, m) => sum + m.successRate, 0);
    
    // Consider agents active if they've executed in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeAgents = metricsArray.filter(m => 
      m.lastExecution && new Date(m.lastExecution) > oneDayAgo
    ).length;

    return {
      totalAgents: metricsArray.length,
      activeAgents,
      totalExecutions,
      averageSuccessRate: Math.round((totalSuccessRate / metricsArray.length) * 10) / 10
    };
  }

  /**
   * Simulate agent activity (for demo purposes)
   */
  simulateActivity(agentId: string): void {
    const tools = ['get_risk_summary', 'analyze_grc_data', 'detect_anomalies', 'generate_insights'];
    const success = Math.random() > 0.1; // 90% success rate
    const executionTime = 1 + Math.random() * 4; // 1-5 seconds

    this.recordExecution(agentId, {
      timestamp: new Date().toISOString(),
      success,
      executionTime,
      toolsUsed: this.sampleTools(tools),
      errorMessage: success ? undefined : this.generateErrorMessage()
    });
  }

  private loadAllMetrics(): Record<string, AgentMetrics> {
    const storageKey = `agent_metrics_${this.tenantId}`;
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : {};
  }

  private saveAllMetrics(metrics: Record<string, AgentMetrics>): void {
    const storageKey = `agent_metrics_${this.tenantId}`;
    localStorage.setItem(storageKey, JSON.stringify(metrics));
  }
}

// Export factory function
export const createAgentMetricsService = (tenantId: string) => {
  return new AgentMetricsService(tenantId);
};