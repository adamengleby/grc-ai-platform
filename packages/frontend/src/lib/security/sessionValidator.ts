/**
 * Enhanced Session Validation with Tenant Context
 * Provides comprehensive session security with anti-hijacking measures
 */

import { securityAuditLogger } from './auditLogger';

export interface SessionContext {
  sessionId: string;
  userId: string;
  tenantId: string;
  userRoles: string[];
  createdAt: number;
  lastActivity: number;
  userAgent: string;
  ipAddress: string;
  fingerprint: string;
  securityLevel: 'STANDARD' | 'ELEVATED' | 'HIGH_SECURITY';
}

export interface SessionValidationResult {
  valid: boolean;
  sessionContext?: SessionContext;
  violations: string[];
  riskScore: number;
  requiresReauth: boolean;
}

export class SessionValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sessionId?: string
  ) {
    super(message);
    this.name = 'SessionValidationError';
  }
}

export class EnhancedSessionValidator {
  private static instance: EnhancedSessionValidator;
  private activeSessions: Map<string, SessionContext> = new Map();
  private readonly maxSessionAge = 8 * 60 * 60 * 1000; // 8 hours
  private readonly maxInactivity = 2 * 60 * 60 * 1000; // 2 hours
  private readonly maxSessionsPerUser = 5;

  private constructor() {
    this.loadExistingSessions();
    this.initializePeriodicCleanup();
  }

  static getInstance(): EnhancedSessionValidator {
    if (!EnhancedSessionValidator.instance) {
      EnhancedSessionValidator.instance = new EnhancedSessionValidator();
    }
    return EnhancedSessionValidator.instance;
  }

