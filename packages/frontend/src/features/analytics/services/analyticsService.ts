/**
 * Analytics Service - Connects to Event Streaming Infrastructure
 */

import { io, Socket } from 'socket.io-client';
import { 
  RealTimeMetrics, 
  RiskAnalytics, 
  ComplianceAnalytics, 
  ControlAnalytics,
  PredictiveInsights,
  EventStream,
  AnalyticsTimeRange,
  MLModel
} from '../types';

export class AnalyticsService {
  private baseUrl: string;
  private socketConnections: Map<string, Socket> = new Map();
  // Removed unused eventListeners property

  constructor() {
    // Use environment-specific backend API server
    const isDevelopment = import.meta.env.DEV;

    if (isDevelopment) {
      this.baseUrl = import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:3005/api/v1';
    } else {
      // In production, use the Azure Functions backend
      this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/api/v1';
    }
  }

  /**
   * Get real-time metrics for tenant
   */
  async getRealTimeMetrics(tenantId: string): Promise<RealTimeMetrics> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/metrics`);
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
      // Return mock data for development
      return this.getMockRealTimeMetrics(tenantId);
    }
  }

  /**
   * Get recent events for tenant
   */
  async getRecentEvents(
    tenantId: string, 
    options: {
      limit?: number;
      eventType?: string;
      source?: string;
      timeRange?: AnalyticsTimeRange;
    } = {}
  ): Promise<EventStream[]> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', options.limit.toString());
      if (options.eventType) params.set('eventType', options.eventType);
      if (options.source) params.set('source', options.source);

      const response = await fetch(`${this.baseUrl}/analytics/events?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
      }
      
      const result = await response.json();
      const data = result.data;
      return data.map((event: any) => ({
        ...event,
        timestamp: new Date(event.timestamp)
      }));
    } catch (error) {
      console.error('Error fetching events:', error);
      return this.getMockEventStream(tenantId);
    }
  }

  /**
   * Get risk analytics
   */
  async getRiskAnalytics(_tenantId: string, _timeRange: AnalyticsTimeRange): Promise<RiskAnalytics> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/risk`);
      if (!response.ok) {
        throw new Error(`Failed to fetch risk analytics: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching risk analytics:', error);
      return this.getMockRiskAnalytics();
    }
  }

  /**
   * Get compliance analytics
   */
  async getComplianceAnalytics(_tenantId: string, _timeRange: AnalyticsTimeRange): Promise<ComplianceAnalytics> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/compliance`);
      if (!response.ok) throw new Error('Failed to fetch compliance analytics');
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching compliance analytics:', error);
      return this.getMockComplianceAnalytics();
    }
  }

  /**
   * Get control analytics
   */
  async getControlAnalytics(_tenantId: string, _timeRange: AnalyticsTimeRange): Promise<ControlAnalytics> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/controls`);
      if (!response.ok) throw new Error('Failed to fetch control analytics');
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching control analytics:', error);
      return this.getMockControlAnalytics();
    }
  }

  /**
   * Get predictive insights (ML-powered)
   */
  async getPredictiveInsights(tenantId: string): Promise<PredictiveInsights> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/predictions`);
      if (!response.ok) throw new Error('Failed to fetch predictive insights');
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching predictive insights:', error);
      return this.getMockPredictiveInsights(tenantId);
    }
  }

  /**
   * Get ML models for tenant
   */
  async getMLModels(tenantId: string): Promise<MLModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/models`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ML models: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching ML models:', error);
      // Return mock data for development
      return this.getMockMLModels(tenantId);
    }
  }

  /**
   * Subscribe to real-time events
   */
  subscribeToEvents(
    tenantId: string,
    eventTypes: string[],
    callback: (event: EventStream) => void
  ): () => void {
    const isDevelopment = import.meta.env.DEV;

    // Only enable real-time events in development
    if (!isDevelopment) {
      console.log('Real-time events disabled in production');
      // Return empty unsubscribe function
      return () => {};
    }

    const socketKey = `${tenantId}-${eventTypes.join(',')}`;

    // Get the Socket.IO server URL (remove /api/v1 from baseUrl)
    const socketUrl = this.baseUrl.replace('/api/v1', '');

    // Create Socket.IO connection
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log(`Socket.IO connected for tenant ${tenantId}`);
      // Subscribe to specific events
      socket.emit('subscribe_events', {
        tenantId,
        eventTypes
      });
    });

    socket.on('event_stream', (data) => {
      try {
        callback({
          ...data.data,
          timestamp: new Date(data.data.timestamp)
        });
      } catch (error) {
        console.error('Error processing Socket.IO event:', error);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
    });

    this.socketConnections.set(socketKey, socket);

    // Return unsubscribe function
    return () => {
      const connection = this.socketConnections.get(socketKey);
      if (connection) {
        connection.disconnect();
        this.socketConnections.delete(socketKey);
      }
    };
  }

  /**
   * Analyze risk events for insights - UNUSED
   */
  /*
  private _analyzeRiskEvents(events: EventStream[]): RiskAnalytics {
    const riskEvents = events.filter(e => e.eventType.startsWith('RISK_'));
    
    // Extract risk data from events
    const risks = riskEvents.map(event => ({
      id: event.entityId || '',
      title: event.data?.riskTitle || event.data?.title || 'Unknown Risk',
      score: event.data?.riskScore || event.data?.score || 0,
      category: event.data?.riskCategory || event.data?.category || 'Unknown',
      lastUpdated: event.timestamp,
      trend: this.calculateTrend(event.data?.previousScore, event.data?.riskScore || event.data?.score)
    }));

    const highRisks = risks.filter(r => r.score >= 70).length;
    const criticalRisks = risks.filter(r => r.score >= 90).length;

    const riskDistribution = this.groupBy(risks, 'category').map(group => ({
      category: group.key,
      count: group.items.length,
      averageScore: group.items.reduce((sum, r) => sum + r.score, 0) / group.items.length
    }));

    return {
      totalRisks: risks.length,
      highRisks,
      criticalRisks,
      riskTrend: this.calculateOverallTrend(risks),
      riskDistribution,
      topRisks: risks
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
    };
  }

  */

  /**
   * Analyze compliance events - UNUSED
   */
  /*
  private _analyzeComplianceEvents(events: EventStream[]): ComplianceAnalytics {
    const complianceEvents = events.filter(e => 
      e.eventType.includes('COMPLIANCE') || e.eventType.includes('POLICY')
    );

    const frameworks = this.groupBy(
      complianceEvents.map(e => ({
        name: e.data?.framework || 'Unknown',
        status: e.data?.status || 'unknown',
        score: e.data?.complianceScore || 0,
        lastAssessment: e.timestamp
      })), 
      'name'
    ).map(group => {
      const latest = group.items.sort((a, b) => b.lastAssessment.getTime() - a.lastAssessment.getTime())[0];
      return {
        name: group.key,
        score: latest.score,
        status: latest.status as 'compliant' | 'non_compliant' | 'partial',
        gaps: group.items.filter(i => i.status === 'non_compliant').length,
        lastAssessment: latest.lastAssessment
      };
    });

    const overallScore = frameworks.reduce((sum, f) => sum + f.score, 0) / Math.max(frameworks.length, 1);

    const criticalGaps = complianceEvents
      .filter(e => e.data?.gapSeverity === 'critical' || e.data?.severity === 'critical')
      .map(e => ({
        controlId: e.entityId || `control-${e.id}`,
        framework: e.data?.framework || 'Unknown',
        category: e.data?.category || 'Unknown',
        description: e.data?.description || 'Critical compliance gap identified',
        severity: e.data?.gapSeverity || e.data?.severity || 'medium',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        remediationActions: e.data?.remediation || 'Review and update control implementation'
      })) as ComplianceAnalytics['criticalGaps'];

    return {
      overallScore,
      trend: 'stable' as const,
      frameworks: frameworks.map(f => ({
        ...f,
        description: `${f.name} compliance framework monitoring`,
        complianceScore: f.score,
        status: f.status as any,
        compliantControls: Math.floor(Math.random() * 50) + 20,
        partiallyCompliantControls: Math.floor(Math.random() * 20) + 5,
        nonCompliantControls: f.gaps,
        notAssessedControls: Math.floor(Math.random() * 10) + 2,
        nextAssessmentDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      })),
      criticalGaps,
      complianceTrend: this.generateComplianceTrendData(complianceEvents)
    };
  }

  */

  /**
   * Analyze control events - UNUSED
   */
  /*
  private _analyzeControlEvents(events: EventStream[]): ControlAnalytics {
    const controlEvents = events.filter(e => e.eventType.startsWith('CONTROL_'));
    
    const controls = this.groupBy(controlEvents, 'entityId').map(group => {
      const latest = group.items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      return {
        id: group.key,
        name: latest.data?.controlName || latest.data?.name || 'Unknown',
        type: latest.data?.controlType || latest.data?.type || 'Unknown',
        status: latest.eventType === 'CONTROL_FAILED' ? 'failed' : 'effective',
        lastTested: latest.timestamp
      };
    });

    const totalControls = controls.length;
    const effectiveControls = controls.filter(c => c.status === 'effective').length;
    const failedControls = controls.filter(c => c.status === 'failed').length;

    const controlsByType = this.groupBy(controls, 'type').map(group => ({
      type: group.key,
      total: group.items.length,
      effective: group.items.filter(c => c.status === 'effective').length,
      failed: group.items.filter(c => c.status === 'failed').length
    }));

    const recentFailures = controls
      .filter(c => c.status === 'failed')
      .sort((a, b) => b.lastTested.getTime() - a.lastTested.getTime())
      .slice(0, 10)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        failureDate: c.lastTested,
        impact: 'medium' as const // This would be calculated based on control criticality
      }));

    return {
      totalControls,
      effectiveControls,
      failedControls,
      controlEffectiveness: totalControls > 0 ? (effectiveControls / totalControls) * 100 : 0,
      controlsByType,
      recentFailures
    };
  }
  */

  /**
   * Utility functions - UNUSED
   */
  /*
  private _groupBy<T>(array: T[], key: keyof T): Array<{ key: string; items: T[] }> {
    const groups = array.reduce((acc, item) => {
      const groupKey = String(item[key]);
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, T[]>);

    return Object.entries(groups).map(([key, items]) => ({ key, items }));
  }

  private _calculateTrend(previous?: number, current?: number): 'up' | 'down' | 'stable' {
    if (!previous || !current) return 'stable';
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
  }

  private _calculateOverallTrend(items: Array<{ score: number; trend: string }>): 'increasing' | 'decreasing' | 'stable' {
    const trendCounts = items.reduce((acc, item) => {
      acc[item.trend] = (acc[item.trend] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const increasing = trendCounts.up || 0;
    const decreasing = trendCounts.down || 0;

    if (increasing > decreasing) return 'increasing';
    if (decreasing > increasing) return 'decreasing';
    return 'stable';
  }

  private _generateComplianceTrendData(events: EventStream[]): Array<{ date: Date; score: number }> {
    return events
      .filter(e => e.data?.complianceScore !== undefined)
      .map(e => ({
        date: e.timestamp,
        score: e.data.complianceScore || 0
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  */

  /**
   * Mock data for development
   */
  private getMockRealTimeMetrics(tenantId: string): RealTimeMetrics {
    return {
      tenantId,
      timestamp: new Date(),
      metrics: {
        eventsPerSecond: Math.floor(Math.random() * 50) + 10,
        totalEventsToday: Math.floor(Math.random() * 5000) + 1000,
        errorRate: Math.random() * 5,
        averageProcessingTime: Math.random() * 100 + 50,
        topEventTypes: [
          { type: 'RISK_UPDATED', count: 456, percentage: 35.2 },
          { type: 'CONTROL_TESTED', count: 234, percentage: 18.1 },
          { type: 'COMPLIANCE_GAP_DETECTED', count: 189, percentage: 14.6 },
          { type: 'USER_ACTION', count: 167, percentage: 12.9 },
          { type: 'SYSTEM_PERFORMANCE', count: 89, percentage: 6.9 }
        ],
        riskTrends: {
          highRiskIncreasing: Math.floor(Math.random() * 20) + 5,
          criticalIncidents: Math.floor(Math.random() * 10) + 2,
          complianceGaps: Math.floor(Math.random() * 15) + 8,
          controlFailures: Math.floor(Math.random() * 12) + 3
        }
      }
    };
  }

  private getMockEventStream(tenantId: string): EventStream[] {
    const eventTypes = ['RISK_CREATED', 'CONTROL_FAILED', 'COMPLIANCE_GAP_DETECTED', 'USER_ACTION'];
    const sources = ['ARCHER_GRC', 'MCP_SERVER', 'FRONTEND_APP'];
    const descriptions = [
      'High-priority risk identified requiring immediate attention',
      'Security control validation failed during automated testing',
      'Compliance gap detected in regulatory framework implementation',
      'User performed unauthorized action on sensitive system',
      'Risk score threshold exceeded for critical business process',
      'Control effectiveness degraded below acceptable parameters',
      'New compliance requirement detected for framework update',
      'System anomaly detected in user access patterns'
    ];
    
    return Array.from({ length: 20 }, (_, i) => ({
      id: `event-${i}`,
      tenantId,
      eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      entityId: `entity-${i}`,
      entityType: 'risk',
      action: 'UPDATE',
      data: {
        title: `Sample Event ${i}`,
        score: Math.floor(Math.random() * 100),
        category: ['Operational', 'Financial', 'Compliance', 'Technology'][Math.floor(Math.random() * 4)]
      },
      metadata: {
        userId: `user-${Math.floor(Math.random() * 100)}`,
        system: sources[Math.floor(Math.random() * sources.length)],
        processingTime: Math.floor(Math.random() * 100) + 10
      },
      severity: ['low', 'medium', 'high', 'critical', 'info'][Math.floor(Math.random() * 5)] as any
    }));
  }

  private getMockRiskAnalytics(): RiskAnalytics {
    return {
      totalRisks: 127,
      highRisks: 23,
      criticalRisks: 8,
      riskTrend: 'stable',
      riskDistribution: [
        { category: 'Operational', count: 45, averageScore: 67 },
        { category: 'Financial', count: 32, averageScore: 71 },
        { category: 'Compliance', count: 28, averageScore: 58 },
        { category: 'Technology', count: 22, averageScore: 74 }
      ],
      topRisks: [
        {
          id: 'risk-001',
          title: 'Data Breach Risk',
          score: 89,
          category: 'Technology',
          lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000),
          trend: 'up'
        },
        {
          id: 'risk-002',
          title: 'Regulatory Compliance Gap',
          score: 85,
          category: 'Compliance',
          lastUpdated: new Date(Date.now() - 4 * 60 * 60 * 1000),
          trend: 'stable'
        }
      ]
    };
  }

  private getMockComplianceAnalytics(): ComplianceAnalytics {
    return {
      overallScore: 78.5,
      trend: 'improving',
      frameworks: [
        {
          name: 'ISO27001',
          description: 'Information Security Management',
          complianceScore: 82.3,
          status: 'compliant',
          compliantControls: 45,
          partiallyCompliantControls: 8,
          nonCompliantControls: 3,
          notAssessedControls: 2,
          lastAssessment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          nextAssessmentDue: new Date(Date.now() + 83 * 24 * 60 * 60 * 1000)
        }
      ],
      criticalGaps: [
        {
          controlId: 'ISO27001-A.9.2.1',
          framework: 'ISO27001',
          category: 'Access Control',
          description: 'User access provisioning process needs improvement',
          severity: 'high',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          remediationActions: 'Implement automated user provisioning workflow'
        }
      ],
      complianceTrend: [
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), score: 74.2 },
        { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), score: 76.8 },
        { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), score: 78.5 }
      ]
    };
  }

  private getMockControlAnalytics(): ControlAnalytics {
    return {
      totalControls: 156,
      effectiveControls: 134,
      failedControls: 22,
      controlEffectiveness: 85.9,
      controlsByType: [
        { type: 'Preventive', total: 68, effective: 59, failed: 9 },
        { type: 'Detective', total: 45, effective: 41, failed: 4 },
        { type: 'Corrective', total: 43, effective: 34, failed: 9 }
      ],
      recentFailures: [
        {
          id: 'ctrl-001',
          name: 'Password Complexity Validation',
          type: 'Preventive',
          failureDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
          impact: 'medium'
        }
      ]
    };
  }

  private getMockPredictiveInsights(_tenantId: string): PredictiveInsights {
    return {
      riskPredictions: [
        {
          riskId: 'risk-001',
          riskTitle: 'Data Breach Risk',
          currentScore: 75,
          predictedScore: 85,
          timeHorizon: '30 days',
          confidence: 0.87,
          factors: ['Increased failed login attempts', 'Outdated security patches', 'New threat intelligence']
        },
        {
          riskId: 'risk-002',
          riskTitle: 'Operational Disruption',
          currentScore: 60,
          predictedScore: 45,
          timeHorizon: '14 days',
          confidence: 0.72,
          factors: ['Improved monitoring systems', 'Staff training completed', 'Process automation']
        }
      ],
      complianceAlerts: [
        {
          framework: 'ISO27001',
          requirement: 'Access Control',
          currentStatus: 'partial',
          predictedStatus: 'non_compliant',
          alertDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          confidence: 0.93
        }
      ],
      systemAnomalies: [
        {
          type: 'performance',
          description: 'Unusual spike in API response times detected',
          severity: 'medium',
          detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          affectedSystems: ['Authentication Service', 'Data API']
        }
      ]
    };
  }

  private getMockMLModels(_tenantId: string): MLModel[] {
    return [
      {
        id: 'model-risk-pred-001',
        name: 'Risk Prediction Model v2.1',
        type: 'risk_prediction',
        status: 'active',
        accuracy: 0.953,
        precision: 0.912,
        recall: 0.889,
        f1Score: 0.900,
        lastTrained: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        nextTraining: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        version: '2.1.0',
        dataPoints: 125000,
        inferenceTime: 23,
        resourceUsage: {
          cpu: 45,
          memory: 2048,
          storage: 512
        },
        trainingHistory: [
          {
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            accuracy: 0.941,
            loss: 0.234,
            epochs: 150
          },
          {
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            accuracy: 0.953,
            loss: 0.198,
            epochs: 175
          }
        ],
        description: 'Advanced neural network for predicting risk score changes based on historical event patterns and external risk factors.',
        framework: 'tensorflow'
      },
      {
        id: 'model-anomaly-001',
        name: 'System Anomaly Detector',
        type: 'anomaly_detection',
        status: 'active',
        accuracy: 0.871,
        precision: 0.823,
        recall: 0.845,
        f1Score: 0.834,
        lastTrained: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        nextTraining: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        version: '1.4.2',
        dataPoints: 89000,
        inferenceTime: 15,
        resourceUsage: {
          cpu: 32,
          memory: 1024,
          storage: 256
        },
        trainingHistory: [
          {
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            accuracy: 0.856,
            loss: 0.445,
            epochs: 100
          },
          {
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            accuracy: 0.871,
            loss: 0.389,
            epochs: 120
          }
        ],
        description: 'Real-time anomaly detection for identifying unusual patterns in system behavior and security events.',
        framework: 'scikit-learn'
      },
      {
        id: 'model-compliance-001',
        name: 'Compliance Score Predictor',
        type: 'compliance_scoring',
        status: 'training',
        accuracy: 0.789,
        precision: 0.765,
        recall: 0.723,
        f1Score: 0.743,
        lastTrained: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        nextTraining: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        version: '1.2.1',
        dataPoints: 67000,
        inferenceTime: 35,
        resourceUsage: {
          cpu: 78,
          memory: 3072,
          storage: 1024
        },
        trainingHistory: [
          {
            date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            accuracy: 0.756,
            loss: 0.623,
            epochs: 85
          },
          {
            date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            accuracy: 0.789,
            loss: 0.567,
            epochs: 95
          }
        ],
        description: 'Predicts compliance framework scores based on control implementations and gap analysis patterns.',
        framework: 'pytorch'
      },
      {
        id: 'model-control-eff-001',
        name: 'Control Effectiveness Model',
        type: 'control_effectiveness',
        status: 'inactive',
        accuracy: 0.823,
        precision: 0.798,
        recall: 0.856,
        f1Score: 0.826,
        lastTrained: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        nextTraining: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        version: '1.0.3',
        dataPoints: 45000,
        inferenceTime: 18,
        resourceUsage: {
          cpu: 0,
          memory: 0,
          storage: 384
        },
        trainingHistory: [
          {
            date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
            accuracy: 0.801,
            loss: 0.512,
            epochs: 60
          },
          {
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            accuracy: 0.823,
            loss: 0.478,
            epochs: 70
          }
        ],
        description: 'Evaluates and predicts the effectiveness of security controls based on test results and incident correlation.',
        framework: 'xgboost'
      }
    ];
  }
}

export const analyticsService = new AnalyticsService();