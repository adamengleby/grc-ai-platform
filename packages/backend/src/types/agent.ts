export interface AIAgent {
  id: string;
  name: string;
  description: string;
  persona: string; // The agent's behavior/personality
  systemPrompt: string; // Instructions for how the agent should behave
  
  // LLM Configuration
  llmConfigId: string; // Reference to LLM configuration
  
  // MCP Server Access
  enabledMcpServers: string[]; // List of MCP server IDs this agent can use
  
  // Agent Settings
  capabilities: string[]; // What this agent is good at
  useCase: string; // Primary use case (risk-analysis, compliance-audit, etc.)
  
  // Metadata
  isEnabled: boolean;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  
  // Visual
  avatar?: string; // Icon or avatar for the agent
  color?: string; // Theme color for the agent
  
  // Performance Metrics
  metrics?: AgentMetrics;
}

export interface AgentMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number; // Percentage
  averageExecutionTime: number; // In seconds
  lastExecutionTime?: number; // In seconds
  lastExecutionAt?: string; // ISO timestamp
  executionHistory: AgentExecution[];
}

export interface AgentExecution {
  id: string;
  agentId: string;
  timestamp: string;
  duration: number; // In seconds
  status: 'success' | 'failure' | 'timeout' | 'error';
  prompt: string;
  response?: string;
  error?: string;
  mcpToolsUsed: string[];
  tokensUsed?: number;
}