  /**
   * Create a new secure session with tenant context
   */
  async createSession(
    userId: string,
    tenantId: string,
    userRoles: string[],
    userAgent: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<SessionContext> {
    
    // Cleanup old sessions for user
    await this.cleanupUserSessions(userId);

    const sessionId = this.generateSecureSessionId();
    const fingerprint = await this.generateDeviceFingerprint(userAgent, ipAddress);
    const now = Date.now();

    const sessionContext: SessionContext = {
      sessionId,
      userId,
      tenantId,
      userRoles,
      createdAt: now,
      lastActivity: now,
      userAgent,
      ipAddress,
      fingerprint,
      securityLevel: this.determineSecurityLevel(userRoles)
    };

    // Store session
    this.activeSessions.set(sessionId, sessionContext);
    await this.persistSessions();

    // Audit log
    await securityAuditLogger.logAuthentication(
      tenantId,
      userId,
      'SESSION_CREATE',
      'SUCCESS',
      {
        sessionId,
        securityLevel: sessionContext.securityLevel,
        userAgent,
        ipAddress
      }
    );

    return sessionContext;
  }

  /**
   * Validate existing session with comprehensive security checks
   */
  async validateSession(
    sessionId: string,
    currentUserAgent?: string,
    currentIpAddress?: string
  ): Promise<SessionValidationResult> {
    
    const violations: string[] = [];
    let riskScore = 0;

    try {
      // Get session context
      const sessionContext = this.activeSessions.get(sessionId);
      
      if (!sessionContext) {
        violations.push('SESSION_NOT_FOUND');
        riskScore = 10.0;
        
        await securityAuditLogger.logSecurityViolation(
          'unknown',
          'unknown',
          'INVALID_SESSION',
          { sessionId, violation: 'SESSION_NOT_FOUND' }
        );

        return {
          valid: false,
          violations,
          riskScore,
          requiresReauth: true
        };
      }

      const now = Date.now();

      // Check session age
      if (now - sessionContext.createdAt > this.maxSessionAge) {
        violations.push('SESSION_EXPIRED_AGE');
        riskScore += 3.0;
      }

      // Check inactivity timeout
      if (now - sessionContext.lastActivity > this.maxInactivity) {
        violations.push('SESSION_EXPIRED_INACTIVITY');
        riskScore += 2.0;
      }

      // Validate user agent consistency (detect session hijacking) - Demo mode
      if (currentUserAgent && currentUserAgent !== sessionContext.userAgent) {
        // In demo mode, be more lenient with user agent changes
        violations.push('USER_AGENT_CHANGE');
        riskScore += 2.0; // Reduced from 7.0 for demo
        
        await securityAuditLogger.logEvent(
          'SECURITY_VIOLATION',
          'WARNING',
          sessionContext.tenantId,
          sessionContext.userId,
          'USER_AGENT_CHANGE',
          'SUCCESS',
          {
            sessionId,
            originalUserAgent: sessionContext.userAgent,
            currentUserAgent,
            severity: 'minor' // Demo mode
          }
        );
      }

      // Validate IP address consistency
      if (currentIpAddress && currentIpAddress !== sessionContext.ipAddress) {
        // Allow flexibility for legitimate IP changes in demo
        violations.push('IP_ADDRESS_CHANGE');
        riskScore += 1.0; // Reduced from 4.0 for demo
        
        await securityAuditLogger.logEvent(
          'SECURITY_VIOLATION',
          'INFO',
          sessionContext.tenantId,
          sessionContext.userId,
          'IP_ADDRESS_CHANGE',
          'SUCCESS',
          {
            sessionId,
            originalIP: sessionContext.ipAddress,
            currentIP: currentIpAddress,
            severity: 'minor' // Demo mode
          }
        );
      }

      // Check for device fingerprint changes
      if (currentUserAgent) {
        const currentFingerprint = await this.generateDeviceFingerprint(
          currentUserAgent, 
          currentIpAddress || sessionContext.ipAddress
        );
        
        if (currentFingerprint !== sessionContext.fingerprint) {
          violations.push('DEVICE_FINGERPRINT_MISMATCH');
          riskScore += 6.0;
        }
      }

      // Update last activity if session is still valid
      const isValid = violations.length === 0 || 
                     (riskScore < 5.0 && !violations.includes('SESSION_EXPIRED_AGE'));

      if (isValid) {
        sessionContext.lastActivity = now;
        
        // Update IP if changed (legitimate roaming)
        if (currentIpAddress && currentIpAddress !== sessionContext.ipAddress) {
          sessionContext.ipAddress = currentIpAddress;
        }
        
        await this.persistSessions();
      }

      // Determine if reauthentication is required
      const requiresReauth = riskScore >= 7.0 || 
                            violations.includes('SESSION_EXPIRED_AGE') ||
                            violations.includes('USER_AGENT_MISMATCH');

      if (requiresReauth) {
        // Invalidate session for security
        await this.invalidateSession(sessionId, 'SECURITY_VIOLATION');
      }

      return {
        valid: isValid && !requiresReauth,
        sessionContext: isValid ? sessionContext : undefined,
        violations,
        riskScore: Math.min(10.0, riskScore),
        requiresReauth
      };

    } catch (error) {
      await securityAuditLogger.logSecurityViolation(
        'unknown',
        'unknown',
        'SESSION_VALIDATION_ERROR',
        {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      return {
        valid: false,
        violations: ['VALIDATION_ERROR'],
        riskScore: 8.0,
        requiresReauth: true
      };
    }
  }

  /**
   * Validate tenant access within session
   */
  async validateTenantAccess(
    sessionId: string,
    requestedTenantId: string
  ): Promise<boolean> {
    
    const sessionContext = this.activeSessions.get(sessionId);
    
    if (!sessionContext) {
      await securityAuditLogger.logSecurityViolation(
        requestedTenantId,
        'unknown',
        'INVALID_SESSION_TENANT_ACCESS',
        { sessionId, requestedTenantId }
      );
      return false;
    }

    // Check if user can access the requested tenant
    const canAccess = sessionContext.tenantId === requestedTenantId ||
                     sessionContext.userRoles.includes('PlatformOwner') ||
                     sessionContext.userRoles.includes('SuperAdmin');

    if (!canAccess) {
      await securityAuditLogger.logSecurityViolation(
        requestedTenantId,
        sessionContext.userId,
        'UNAUTHORIZED_TENANT_ACCESS',
        {
          sessionId,
          sessionTenantId: sessionContext.tenantId,
          requestedTenantId
        }
      );
    }

    return canAccess;
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string, reason: string): Promise<boolean> {
    const sessionContext = this.activeSessions.get(sessionId);
    
    if (sessionContext) {
      this.activeSessions.delete(sessionId);
      await this.persistSessions();

      await securityAuditLogger.logEvent(
        'AUTHENTICATION',
        'INFO',
        sessionContext.tenantId,
        sessionContext.userId,
        'SESSION_INVALIDATE',
        'SUCCESS',
        {
          sessionId,
          reason,
          sessionDuration: Date.now() - sessionContext.createdAt
        }
      );

      return true;
    }

    return false;
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string, reason: string): Promise<number> {
    let invalidatedCount = 0;

    for (const [sessionId, context] of this.activeSessions.entries()) {
      if (context.userId === userId) {
        await this.invalidateSession(sessionId, reason);
        invalidatedCount++;
      }
    }

    return invalidatedCount;
  }

  /**
   * Switch tenant within existing session (if allowed)
   */
  async switchTenant(
    sessionId: string,
    newTenantId: string
  ): Promise<SessionValidationResult> {
    
    const sessionContext = this.activeSessions.get(sessionId);
    
    if (!sessionContext) {
      return {
        valid: false,
        violations: ['SESSION_NOT_FOUND'],
        riskScore: 10.0,
        requiresReauth: true
      };
    }

    // Check if user can access the new tenant
    const canAccess = sessionContext.userRoles.includes('PlatformOwner') ||
                     sessionContext.userRoles.includes('SuperAdmin');

    if (!canAccess) {
      await securityAuditLogger.logSecurityViolation(
        newTenantId,
        sessionContext.userId,
        'UNAUTHORIZED_TENANT_SWITCH',
        {
          sessionId,
          fromTenant: sessionContext.tenantId,
          toTenant: newTenantId
        }
      );

      return {
        valid: false,
        violations: ['UNAUTHORIZED_TENANT_SWITCH'],
        riskScore: 8.0,
        requiresReauth: false
      };
    }

    // Update session tenant
    sessionContext.tenantId = newTenantId;
    sessionContext.lastActivity = Date.now();
    
    await this.persistSessions();

    await securityAuditLogger.logTenantAccess(
      newTenantId,
      sessionContext.userId,
      'SUCCESS',
      {
        sessionId,
        switchFromTenant: sessionContext.tenantId
      }
    );

    return {
      valid: true,
      sessionContext,
      violations: [],
      riskScore: 0,
      requiresReauth: false
    };
  }

  /**
   * Get session security metrics
   */
  getSecurityMetrics(): {
    activeSessions: number;
    sessionsBySecurityLevel: Record<string, number>;
    averageSessionAge: number;
    recentViolations: number;
  } {
    const now = Date.now();
    let totalAge = 0;
    const securityLevels = { STANDARD: 0, ELEVATED: 0, HIGH_SECURITY: 0 };

    for (const context of this.activeSessions.values()) {
      totalAge += now - context.createdAt;
      securityLevels[context.securityLevel]++;
    }

    return {
      activeSessions: this.activeSessions.size,
      sessionsBySecurityLevel: securityLevels,
      averageSessionAge: this.activeSessions.size > 0 ? totalAge / this.activeSessions.size : 0,
      recentViolations: this.getRecentViolationCount()
    };
  }

  /**
   * Private helper methods
   */

  private generateSecureSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = this.generateCryptoRandom(32);
    return `sess_${timestamp}_${randomPart}`;
  }

  private generateCryptoRandom(length: number): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private async generateDeviceFingerprint(userAgent: string, ipAddress: string): Promise<string> {
    const fingerprint = `${userAgent}|${ipAddress}|${typeof navigator !== 'undefined' ? navigator.language : 'en'}`;
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(fingerprint);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    // Simple fallback hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private determineSecurityLevel(userRoles: string[]): 'STANDARD' | 'ELEVATED' | 'HIGH_SECURITY' {
    if (userRoles.includes('PlatformOwner') || userRoles.includes('SuperAdmin')) {
      return 'HIGH_SECURITY';
    }
    if (userRoles.includes('TenantOwner') || userRoles.includes('Auditor')) {
      return 'ELEVATED';
    }
    return 'STANDARD';
  }

  private async cleanupUserSessions(userId: string): Promise<void> {
    const userSessions = Array.from(this.activeSessions.entries())
      .filter(([, context]) => context.userId === userId)
      .sort(([, a], [, b]) => b.lastActivity - a.lastActivity);

    // Keep only the most recent sessions
    if (userSessions.length >= this.maxSessionsPerUser) {
      const sessionsToRemove = userSessions.slice(this.maxSessionsPerUser - 1);
      
      for (const [sessionId] of sessionsToRemove) {
        await this.invalidateSession(sessionId, 'MAX_SESSIONS_EXCEEDED');
      }
    }
  }

  private loadExistingSessions(): void {
    try {
      const stored = localStorage.getItem('active_sessions');
      if (stored) {
        const sessionData = JSON.parse(stored);
        this.activeSessions = new Map(sessionData);
      }
    } catch (error) {
      console.warn('Failed to load existing sessions:', error);
    }
  }

  private async persistSessions(): Promise<void> {
    try {
      const sessionData = Array.from(this.activeSessions.entries());
      localStorage.setItem('active_sessions', JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to persist sessions:', error);
    }
  }

  private getRecentViolationCount(): number {
    // Get violations from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    return securityAuditLogger.queryEvents({
      eventType: 'SECURITY_VIOLATION',
      startTime: oneHourAgo,
      limit: 1000
    }).length;
  }

  private initializePeriodicCleanup(): void {
    // Clean up expired sessions every 15 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 15 * 60 * 1000);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    for (const [sessionId, context] of this.activeSessions.entries()) {
      if (now - context.createdAt > this.maxSessionAge || 
          now - context.lastActivity > this.maxInactivity) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      await this.invalidateSession(sessionId, 'EXPIRED');
    }
  }
}

// Export singleton instance
export const enhancedSessionValidator = EnhancedSessionValidator.getInstance();