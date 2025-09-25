// Audit and compliance types for platform-integrated logging
export interface AuditEvent {
  id: string;
  tenantId: string;
  userId: string;
  timestamp: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'warning';
  ipAddress: string;
  userAgent: string;
  correlationId: string;
  complianceRelevant: boolean;
}

export type AuditAction = 
  | 'agent.created'
  | 'agent.updated' 
  | 'agent.deleted'
  | 'agent.enabled'
  | 'agent.disabled'
  | 'tool.executed'
  | 'llm.query'
  | 'llm.response'
  | 'user.login'
  | 'user.logout'
  | 'settings.updated'
  | 'data.accessed'
  | 'data.exported'
  | 'quota.exceeded';

export interface ComplianceReport {
  id: string;
  tenantId: string;
  framework: 'ISO27001' | 'CPS230' | 'SOC2' | 'GDPR';
  period: {
    start: string;
    end: string;
  };
  status: 'compliant' | 'non-compliant' | 'partial';
  score: number;
  findings: ComplianceFinding[];
  recommendations: string[];
  generatedAt: string;
  approvedBy?: string;
}

export interface ComplianceFinding {
  id: string;
  control: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
  remediation: string;
  dueDate?: string;
  assignedTo?: string;
  status: 'open' | 'in-progress' | 'resolved' | 'risk-accepted';
}

export interface RiskAssessment {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  category: 'operational' | 'security' | 'compliance' | 'financial';
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  riskScore: number;
  mitigation: string;
  owner: string;
  reviewDate: string;
  status: 'identified' | 'assessed' | 'mitigated' | 'accepted';
  createdAt: string;
  updatedAt: string;
}

export interface AuditFilter {
  tenantId?: string;
  userId?: string;
  actions?: AuditAction[];
  dateRange?: {
    start: string;
    end: string;
  };
  outcome?: ('success' | 'failure' | 'warning')[];
  complianceRelevant?: boolean;
  resource?: string;
}

export interface AuditSummary {
  totalEvents: number;
  successRate: number;
  topActions: { action: AuditAction; count: number }[];
  riskEvents: number;
  complianceEvents: number;
  timeRange: {
    start: string;
    end: string;
  };
}