/**
 * Comprehensive Security Audit Logger
 * Provides tamper-evident logging for all tenant operations with SOC2/ISO27001 compliance
 */

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  tenantId: string;
  userId: string;
  sessionId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  details: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  geolocation?: string;
  riskScore?: number;
  complianceFrameworks: string[];
  hash?: string; // For tamper evidence
}

export type AuditEventType = 
  | 'AUTHENTICATION'
  | 'AUTHORIZATION' 
  | 'TENANT_ACCESS'
  | 'MCP_OPERATION'
  | 'DATA_ACCESS'
  | 'SECURITY_VIOLATION'
  | 'CONFIGURATION_CHANGE'
  | 'AGENT_INTERACTION'
  | 'SYSTEM_EVENT';

export interface AuditQuery {
  tenantId?: string;
  userId?: string;
  eventType?: AuditEventType;
  severity?: string;
  startTime?: string;
  endTime?: string;
  outcome?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  limit?: number;
}

export interface AuditSummary {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<string, number>;
  riskScore: number;
  complianceStatus: {
    framework: string;
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
    lastAudit: string;
  }[];
  anomalies: {
    type: string;
    count: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }[];
}

export class SecurityAuditLogger {
  private static instance: SecurityAuditLogger;
  private events: AuditEvent[] = [];
  private readonly maxEvents = 10000; // Keep last 10k events in memory

  private constructor() {
    this.loadExistingEvents();
    this.initializePeriodicMaintenance();
  }

  static getInstance(): SecurityAuditLogger {
    if (!SecurityAuditLogger.instance) {
      SecurityAuditLogger.instance = new SecurityAuditLogger();
    }
    return SecurityAuditLogger.instance;
  }

  /**
   * Log a security audit event
   */
  async logEvent(
    eventType: AuditEventType,
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL',
    tenantId: string,
    userId: string,
    action: string,
    outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL',
    details: Record<string, any> = {},
    options: {
      resource?: string;
      resourceId?: string;
      sessionId?: string;
      riskScore?: number;
    } = {}
  ): Promise<string> {
    
    const eventId = this.generateEventId();
    const timestamp = new Date().toISOString();
    
    const auditEvent: AuditEvent = {
      id: eventId,
      timestamp,
      eventType,
      severity,
      tenantId,
      userId,
      sessionId: options.sessionId || this.getCurrentSessionId(),
      action,
      resource: options.resource,
      resourceId: options.resourceId,
      outcome,
      details: {
        ...details,
        applicationContext: 'GRC-MCP-Chat',
        version: '1.0.0'
      },
      userAgent: this.getUserAgent(),
      ipAddress: this.getClientIP(),
      geolocation: this.getGeolocation(),
      riskScore: options.riskScore || this.calculateRiskScore(eventType, severity, outcome),
      complianceFrameworks: this.getApplicableFrameworks(tenantId),
      hash: '' // Will be set after hashing
    };

    // Generate tamper-evident hash
    auditEvent.hash = await this.generateEventHash(auditEvent);

    // Store event
    this.events.push(auditEvent);
    await this.persistEvent(auditEvent);

    // Check for anomalies and trigger alerts
    await this.analyzeAndAlert(auditEvent);

    // Maintain event storage limits
    this.maintainEventLimits();

    return eventId;
  }

  /**
   * Log tenant access attempt
   */
  async logTenantAccess(
    tenantId: string,
    userId: string,
    outcome: 'SUCCESS' | 'FAILURE',
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent(
      'TENANT_ACCESS',
      outcome === 'FAILURE' ? 'WARNING' : 'INFO',
      tenantId,
      userId,
      'TENANT_ACCESS_ATTEMPT',
      outcome,
      details
    );
  }

