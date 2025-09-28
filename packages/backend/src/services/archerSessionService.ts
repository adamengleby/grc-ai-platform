/**
 * Archer Session Service
 * Handles secure server-side storage of Archer session tokens
 * Replaces insecure client-side token passing
 */

import { DatabaseService } from './databaseService';

export interface ArcherSession {
  session_id: string;
  tenant_id: string;
  user_id: string; // Will be added when we have proper user auth
  username: string;
  session_token: string;
  instance_id: string;
  base_url: string;
  user_domain_id?: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ArcherSessionCreateRequest {
  tenant_id: string;
  user_id?: string; // Optional for now, will be required with proper user auth
  username: string;
  session_token: string;
  instance_id: string;
  base_url: string;
  user_domain_id?: string;
  expires_at: Date;
}

export class ArcherSessionService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
    // Start cleanup interval for expired sessions
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Store an Archer session token securely on the backend
   * Returns a secure session reference for the client
   */
  async storeSession(sessionData: ArcherSessionCreateRequest): Promise<{ sessionId: string; expiresAt: Date }> {
    const sessionId = this.generateSessionId(sessionData.tenant_id, sessionData.username);
    
    const session: ArcherSession = {
      session_id: sessionId,
      tenant_id: sessionData.tenant_id,
      user_id: sessionData.user_id || `temp_${sessionData.username}`, // Temporary user ID
      username: sessionData.username,
      session_token: sessionData.session_token,
      instance_id: sessionData.instance_id,
      base_url: sessionData.base_url,
      user_domain_id: sessionData.user_domain_id,
      expires_at: sessionData.expires_at,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Store in database
    try {
      await this.db.execute(`
        INSERT OR REPLACE INTO archer_sessions (
          session_id, tenant_id, user_id, username, session_token, 
          instance_id, base_url, user_domain_id, expires_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        sessionId,
        session.tenant_id,
        session.user_id,
        session.username,
        session.session_token,
        session.instance_id,
        session.base_url,
        session.user_domain_id,
        session.expires_at.toISOString()
      ]);
      
      console.log(`[Archer Session] Stored session for ${sessionData.username}@${sessionData.instance_id} (expires: ${session.expires_at})`);
      
    } catch (error: any) {
      console.error(`[Archer Session] Failed to store session: ${error.message}`);
      throw error;
    }
    
    return {
      sessionId,
      expiresAt: session.expires_at
    };
  }

  /**
   * Retrieve a valid Archer session by session ID
   * Checks expiration and cleans up expired sessions
   */
  async getValidSession(sessionId: string): Promise<ArcherSession | null> {
    try {
      const results = await this.db.query<{
        session_id: string;
        tenant_id: string;
        user_id: string;
        username: string;
        session_token: string;
        instance_id: string;
        base_url: string;
        user_domain_id: string;
        expires_at: string;
        created_at: string;
        updated_at: string;
      }>(`
        SELECT * FROM archer_sessions 
        WHERE session_id = ? AND expires_at > datetime('now')
      `, [sessionId]);
      
      if (results.length === 0) {
        console.log(`[Archer Session] Session not found or expired: ${sessionId}`);
        return null;
      }
      
      const row = results[0];
      const session: ArcherSession = {
        session_id: row.session_id,
        tenant_id: row.tenant_id,
        user_id: row.user_id,
        username: row.username,
        session_token: row.session_token,
        instance_id: row.instance_id,
        base_url: row.base_url,
        user_domain_id: row.user_domain_id,
        expires_at: new Date(row.expires_at),
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      };
      
      // Update last accessed
      await this.db.execute(`
        UPDATE archer_sessions 
        SET updated_at = datetime('now') 
        WHERE session_id = ?
      `, [sessionId]);
      
      return session;
      
    } catch (error: any) {
      console.error(`[Archer Session] Error retrieving session: ${error.message}`);
      return null;
    }
  }

  /**
   * Get session for MCP server operations with automatic refresh
   * Returns connection configuration with session token
   * Attempts to refresh expired sessions automatically
   */
  async getArcherConnectionConfig(sessionId: string): Promise<{
    baseUrl: string;
    username: string;
    instanceId: string;
    sessionToken: string;
    userDomainId?: string;
    sessionExpiresAt: string;
  } | null> {
    let session = await this.getValidSession(sessionId);
    
    if (!session) {
      // Try to refresh expired session
      session = await this.refreshExpiredSession(sessionId);
    }
    
    if (!session) {
      return null;
    }
    
    return {
      baseUrl: session.base_url,
      username: session.username,
      instanceId: session.instance_id,
      sessionToken: session.session_token,
      userDomainId: session.user_domain_id,
      sessionExpiresAt: session.expires_at.toISOString()
    };
  }

  /**
   * Attempt to refresh an expired session by re-authenticating
   * This is useful when the session token expires but we still have the credentials
   */
  private async refreshExpiredSession(sessionId: string): Promise<ArcherSession | null> {
    try {
      // First, try to get the expired session data
      const expiredResults = await this.db.query<{
        session_id: string;
        tenant_id: string;
        user_id: string;
        username: string;
        session_token: string;
        instance_id: string;
        base_url: string;
        user_domain_id: string;
        expires_at: string;
        created_at: string;
        updated_at: string;
      }>(`
        SELECT * FROM archer_sessions 
        WHERE session_id = ?
      `, [sessionId]);
      
      if (expiredResults.length === 0) {
        console.log(`[Archer Session] No expired session found to refresh: ${sessionId}`);
        return null;
      }
      
      const expiredSession = expiredResults[0];
      console.log(`[Archer Session] Attempting to refresh expired session for ${expiredSession.username}@${expiredSession.instance_id}`);
      
      // Check if session is actually expired (safety check)
      const expiresAt = new Date(expiredSession.expires_at);
      const now = new Date();
      const isExpired = expiresAt <= now;
      
      if (!isExpired) {
        // Session is not actually expired, return it
        console.log(`[Archer Session] Session ${sessionId} is not expired, returning existing session`);
        return {
          session_id: expiredSession.session_id,
          tenant_id: expiredSession.tenant_id,
          user_id: expiredSession.user_id,
          username: expiredSession.username,
          session_token: expiredSession.session_token,
          instance_id: expiredSession.instance_id,
          base_url: expiredSession.base_url,
          user_domain_id: expiredSession.user_domain_id,
          expires_at: new Date(expiredSession.expires_at),
          created_at: new Date(expiredSession.created_at),
          updated_at: new Date(expiredSession.updated_at)
        };
      }
      
      console.log(`[Archer Session] Session expired on ${expiresAt.toISOString()}, current time: ${now.toISOString()}`);
      console.log(`[Archer Session] Session is expired by ${Math.round((now.getTime() - expiresAt.getTime()) / 1000 / 60)} minutes`);
      console.log(`[Archer Session] Automatic session refresh is not implemented yet - manual re-authentication required`);
      
      // TODO: Implement automatic re-authentication
      // This would require storing encrypted credentials or implementing a refresh token mechanism
      // For now, we'll return null to indicate the session needs manual refresh
      
      return null;
      
    } catch (error: any) {
      console.error(`[Archer Session] Error refreshing expired session: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if user has a valid session for a tenant
   */
  async hasValidSession(tenantId: string, username: string, instanceId: string): Promise<string | null> {
    const sessionId = this.generateSessionId(tenantId, username, instanceId);
    const session = await this.getValidSession(sessionId);
    return session ? sessionId : null;
  }

  /**
   * Remove a session (logout)
   */
  async removeSession(sessionId: string): Promise<void> {
    try {
      const result = await this.db.execute(`
        DELETE FROM archer_sessions WHERE session_id = ?
      `, [sessionId]);
      
      console.log(`[Archer Session] Session removed: ${sessionId}`);
    } catch (error: any) {
      console.error(`[Archer Session] Error removing session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update session expiration (extend session)
   */
  async extendSession(sessionId: string, newExpiresAt: Date): Promise<boolean> {
    try {
      const result = await this.db.execute(`
        UPDATE archer_sessions 
        SET expires_at = ?, updated_at = datetime('now')
        WHERE session_id = ? AND expires_at > datetime('now')
      `, [newExpiresAt.toISOString(), sessionId]);
      
      console.log(`[Archer Session] Extended session ${sessionId} until ${newExpiresAt}`);
      return true;
    } catch (error: any) {
      console.error(`[Archer Session] Error extending session: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate consistent session ID for a user
   */
  private generateSessionId(tenantId: string, username: string, instanceId?: string): string {
    const key = `${tenantId}:${username}:${instanceId || 'default'}`;
    return Buffer.from(key).toString('base64').replace(/[+/=]/g, '');
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await this.db.execute(`
        DELETE FROM archer_sessions WHERE expires_at <= datetime('now')
      `);
      
      console.log(`[Archer Session] Cleaned up expired sessions`);
    } catch (error: any) {
      console.error(`[Archer Session] Error cleaning up expired sessions: ${error.message}`);
    }
  }

  /**
   * Get expired session data (for refresh operations)
   * This method can retrieve expired sessions that getValidSession() would reject
   */
  async getExpiredSessionData(sessionId: string): Promise<{
    username: string;
    instance_id: string;
    base_url: string;
    user_domain_id?: string;
    tenant_id: string;
  } | null> {
    try {
      const results = await this.db.query<{
        username: string;
        instance_id: string;
        base_url: string;
        user_domain_id: string;
        tenant_id: string;
      }>(`
        SELECT username, instance_id, base_url, user_domain_id, tenant_id
        FROM archer_sessions 
        WHERE session_id = ?
      `, [sessionId]);
      
      if (results.length === 0) {
        return null;
      }
      
      return results[0];
    } catch (error: any) {
      console.error(`[Archer Session] Error getting expired session data: ${error.message}`);
      return null;
    }
  }

  /**
   * Update session token and expiration (for refresh operations)
   */
  async updateSessionToken(sessionId: string, newToken: string, newExpiresAt: Date): Promise<boolean> {
    try {
      const result = await this.db.execute(`
        UPDATE archer_sessions 
        SET session_token = ?, expires_at = ?, updated_at = datetime('now')
        WHERE session_id = ?
      `, [newToken, newExpiresAt.toISOString(), sessionId]);
      
      console.log(`[Archer Session] Updated session token for ${sessionId}, expires: ${newExpiresAt}`);
      return true;
    } catch (error: any) {
      console.error(`[Archer Session] Error updating session token: ${error.message}`);
      return false;
    }
  }

  /**
   * Get session statistics for monitoring
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    try {
      const activeResults = await this.db.query<{ count: number }>(`
        SELECT COUNT(*) as count FROM archer_sessions WHERE expires_at > datetime('now')
      `);
      
      const totalResults = await this.db.query<{ count: number }>(`
        SELECT COUNT(*) as count FROM archer_sessions
      `);
      
      const activeSessions = activeResults[0]?.count || 0;
      const totalSessions = totalResults[0]?.count || 0;
      const expiredSessions = totalSessions - activeSessions;
      
      return {
        totalSessions,
        activeSessions,
        expiredSessions
      };
    } catch (error: any) {
      console.error(`[Archer Session] Error getting session stats: ${error.message}`);
      return { totalSessions: 0, activeSessions: 0, expiredSessions: 0 };
    }
  }
}

// Singleton instance
export const archerSessionService = new ArcherSessionService();