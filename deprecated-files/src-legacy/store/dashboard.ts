// Dashboard state management with tenant-scoped data
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { AgentConfiguration, McpQuery, HealthStatus } from '@/types/mcp';
import { AuditEvent, RiskAssessment, ComplianceReport } from '@/types/audit';

interface DashboardState {
  // Current view state
  activeView: 'executive' | 'operational' | 'audit';
  sidebarCollapsed: boolean;
  
  // MCP Agent data
  agents: AgentConfiguration[];
  agentHealth: Record<string, HealthStatus>;
  recentQueries: McpQuery[];
  
  // GRC data
  riskAssessments: RiskAssessment[];
  complianceReports: ComplianceReport[];
  recentAuditEvents: AuditEvent[];
  
  // Real-time metrics
  metrics: DashboardMetrics;
  isLoadingMetrics: boolean;
  
  // Actions
  setActiveView: (view: 'executive' | 'operational' | 'audit') => void;
  toggleSidebar: () => void;
  loadDashboardData: (tenantId: string) => Promise<void>;
  refreshMetrics: (tenantId: string) => Promise<void>;
  updateAgentHealth: (agentId: string, health: HealthStatus) => void;
}

interface DashboardMetrics {
  totalAgents: number;
  activeAgents: number;
  healthyAgents: number;
  todayQueries: number;
  weeklyGrowth: number;
  averageResponseTime: number;
  tokenUsage: {
    current: number;
    limit: number;
    percentage: number;
  };
  apiCalls: {
    current: number;
    limit: number;
    percentage: number;
  };
  riskScore: number;
  complianceScore: number;
  criticalFindings: number;
  openRisks: number;
}

// Mock data generators
const generateMockAgents = (tenantId: string): AgentConfiguration[] => [
  {
    tenantId,
    agentId: 'agent-grc-analyzer',
    name: 'GRC Risk Analyzer',
    description: 'AI agent for analyzing governance, risk, and compliance data',
    enabledTools: ['archer-connector', 'risk-calculator', 'compliance-checker'],
    llmConfig: {
      provider: 'azure-openai',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000,
    },
    auditLevel: 'enhanced',
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerHour: 50000,
      dailyBudget: 100,
    },
    isActive: true,
    createdAt: '2024-07-15T10:00:00Z',
    updatedAt: '2024-08-19T09:00:00Z',
  },
  {
    tenantId,
    agentId: 'agent-compliance-monitor',
    name: 'Compliance Monitor',
    description: 'Continuous monitoring of compliance requirements and controls',
    enabledTools: ['archer-connector', 'compliance-checker', 'audit-trail'],
    llmConfig: {
      provider: 'azure-openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.2,
      maxTokens: 1500,
    },
    auditLevel: 'full',
    rateLimits: {
      requestsPerMinute: 30,
      tokensPerHour: 25000,
      dailyBudget: 50,
    },
    isActive: true,
    createdAt: '2024-08-01T14:30:00Z',
    updatedAt: '2024-08-19T08:30:00Z',
  },
  {
    tenantId,
    agentId: 'agent-risk-reporter',
    name: 'Risk Reporter',
    description: 'Generates risk assessment reports and insights',
    enabledTools: ['risk-calculator', 'report-generator'],
    llmConfig: {
      provider: 'azure-openai',
      model: 'gpt-4',
      temperature: 0.1,
      maxTokens: 3000,
    },
    auditLevel: 'basic',
    rateLimits: {
      requestsPerMinute: 20,
      tokensPerHour: 30000,
      dailyBudget: 75,
    },
    isActive: false,
    createdAt: '2024-06-20T11:15:00Z',
    updatedAt: '2024-08-10T16:20:00Z',
  },
];

const generateMockMetrics = (_tenantId: string): DashboardMetrics => ({
  totalAgents: 3,
  activeAgents: 2,
  healthyAgents: 2,
  todayQueries: 47,
  weeklyGrowth: 12.5,
  averageResponseTime: 850,
  tokenUsage: {
    current: 245000,
    limit: 1000000,
    percentage: 24.5,
  },
  apiCalls: {
    current: 2847,
    limit: 10000,
    percentage: 28.47,
  },
  riskScore: 7.2,
  complianceScore: 94.8,
  criticalFindings: 3,
  openRisks: 12,
});