  /**
   * Log MCP operation
   */
  async logMcpOperation(
    tenantId: string,
    userId: string,
    toolId: string,
    operation: string,
    outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL',
    details: Record<string, any> = {}
  ): Promise<string> {
    const severity = outcome === 'FAILURE' ? 'ERROR' : 
                    outcome === 'PARTIAL' ? 'WARNING' : 'INFO';

    return this.logEvent(
      'MCP_OPERATION',
      severity,
      tenantId,
      userId,
      `MCP_${operation.toUpperCase()}`,
      outcome,
      {
        ...details,
        toolId,
        operation
      },
      {
        resource: 'MCP_TOOL',
        resourceId: toolId
      }
    );
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(
    tenantId: string,
    userId: string,
    violationType: string,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent(
      'SECURITY_VIOLATION',
      'CRITICAL',
      tenantId,
      userId,
      `SECURITY_VIOLATION_${violationType}`,
      'FAILURE',
      {
        ...details,
        violationType,
        automated: true,
        requiresInvestigation: true
      },
      {
        riskScore: 9.0 // High risk score for security violations
      }
    );
  }

  /**
   * Log authentication event
   */
  async logAuthentication(
    tenantId: string,
    userId: string,
    authMethod: string,
    outcome: 'SUCCESS' | 'FAILURE',
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent(
      'AUTHENTICATION',
      outcome === 'FAILURE' ? 'WARNING' : 'INFO',
      tenantId,
      userId,
      `AUTH_${authMethod.toUpperCase()}`,
      outcome,
      {
        ...details,
        authMethod
      }
    );
  }

  /**
   * Log agent interaction
   */
  async logAgentInteraction(
    tenantId: string,
    userId: string,
    agentId: string,
    interaction: string,
    outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL',
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent(
      'AGENT_INTERACTION',
      'INFO',
      tenantId,
      userId,
      `AGENT_${interaction.toUpperCase()}`,
      outcome,
      {
        ...details,
        agentId,
        interaction
      },
      {
        resource: 'AI_AGENT',
        resourceId: agentId
      }
    );
  }

  /**
   * Query audit events with filtering
   */
  queryEvents(query: AuditQuery): AuditEvent[] {
    let filteredEvents = [...this.events];

    if (query.tenantId) {
      filteredEvents = filteredEvents.filter(e => e.tenantId === query.tenantId);
    }

    if (query.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === query.userId);
    }

    if (query.eventType) {
      filteredEvents = filteredEvents.filter(e => e.eventType === query.eventType);
    }

    if (query.severity) {
      filteredEvents = filteredEvents.filter(e => e.severity === query.severity);
    }

    if (query.outcome) {
      filteredEvents = filteredEvents.filter(e => e.outcome === query.outcome);
    }

    if (query.startTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= query.endTime!);
    }

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    if (query.limit) {
      filteredEvents = filteredEvents.slice(0, query.limit);
    }

