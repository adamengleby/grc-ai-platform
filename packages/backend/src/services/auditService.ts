/**
 * Audit Service
 * Handles comprehensive audit logging for all tenant operations
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { DatabaseService } from './databaseService';

export interface AuditEvent {
  eventType: string;
  eventCategory: 'security' | 'configuration' | 'usage' | 'compliance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  userId?: string;
  userEmail?: string;
  tenantId: string;
  resourceType?: string;
  resourceId?: string;
  eventSummary: string;
  eventDetails?: any;
  beforeState?: any;
  afterState?: any;
  clientIp?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  complianceFrameworks?: string[];
}

export interface AuditQuery {
  tenantId: string;
  startDate?: string;
  endDate?: string;
  eventTypes?: string[];
  eventCategories?: string[];
  severities?: string[];
  resourceTypes?: string[];
  userId?: string;
  limit?: number;
  offset?: number;
}

export class AuditService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Log an audit event with tamper detection
   */
  async logEvent(event: AuditEvent): Promise<string> {
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create event hash for tamper detection
    const eventData = {
      eventType: event.eventType,
      eventCategory: event.eventCategory,
      severity: event.severity,
      userId: event.userId || null,
      tenantId: event.tenantId,
      resourceType: event.resourceType || null,
      resourceId: event.resourceId || null,
      eventSummary: event.eventSummary,
      eventDetails: JSON.stringify(event.eventDetails || {}),
      timestamp
    };

    const eventHash = this.createEventHash(eventData);

    const query = `
      INSERT INTO audit_events (
        event_id,
        tenant_id,
        event_type,
        event_category,
        severity,
        user_id,
        user_email,
        resource_type,
        resource_id,
        event_summary,
        event_details,
        client_ip,
        user_agent,
        request_id,
        session_id,
        compliance_frameworks,
        before_state,
        after_state,
        event_hash,
        event_timestamp,
        ingested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      eventId,
      event.tenantId,
      event.eventType,
      event.eventCategory,
      event.severity,
      event.userId || null,
      event.userEmail || null,
      event.resourceType || null,
      event.resourceId || null,
      event.eventSummary,
      JSON.stringify(event.eventDetails || {}),
      event.clientIp || null,
      event.userAgent || null,
      event.requestId || null,
      event.sessionId || null,
      JSON.stringify(event.complianceFrameworks || []),
      JSON.stringify(event.beforeState || {}),
      JSON.stringify(event.afterState || {}),
      eventHash,
      timestamp,
      timestamp
    ];

    try {
      await this.db.execute(query, params, event.tenantId);
      return eventId;
    } catch (error) {
      // Log to system logger as fallback
      console.error('Failed to log audit event:', error);
      throw new Error('Failed to log audit event');
    }
  }

  /**
   * Query audit events with filtering
   */
  async queryEvents(query: AuditQuery): Promise<{
    events: any[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      tenantId,
      startDate,
      endDate,
      eventTypes,
      eventCategories,
      severities,
      resourceTypes,
      userId,
      limit = 100,
      offset = 0
    } = query;

    // Build WHERE clause
    const conditions: string[] = ['tenant_id = ?'];
    const params: any[] = [tenantId];

    if (startDate) {
      conditions.push('event_timestamp >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('event_timestamp <= ?');
      params.push(endDate);
    }

    if (eventTypes && eventTypes.length > 0) {
      conditions.push(`event_type IN (${eventTypes.map(() => '?').join(', ')})`);
      params.push(...eventTypes);
    }

    if (eventCategories && eventCategories.length > 0) {
      conditions.push(`event_category IN (${eventCategories.map(() => '?').join(', ')})`);
      params.push(...eventCategories);
    }

    if (severities && severities.length > 0) {
      conditions.push(`severity IN (${severities.map(() => '?').join(', ')})`);
      params.push(...severities);
    }

    if (resourceTypes && resourceTypes.length > 0) {
      conditions.push(`resource_type IN (${resourceTypes.map(() => '?').join(', ')})`);
      params.push(...resourceTypes);
    }

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    const whereClause = conditions.join(' AND ');

    // Get events
    const eventsQuery = `
      SELECT 
        event_id,
        event_type,
        event_category,
        severity,
        user_id,
        user_email,
        resource_type,
        resource_id,
        event_summary,
        event_details,
        client_ip,
        user_agent,
        request_id,
        session_id,
        compliance_frameworks,
        before_state,
        after_state,
        event_timestamp,
        ingested_at
      FROM audit_events
      WHERE ${whereClause}
      ORDER BY event_timestamp DESC
      OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `;

    const events = await this.db.query(eventsQuery, [...params, offset, limit], tenantId);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_events
      WHERE ${whereClause}
    `;

    const countResult = await this.db.query(countQuery, params, tenantId);
    const total = countResult[0]?.total || 0;

    // Parse JSON fields
    const parsedEvents = events.map(event => ({
      ...event,
      event_details: this.safeJsonParse(event.event_details),
      compliance_frameworks: this.safeJsonParse(event.compliance_frameworks),
      before_state: this.safeJsonParse(event.before_state),
      after_state: this.safeJsonParse(event.after_state)
    }));

    return {
      events: parsedEvents,
      total,
      hasMore: offset + events.length < total
    };
  }

  /**
   * Get audit statistics for a tenant
   */
  async getAuditStatistics(
    tenantId: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): Promise<{
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    topEventTypes: { event_type: string; count: number }[];
    timeSeriesData: { date: string; count: number }[];
  }> {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
    }

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // Get total events
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM audit_events
      WHERE tenant_id = ? AND event_timestamp BETWEEN ? AND ?
    `;
    const totalResult = await this.db.query(totalQuery, [tenantId, startDateStr, endDateStr], tenantId);
    const totalEvents = totalResult[0]?.total || 0;

    // Get events by category
    const categoryQuery = `
      SELECT event_category, COUNT(*) as count
      FROM audit_events
      WHERE tenant_id = ? AND event_timestamp BETWEEN ? AND ?
      GROUP BY event_category
    `;
    const categoryResult = await this.db.query(categoryQuery, [tenantId, startDateStr, endDateStr], tenantId);
    const eventsByCategory: Record<string, number> = {};
    categoryResult.forEach(row => {
      eventsByCategory[row.event_category] = row.count;
    });

    // Get events by severity
    const severityQuery = `
      SELECT severity, COUNT(*) as count
      FROM audit_events
      WHERE tenant_id = ? AND event_timestamp BETWEEN ? AND ?
      GROUP BY severity
    `;
    const severityResult = await this.db.query(severityQuery, [tenantId, startDateStr, endDateStr], tenantId);
    const eventsBySeverity: Record<string, number> = {};
    severityResult.forEach(row => {
      eventsBySeverity[row.severity] = row.count;
    });

    // Get top event types
    const topTypesQuery = `
      SELECT TOP 10 event_type, COUNT(*) as count
      FROM audit_events
      WHERE tenant_id = ? AND event_timestamp BETWEEN ? AND ?
      GROUP BY event_type
      ORDER BY count DESC
    `;
    const topTypesResult = await this.db.query(topTypesQuery, [tenantId, startDateStr, endDateStr], tenantId);

    // Get time series data
    const timeSeriesQuery = `
      SELECT 
        CAST(event_timestamp as DATE) as date,
        COUNT(*) as count
      FROM audit_events
      WHERE tenant_id = ? AND event_timestamp BETWEEN ? AND ?
      GROUP BY CAST(event_timestamp as DATE)
      ORDER BY date DESC
    `;
    const timeSeriesResult = await this.db.query(timeSeriesQuery, [tenantId, startDateStr, endDateStr], tenantId);

    return {
      totalEvents,
      eventsByCategory,
      eventsBySeverity,
      topEventTypes: topTypesResult,
      timeSeriesData: timeSeriesResult
    };
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(tenantId: string, eventId: string): Promise<{
    isValid: boolean;
    originalHash: string;
    calculatedHash: string;
  }> {
    const query = `
      SELECT 
        event_type,
        event_category,
        severity,
        user_id,
        tenant_id,
        resource_type,
        resource_id,
        event_summary,
        event_details,
        event_timestamp,
        event_hash
      FROM audit_events
      WHERE tenant_id = ? AND event_id = ?
    `;

    const results = await this.db.query(query, [tenantId, eventId], tenantId);
    
    if (results.length === 0) {
      throw new Error('Audit event not found');
    }

    const event = results[0];
    const calculatedHash = this.createEventHash({
      eventType: event.event_type,
      eventCategory: event.event_category,
      severity: event.severity,
      userId: event.user_id,
      tenantId: event.tenant_id,
      resourceType: event.resource_type,
      resourceId: event.resource_id,
      eventSummary: event.event_summary,
      eventDetails: event.event_details,
      timestamp: event.event_timestamp
    });

    return {
      isValid: calculatedHash === event.event_hash,
      originalHash: event.event_hash,
      calculatedHash
    };
  }

  /**
   * Create tamper-evident hash for an event
   */
  private createEventHash(eventData: any): string {
    const dataString = JSON.stringify(eventData, Object.keys(eventData).sort());
    return createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Safely parse JSON strings
   */
  private safeJsonParse(jsonString: string): any {
    try {
      return JSON.parse(jsonString || '{}');
    } catch {
      return {};
    }
  }
}