const generateMockRecentQueries = (tenantId: string): McpQuery[] => [
  {
    id: 'query-001',
    tenantId,
    agentId: 'agent-grc-analyzer',
    query: 'What are the current high-risk findings in our ISO 27001 assessment?',
    response: {
      content: 'I found 3 high-risk findings in your current ISO 27001 assessment: 1) Inadequate access control reviews (A.9.2.5), 2) Missing encryption for data in transit (A.10.1.1), 3) Incomplete incident response documentation (A.16.1.2). Each requires immediate attention to maintain compliance.',
      confidence: 0.92,
      toolsUsed: ['archer-connector', 'compliance-checker'],
      evidence: [
        {
          source: 'Archer GRC Platform',
          excerpt: 'Control A.9.2.5: Last review completed 14 months ago',
          relevanceScore: 0.95,
          metadata: { controlId: 'A.9.2.5', lastReview: '2023-06-15' },
        },
      ],
      complianceFlags: [
        {
          framework: 'ISO27001',
          rule: 'A.9.2.5',
          severity: 'critical',
          description: 'Access control review exceeds maximum allowed interval',
        },
      ],
      tokenUsage: {
        promptTokens: 150,
        completionTokens: 280,
        totalTokens: 430,
        cost: 0.0086,
      },
    },
    status: 'completed',
    timestamp: '2024-08-19T09:15:00Z',
    userId: 'user-001',
  },
  {
    id: 'query-002',
    tenantId,
    agentId: 'agent-compliance-monitor',
    query: 'Generate a summary of this quarter\'s compliance posture',
    status: 'processing',
    timestamp: '2024-08-19T09:45:00Z',
    userId: 'user-002',
  },
];

export const useDashboardStore = create<DashboardState>()(
  subscribeWithSelector((set, get) => ({
    activeView: 'executive',
    sidebarCollapsed: false,
    agents: [],
    agentHealth: {},
    recentQueries: [],
    riskAssessments: [],
    complianceReports: [],
    recentAuditEvents: [],
    metrics: {
      totalAgents: 0,
      activeAgents: 0,
      healthyAgents: 0,
      todayQueries: 0,
      weeklyGrowth: 0,
      averageResponseTime: 0,
      tokenUsage: { current: 0, limit: 0, percentage: 0 },
      apiCalls: { current: 0, limit: 0, percentage: 0 },
      riskScore: 0,
      complianceScore: 0,
      criticalFindings: 0,
      openRisks: 0,
    },
    isLoadingMetrics: false,

    setActiveView: (view) => set({ activeView: view }),
    
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    loadDashboardData: async (tenantId: string) => {
      set({ isLoadingMetrics: true });
      
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const agents = generateMockAgents(tenantId);
        const metrics = generateMockMetrics(tenantId);
        const recentQueries = generateMockRecentQueries(tenantId);
        
        // Generate health status for each agent
        const agentHealth: Record<string, HealthStatus> = {};
        agents.forEach(agent => {
          agentHealth[agent.agentId] = {
            status: agent.isActive ? 'healthy' : 'unhealthy',
            lastCheck: new Date().toISOString(),
            responseTime: Math.floor(Math.random() * 2000) + 200,
            errorCount: Math.floor(Math.random() * 5),
            uptime: Math.random() * 0.1 + 0.9, // 90-100% uptime
          };
        });
        
        set({
          agents,
          agentHealth,
          recentQueries,
          metrics,
          isLoadingMetrics: false,
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        set({ isLoadingMetrics: false });
      }
    },

    refreshMetrics: async (_tenantId: string) => {
      const currentMetrics = get().metrics;
      
      try {
        // Simulate real-time metric updates
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const updatedMetrics: DashboardMetrics = {
          ...currentMetrics,
          todayQueries: currentMetrics.todayQueries + Math.floor(Math.random() * 3),
          averageResponseTime: currentMetrics.averageResponseTime + (Math.random() - 0.5) * 100,
          tokenUsage: {
            ...currentMetrics.tokenUsage,
            current: Math.min(
              currentMetrics.tokenUsage.current + Math.floor(Math.random() * 1000),
              currentMetrics.tokenUsage.limit
            ),
          },
        };
        
        // Recalculate percentages
        updatedMetrics.tokenUsage.percentage = 
          (updatedMetrics.tokenUsage.current / updatedMetrics.tokenUsage.limit) * 100;
        
        set({ metrics: updatedMetrics });
      } catch (error) {
        console.error('Failed to refresh metrics:', error);
      }
    },

    updateAgentHealth: (agentId: string, health: HealthStatus) => {
      set((state) => ({
        agentHealth: {
          ...state.agentHealth,
          [agentId]: health,
        },
      }));
    },
  }))
);