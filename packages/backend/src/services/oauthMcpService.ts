/**
 * OAuth MCP Service
 * Bridges SAML authentication to OAuth 2.1 tokens for MCP tool access control
 * Extracts SAML groups and maps them to tool permissions
 */

import { DatabaseService } from './databaseService';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface SAMLAssertion {
  username: string;
  email?: string;
  groups: string[];
  tenantId: string;
  sessionExpiresAt: Date;
}

export interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
  allowed_tools: string[];
}

export interface MCPToolPermission {
  server_id: string;
  tool_name: string;
  allowed_scopes: string[];
}

export class OAuthMCPService {
  private db: DatabaseService;
  private jwtSecret: string;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.jwtSecret = process.env.JWT_SECRET || 'dev-oauth-secret-change-in-production';
  }

  /**
   * Generate OAuth token from SAML assertion for MCP tool access
   * Maps SAML groups to allowed MCP tools based on database configuration
   */
  async generateOAuthTokenFromSAML(assertion: SAMLAssertion): Promise<{
    oauth_token: OAuthToken;
    session_id: string;
    allowed_tools: MCPToolPermission[];
  }> {
    // Get allowed tools for user's SAML groups
    const allowedTools = await this.getToolsForSAMLGroups(
      assertion.tenantId, 
      assertion.groups
    );

    // Create OAuth session
    const sessionId = uuidv4();
    const expiresIn = 3600; // 1 hour
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));

    // Generate JWT access token with tool permissions
    const tokenPayload = {
      sub: assertion.username,
      tenant_id: assertion.tenantId,
      groups: assertion.groups,
      allowed_tools: allowedTools.map(t => `${t.server_id}:${t.tool_name}`),
      scope: this.generateScopeFromTools(allowedTools),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000)
    };

    const accessToken = jwt.sign(tokenPayload, this.jwtSecret);
    
    // Store OAuth session in database (user_id can be null since we're using SAML)
    await this.db.execute(`
      INSERT INTO oauth_sessions (
        session_id, tenant_id, user_id, saml_groups, access_token, 
        expires_at, allowed_tools
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      sessionId,
      assertion.tenantId,
      null, // user_id can be null for SAML-authenticated users
      JSON.stringify(assertion.groups),
      accessToken,
      expiresAt.toISOString(),
      JSON.stringify(allowedTools)
    ]);

    const oauthToken: OAuthToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: this.generateScopeFromTools(allowedTools),
      allowed_tools: allowedTools.map(t => `${t.server_id}:${t.tool_name}`)
    };

    console.log(`[OAuth MCP] Generated token for ${assertion.username} with ${allowedTools.length} tools`);
    console.log(`[OAuth MCP] Groups: ${assertion.groups.join(', ')}`);
    console.log(`[OAuth MCP] Tools: ${allowedTools.map(t => t.tool_name).join(', ')}`);

    return {
      oauth_token: oauthToken,
      session_id: sessionId,
      allowed_tools: allowedTools
    };
  }

  /**
   * Validate OAuth token and return allowed tools
   * Called by MCP server to check if user can access specific tools
   */
  async validateOAuthToken(token: string): Promise<{
    valid: boolean;
    user?: string;
    tenant_id?: string;
    allowed_tools?: MCPToolPermission[];
    groups?: string[];
  }> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Check if session still exists in database
      const sessions = await this.db.query<{
        session_id: string;
        tenant_id: string;
        user_id: string;
        saml_groups: string;
        allowed_tools: string;
        expires_at: string;
      }>(`
        SELECT session_id, tenant_id, user_id, saml_groups, allowed_tools, expires_at
        FROM oauth_sessions 
        WHERE access_token = ? AND expires_at > datetime('now')
      `, [token]);

      if (sessions.length === 0) {
        console.log(`[OAuth MCP] Token not found or expired: ${token.substring(0, 20)}...`);
        return { valid: false };
      }

      const session = sessions[0];
      const allowedTools = JSON.parse(session.allowed_tools) as MCPToolPermission[];
      const groups = JSON.parse(session.saml_groups) as string[];

      // Update last accessed timestamp
      await this.db.execute(`
        UPDATE oauth_sessions 
        SET last_accessed = datetime('now')
        WHERE session_id = ?
      `, [session.session_id]);

      console.log(`[OAuth MCP] Token validated for ${session.user_id} - ${allowedTools.length} tools available`);

      return {
        valid: true,
        user: session.user_id,
        tenant_id: session.tenant_id,
        allowed_tools: allowedTools,
        groups: groups
      };

    } catch (error) {
      console.log(`[OAuth MCP] Token validation failed: ${error.message}`);
      return { valid: false };
    }
  }

  /**
   * Check if user has permission for a specific MCP tool
   */
  async hasToolPermission(token: string, serverId: string, toolName: string, requiredScope?: string): Promise<boolean> {
    const validation = await this.validateOAuthToken(token);
    
    if (!validation.valid || !validation.allowed_tools) {
      return false;
    }

    const hasPermission = validation.allowed_tools.some(tool => 
      tool.server_id === serverId && 
      tool.tool_name === toolName &&
      (!requiredScope || tool.allowed_scopes.includes(requiredScope))
    );

    if (!hasPermission) {
      console.log(`[OAuth MCP] Access denied for ${validation.user} - ${serverId}:${toolName}`);
    }

    return hasPermission;
  }

  /**
   * Get list of tools allowed for SAML groups
   * Maps user's SAML groups to database-configured tool permissions
   */
  private async getToolsForSAMLGroups(tenantId: string, groups: string[]): Promise<MCPToolPermission[]> {
    // DEVELOPMENT MODE: Bypass OAuth permissions and grant access to all tools
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.BYPASS_OAUTH === 'true';
    
    if (isDevelopment) {
      console.log(`[OAuth MCP] DEVELOPMENT MODE: Bypassing OAuth permissions - granting all tools`);
      
      // Return all available MCP tools for the tenant without permission checks
      const allTools: MCPToolPermission[] = [
        // Archer GRC tools - grant access to all
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'get_archer_applications', allowed_scopes: ['read', 'write'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'search_archer_records', allowed_scopes: ['read', 'write'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'get_archer_record', allowed_scopes: ['read', 'write'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'create_archer_record', allowed_scopes: ['read', 'write'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'update_archer_record', allowed_scopes: ['read', 'write'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'delete_archer_record', allowed_scopes: ['read', 'write'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'get_archer_field_definitions', allowed_scopes: ['read'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'get_archer_users', allowed_scopes: ['read'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'get_archer_groups', allowed_scopes: ['read'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'generate_security_events_report', allowed_scopes: ['read'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'generate_compliance_gap_analysis', allowed_scopes: ['read'] },
        { server_id: 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', tool_name: 'generate_risk_assessment_summary', allowed_scopes: ['read'] }
      ];
      
      console.log(`[OAuth MCP] DEVELOPMENT: Granted access to ${allTools.length} tools (OAuth bypassed)`);
      return allTools;
    }

    if (groups.length === 0) {
      console.log(`[OAuth MCP] No SAML groups provided - no tools available`);
      return [];
    }

    // Query database for tools accessible by these groups
    const results = await this.db.query<{
      server_id: string;
      tool_name: string;
      allowed_scopes: string;
    }>(`
      SELECT DISTINCT gt.server_id, gt.tool_name, gt.allowed_scopes
      FROM mcp_role_tool_access ra
      JOIN mcp_tool_groups g ON ra.group_id = g.group_id
      JOIN mcp_tool_group_tools gt ON g.group_id = gt.group_id
      WHERE ra.tenant_id = ? AND ra.role_name IN (${groups.map(() => '?').join(',')})
    `, [tenantId, ...groups]);

    const tools: MCPToolPermission[] = results.map(row => ({
      server_id: row.server_id,
      tool_name: row.tool_name,
      allowed_scopes: JSON.parse(row.allowed_scopes)
    }));

    console.log(`[OAuth MCP] Found ${tools.length} tools for groups: ${groups.join(', ')}`);
    return tools;
  }

  /**
   * Generate OAuth scope string from tools
   */
  private generateScopeFromTools(tools: MCPToolPermission[]): string {
    const scopes = new Set<string>();
    
    tools.forEach(tool => {
      tool.allowed_scopes.forEach(scope => {
        scopes.add(`${tool.server_id}:${tool.tool_name}:${scope}`);
      });
    });

    return Array.from(scopes).join(' ');
  }

  /**
   * Get tool access statistics for monitoring
   */
  async getToolAccessStats(tenantId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    toolAccessCounts: Record<string, number>;
    topUsers: Array<{ user: string; toolCount: number }>;
  }> {
    const sessions = await this.db.query<{
      user_id: string;
      allowed_tools: string;
      expires_at: string;
    }>(`
      SELECT user_id, allowed_tools, expires_at
      FROM oauth_sessions 
      WHERE tenant_id = ?
    `, [tenantId]);

    const now = new Date();
    let activeSessions = 0;
    const toolCounts: Record<string, number> = {};
    const userToolCounts: Record<string, number> = {};

    sessions.forEach(session => {
      const isActive = new Date(session.expires_at) > now;
      if (isActive) {
        activeSessions++;
      }

      try {
        const tools = JSON.parse(session.allowed_tools) as MCPToolPermission[];
        userToolCounts[session.user_id] = tools.length;
        
        tools.forEach(tool => {
          const toolKey = `${tool.server_id}:${tool.tool_name}`;
          toolCounts[toolKey] = (toolCounts[toolKey] || 0) + 1;
        });
      } catch (error) {
        // Skip malformed session data
      }
    });

    const topUsers = Object.entries(userToolCounts)
      .map(([user, toolCount]) => ({ user, toolCount }))
      .sort((a, b) => b.toolCount - a.toolCount)
      .slice(0, 10);

    return {
      totalSessions: sessions.length,
      activeSessions,
      toolAccessCounts: toolCounts,
      topUsers
    };
  }

  /**
   * Clean up expired OAuth sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.db.query<{ deleted: number }>(`
      DELETE FROM oauth_sessions 
      WHERE expires_at < datetime('now')
      RETURNING COUNT(*) as deleted
    `);

    const deletedCount = result[0]?.deleted || 0;
    if (deletedCount > 0) {
      console.log(`[OAuth MCP] Cleaned up ${deletedCount} expired OAuth sessions`);
    }

    return deletedCount;
  }
}

// Singleton instance
export const oauthMcpService = new OAuthMCPService();