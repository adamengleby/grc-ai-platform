/**
 * Event Streaming Types for GRC Platform
 * Defines data structures for real-time event processing
 */

export interface GRCEvent {
  id: string;
  tenantId: string;
  eventType: EventType;
  source: EventSource;
  timestamp: Date;
  userId?: string;
  entityId?: string;
  entityType?: string;
  action: EventAction;
  data: Record<string, any>;
  metadata: EventMetadata;
}

export enum EventType {
  // Core GRC Events
  RISK_CREATED = 'risk.created',
  RISK_UPDATED = 'risk.updated',
  RISK_DELETED = 'risk.deleted',
  RISK_STATUS_CHANGED = 'risk.status_changed',
  
  // Control Events
  CONTROL_CREATED = 'control.created',
  CONTROL_UPDATED = 'control.updated',
  CONTROL_TESTED = 'control.tested',
  CONTROL_FAILED = 'control.failed',
  
  // Assessment Events
  ASSESSMENT_STARTED = 'assessment.started',
  ASSESSMENT_COMPLETED = 'assessment.completed',
  ASSESSMENT_OVERDUE = 'assessment.overdue',
  
  // Incident Events
  INCIDENT_CREATED = 'incident.created',
  INCIDENT_ESCALATED = 'incident.escalated',
  INCIDENT_RESOLVED = 'incident.resolved',
  
  // Compliance Events
  COMPLIANCE_GAP_DETECTED = 'compliance.gap_detected',
  COMPLIANCE_STATUS_CHANGED = 'compliance.status_changed',
  POLICY_VIOLATION = 'policy.violation',
  
  // User Events
  USER_LOGIN = 'user.login',
  USER_ACTION = 'user.action',
  USER_PERMISSION_CHANGED = 'user.permission_changed',
  
  // System Events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_PERFORMANCE = 'system.performance',
  DATA_ANOMALY = 'data.anomaly'
}

export enum EventSource {
  ARCHER_GRC = 'archer_grc',
  MCP_SERVER = 'mcp_server',
  FRONTEND_APP = 'frontend_app',
  BACKEND_API = 'backend_api',
  SCHEDULER = 'scheduler',
  ANALYTICS_ENGINE = 'analytics_engine',
  COMPLIANCE_SCANNER = 'compliance_scanner'
}

export enum EventAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  READ = 'read',
  EXECUTE = 'execute',
  APPROVE = 'approve',
  REJECT = 'reject',
  ESCALATE = 'escalate'
}

export interface EventMetadata {
  version: string;
  correlationId?: string;
  causationId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  processingTime?: number;
  retryCount?: number;
  tags?: string[];
}

// Streaming Configuration
export interface StreamConfig {
  tenantId: string;
  enabled: boolean;
  topics: string[];
  filters: EventFilter[];
  destinations: StreamDestination[];
  retentionDays: number;
  batchSize: number;
  compressionEnabled: boolean;
}

export interface EventFilter {
  eventTypes: EventType[];
  sources: EventSource[];
  conditions: Record<string, any>;
}

export interface StreamDestination {
  type: 'kafka' | 'eventhub' | 'redis' | 'webhook' | 'database';
  config: Record<string, any>;
  enabled: boolean;
}

// Analytics Events
export interface RiskAnalyticsEvent extends GRCEvent {
  data: {
    riskScore: number;
    riskCategory: string;
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    likelihoodLevel: 'low' | 'medium' | 'high' | 'critical';
    controlEffectiveness: number;
    residualRisk: number;
    trends: {
      direction: 'increasing' | 'decreasing' | 'stable';
      velocity: number;
      confidence: number;
    };
  };
}

export interface ComplianceEvent extends GRCEvent {
  data: {
    framework: string;
    requirement: string;
    status: 'compliant' | 'non_compliant' | 'partial' | 'unknown';
    gapSeverity: 'low' | 'medium' | 'high' | 'critical';
    evidenceCount: number;
    lastAssessment: Date;
    nextDueDate: Date;
    remediation: {
      required: boolean;
      timeline: number; // days
      assigned: string[];
    };
  };
}

// Stream Processing Results
export interface StreamProcessingResult {
  eventId: string;
  tenantId: string;
  processingTime: Date;
  success: boolean;
  destinations: {
    type: string;
    success: boolean;
    error?: string;
    latency: number;
  }[];
  transformations: string[];
  enrichments: Record<string, any>;
}

// Real-time Analytics
export interface RealTimeMetrics {
  tenantId: string;
  timestamp: Date;
  metrics: {
    eventsPerSecond: number;
    totalEventsToday: number;
    errorRate: number;
    averageProcessingTime: number;
    topEventTypes: Array<{
      type: EventType;
      count: number;
      percentage: number;
    }>;
    riskTrends: {
      highRiskIncreasing: number;
      criticalIncidents: number;
      complianceGaps: number;
      controlFailures: number;
    };
  };
}