    return filteredEvents;
  }

  /**
   * Generate audit summary for compliance reporting
   */
  generateAuditSummary(tenantId?: string, timeRange?: { start: string; end: string }): AuditSummary {
    let events = tenantId ? 
      this.events.filter(e => e.tenantId === tenantId) : 
      this.events;

    if (timeRange) {
      events = events.filter(e => 
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }

    // Event counts by type
    const eventsByType = {} as Record<AuditEventType, number>;
    const eventsBySeverity = {} as Record<string, number>;
    let totalRiskScore = 0;

    events.forEach(event => {
      // Count by type
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Accumulate risk score
      totalRiskScore += event.riskScore || 0;
    });

    const averageRiskScore = events.length > 0 ? totalRiskScore / events.length : 0;

    // Detect anomalies
    const anomalies = this.detectAnomalies(events);

    // Compliance status
    const complianceStatus = this.assessComplianceStatus(events, tenantId);

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      riskScore: Math.round(averageRiskScore * 100) / 100,
      complianceStatus,
      anomalies
    };
  }

  /**
   * Export audit logs for compliance
   */
  exportAuditLogs(
    query: AuditQuery,
    format: 'JSON' | 'CSV' = 'JSON'
  ): string {
    const events = this.queryEvents(query);

    if (format === 'CSV') {
      return this.eventsToCSV(events);
    }

    return JSON.stringify({
      exportTimestamp: new Date().toISOString(),
      totalEvents: events.length,
      query,
      events
    }, null, 2);
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(eventIds?: string[]): Promise<{
    verified: boolean;
    tamperedEvents: string[];
    totalChecked: number;
  }> {
    const eventsToCheck = eventIds ? 
      this.events.filter(e => eventIds.includes(e.id)) : 
      this.events;

    const tamperedEvents: string[] = [];

    for (const event of eventsToCheck) {
      const eventCopy = { ...event };
      delete eventCopy.hash;
      
      const expectedHash = await this.generateEventHash(eventCopy);
      
      if (event.hash !== expectedHash) {
        tamperedEvents.push(event.id);
      }
    }

    return {
      verified: tamperedEvents.length === 0,
      tamperedEvents,
      totalChecked: eventsToCheck.length
    };
  }

  /**
   * Private helper methods
   */

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentSessionId(): string {
    // Get session ID from auth store or generate one
    const stored = localStorage.getItem('session_id');
    if (stored) return stored;
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('session_id', sessionId);
    return sessionId;
  }

  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'server';
  }

  private getClientIP(): string {
    // In production, this would come from headers or external service
    return '127.0.0.1'; // Placeholder for demo
  }

  private getGeolocation(): string {
    // In production, this would be resolved from IP
    return 'Local Development'; // Placeholder for demo
  }

  private calculateRiskScore(
    eventType: AuditEventType, 
    severity: string, 
    outcome: string
  ): number {
    let baseScore = 0;

    // Base score by event type
    switch (eventType) {
      case 'SECURITY_VIOLATION': baseScore = 8.0; break;
      case 'AUTHORIZATION': baseScore = 6.0; break;
      case 'AUTHENTICATION': baseScore = 5.0; break;
      case 'TENANT_ACCESS': baseScore = 4.0; break;
      case 'MCP_OPERATION': baseScore = 3.0; break;
      case 'DATA_ACCESS': baseScore = 3.0; break;
      default: baseScore = 1.0;
    }

    // Severity multiplier
    const severityMultiplier = {
      'CRITICAL': 2.0,
      'ERROR': 1.5,
      'WARNING': 1.2,
      'INFO': 1.0
    }[severity] || 1.0;

    // Outcome modifier
    const outcomeModifier = {
      'FAILURE': 1.5,
      'PARTIAL': 1.2,
      'SUCCESS': 0.8
    }[outcome] || 1.0;

    return Math.min(10.0, baseScore * severityMultiplier * outcomeModifier);
  }

  private getApplicableFrameworks(tenantId: string): string[] {
    // Default compliance frameworks
    const frameworks = ['SOC2', 'ISO27001'];
    
    // Add tenant-specific frameworks
    if (tenantId.includes('fintech')) {
      frameworks.push('PCI-DSS', 'SOX');
    } else if (tenantId.includes('healthcare')) {
      frameworks.push('HIPAA');
    } else if (tenantId.includes('manufacturing')) {
      frameworks.push('ISO9001');
    }
    
    return frameworks;
  }

  private async generateEventHash(event: Partial<AuditEvent>): Promise<string> {
    // Create canonical representation
    const canonical = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      eventType: event.eventType,
      tenantId: event.tenantId,
      userId: event.userId,
      action: event.action,
      outcome: event.outcome,
      details: event.details
    }, Object.keys(event).sort());

    // Use Web Crypto API if available
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(canonical);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback hash
    return this.simpleHash(canonical);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private loadExistingEvents(): void {
    try {
      const stored = localStorage.getItem('audit_events');
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load existing audit events:', error);
    }
  }

  private async persistEvent(event: AuditEvent): Promise<void> {
    try {
      // Store in localStorage for demo
      const allEvents = [...this.events];
      localStorage.setItem('audit_events', JSON.stringify(allEvents.slice(-this.maxEvents)));
      
      // In production, also send to secure audit service
      if (event.severity === 'CRITICAL') {
        console.warn('CRITICAL AUDIT EVENT:', event);
      }
    } catch (error) {
      console.error('Failed to persist audit event:', error);
    }
  }

  private async analyzeAndAlert(event: AuditEvent): Promise<void> {
    // Simple anomaly detection
    if (event.severity === 'CRITICAL' || event.riskScore! > 7.0) {
      // In production, send to security monitoring
      console.warn('HIGH RISK AUDIT EVENT DETECTED:', {
        eventId: event.id,
        severity: event.severity,
        riskScore: event.riskScore,
        action: event.action
      });
    }
  }

  private maintainEventLimits(): void {
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  private detectAnomalies(events: AuditEvent[]): Array<{
    type: string;
    count: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }> {
    const anomalies = [];

    // Check for excessive failures
    const failures = events.filter(e => e.outcome === 'FAILURE');
    if (failures.length > events.length * 0.1) {
      anomalies.push({
        type: 'EXCESSIVE_FAILURES',
        count: failures.length,
        riskLevel: 'HIGH' as const
      });
    }

    // Check for security violations
    const violations = events.filter(e => e.eventType === 'SECURITY_VIOLATION');
    if (violations.length > 0) {
      anomalies.push({
        type: 'SECURITY_VIOLATIONS',
        count: violations.length,
        riskLevel: 'CRITICAL' as const
      });
    }

    return anomalies;
  }

  private assessComplianceStatus(events: AuditEvent[], tenantId?: string): Array<{
    framework: string;
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
    lastAudit: string;
  }> {
    const frameworks = tenantId ? this.getApplicableFrameworks(tenantId) : ['SOC2', 'ISO27001'];
    
    return frameworks.map(framework => ({
      framework,
      status: this.checkFrameworkCompliance(events, framework),
      lastAudit: new Date().toISOString()
    }));
  }

  private checkFrameworkCompliance(events: AuditEvent[], framework: string): 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' {
    const violations = events.filter(e => 
      e.eventType === 'SECURITY_VIOLATION' && 
      e.complianceFrameworks.includes(framework)
    );

    if (violations.length === 0) return 'COMPLIANT';
    if (violations.length > 5) return 'NON_COMPLIANT';
    return 'NEEDS_REVIEW';
  }

  private eventsToCSV(events: AuditEvent[]): string {
    if (events.length === 0) return '';

    const headers = [
      'ID', 'Timestamp', 'Event Type', 'Severity', 'Tenant ID', 'User ID',
      'Action', 'Resource', 'Outcome', 'Risk Score', 'IP Address'
    ];

    const rows = events.map(event => [
      event.id,
      event.timestamp,
      event.eventType,
      event.severity,
      event.tenantId,
      event.userId,
      event.action,
      event.resource || '',
      event.outcome,
      event.riskScore?.toString() || '',
      event.ipAddress || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  private initializePeriodicMaintenance(): void {
    // Clean up old data every hour
    setInterval(() => {
      this.maintainEventLimits();
    }, 60 * 60 * 1000);
  }
}

// Export singleton instance
export const securityAuditLogger = SecurityAuditLogger.getInstance();