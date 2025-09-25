/**
 * Analytics Types for Real-Time GRC Dashboard
 */

export interface RealTimeMetrics {
  tenantId: string;
  timestamp: Date;
  metrics: {
    eventsPerSecond: number;
    totalEventsToday: number;
    errorRate: number;
    averageProcessingTime: number;
    topEventTypes: Array<{
      type: string;
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

export interface RiskAnalytics {
  totalRisks: number;
  highRisks: number;
  criticalRisks: number;
  riskTrend: 'increasing' | 'decreasing' | 'stable';
  riskDistribution: Array<{
    category: string;
    count: number;
    averageScore: number;
  }>;
  topRisks: Array<{
    id: string;
    title: string;
    score: number;
    category: string;
    lastUpdated: Date;
    trend: 'up' | 'down' | 'stable';
  }>;
}

export interface ComplianceAnalytics {
  overallScore: number;
  trend: 'improving' | 'declining' | 'stable';
  frameworks: Array<{
    name: string;
    description: string;
    complianceScore: number;
    status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'not_assessed';
    compliantControls: number;
    partiallyCompliantControls: number;
    nonCompliantControls: number;
    notAssessedControls: number;
    lastAssessment: Date;
    nextAssessmentDue: Date;
  }>;
  criticalGaps: Array<{
    controlId: string;
    framework: string;
    category: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    dueDate: Date;
    remediationActions: string;
  }>;
  complianceTrend: Array<{
    date: Date;
    score: number;
  }>;
}

export interface ControlAnalytics {
  totalControls: number;
  effectiveControls: number;
  failedControls: number;
  controlEffectiveness: number;
  controlsByType: Array<{
    type: string;
    total: number;
    effective: number;
    failed: number;
  }>;
  recentFailures: Array<{
    id: string;
    name: string;
    type: string;
    failureDate: Date;
    impact: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface PredictiveInsights {
  riskPredictions: Array<{
    riskId: string;
    riskTitle: string;
    currentScore: number;
    predictedScore: number;
    timeHorizon: string; // "7 days", "30 days", etc.
    confidence: number;
    factors: string[];
  }>;
  complianceAlerts: Array<{
    framework: string;
    requirement: string;
    currentStatus: string;
    predictedStatus: string;
    alertDate: Date;
    confidence: number;
  }>;
  systemAnomalies: Array<{
    type: 'performance' | 'security' | 'compliance';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    detectedAt: Date;
    affectedSystems: string[];
  }>;
}

export interface EventStream {
  id: string;
  tenantId: string;
  eventType: string;
  source: string;
  timestamp: Date;
  description: string;
  entityId?: string;
  entityType?: string;
  action: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'info';
}

export interface DashboardConfig {
  tenantId: string;
  refreshInterval: number; // milliseconds
  autoRefresh: boolean;
  widgets: Array<{
    id: string;
    type: 'risk-overview' | 'compliance-status' | 'control-health' | 'event-stream' | 'predictions';
    position: { x: number; y: number };
    size: { width: number; height: number };
    config: Record<string, any>;
    visible: boolean;
  }>;
  filters: {
    timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
    eventTypes: string[];
    riskCategories: string[];
    complianceFrameworks: string[];
  };
}

export interface AlertConfig {
  id: string;
  tenantId: string;
  name: string;
  type: 'risk' | 'compliance' | 'control' | 'system';
  conditions: Array<{
    metric: string;
    operator: '>' | '<' | '=' | '!=' | '>=' | '<=';
    value: number | string;
  }>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notifications: Array<{
    type: 'email' | 'sms' | 'webhook' | 'in-app';
    config: Record<string, any>;
  }>;
  enabled: boolean;
  created: Date;
  lastTriggered?: Date;
}

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
  label: string;
}

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
  category?: string;
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number; // percentage change
  confidence: number; // 0-1
  significance: 'low' | 'medium' | 'high';
}

export interface MLModel {
  id: string;
  name: string;
  type: 'risk_prediction' | 'anomaly_detection' | 'compliance_scoring' | 'control_effectiveness';
  status: 'active' | 'inactive' | 'training' | 'error';
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lastTrained: Date;
  nextTraining: Date;
  version: string;
  dataPoints: number;
  inferenceTime: number; // in milliseconds
  resourceUsage: {
    cpu: number; // percentage
    memory: number; // MB
    storage: number; // MB
  };
  trainingHistory: Array<{
    date: Date;
    accuracy: number;
    loss: number;
    epochs: number;
  }>;
  description: string;
  framework: 'tensorflow' | 'pytorch' | 'scikit-learn' | 'xgboost';
}