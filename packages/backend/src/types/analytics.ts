/**
 * Analytics Types for Real-Time GRC Dashboard Backend
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
    nextAssessmentDue?: Date;
  }>;
  criticalGaps: Array<{
    area?: string;
    controlId?: string;
    framework?: string;
    category?: string;
    description?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    count?: number;
    dueDate?: Date;
    remediationActions?: string;
  }>;
  complianceTrend?: Array<{
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
    count?: number;
    total: number;
    effective: number;
    effectiveness?: number;
    failed: number;
  }>;
  recentFailures?: Array<{
    id: string;
    name: string;
    type: string;
    failureDate: Date;
    impact: 'low' | 'medium' | 'high' | 'critical';
  }>;
  recentTests?: Array<{
    controlId: string;
    controlName: string;
    testDate: Date;
    result: string;
    tester: string;
    notes: string;
  }>;
}

export interface PredictiveInsights {
  tenantId: string;
  generatedAt: Date;
  predictions: Array<{
    type: 'risk_trend' | 'compliance_gap' | 'control_failure';
    prediction: string;
    confidence: number;
    timeframe: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    recommendations: string[];
  }>;
  modelInfo: {
    version: string;
    lastTrained: Date;
    dataPoints: number;
    accuracy: number;
  };
  riskPredictions?: Array<{
    riskId: string;
    riskTitle: string;
    currentScore: number;
    predictedScore: number;
    timeHorizon: string;
    confidence: number;
    factors: string[];
  }>;
  complianceAlerts?: Array<{
    framework: string;
    requirement: string;
    currentStatus: string;
    predictedStatus: string;
    alertDate: Date;
    confidence: number;
  }>;
  systemAnomalies?: Array<{
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

export interface MLModel {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'anomaly_detection' | 'risk_prediction' | 'compliance_scoring' | 'control_effectiveness';
  status: 'active' | 'inactive' | 'training' | 'error';
  accuracy: number;
  lastTrained: Date;
  dataPoints: number;
  features?: string[];
  target?: string;
  version: string;
  metrics?: {
    precision?: number;
    recall?: number;
    f1Score?: number;
    auc?: number;
    mse?: number;
    rmse?: number;
    r2?: number;
    mae?: number;
    specificity?: number;
  };
  precision?: number;
  recall?: number;
  f1Score?: number;
  nextTraining?: Date;
  inferenceTime?: number;
  resourceUsage?: {
    cpu: number;
    memory: number;
    storage: number;
  };
  trainingHistory?: Array<{
    date: Date;
    accuracy: number;
    loss: number;
    epochs: number;
  }>;
  description?: string;
  framework?: 'tensorflow' | 'pytorch' | 'scikit-learn' | 'xgboost';
}

// Additional backend-specific types
export interface AnalyticsQuery {
  tenantId: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  filters?: {
    eventTypes?: string[];
    riskCategories?: string[];
    complianceFrameworks?: string[];
    severity?: string[];
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface DatabaseConnection {
  cosmosClient?: any;
  redisClient?: any;
  isConnected: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  tenantId?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface WebSocketMessage {
  type: 'metrics_update' | 'event_stream' | 'alert' | 'system_status';
  tenantId: string;
  data: any;
  timestamp: Date;
}