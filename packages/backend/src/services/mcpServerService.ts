/**
 * MCP Server Service
 * Handles MCP server registry and tenant enablement
 * Replaces localStorage mcp server storage with database operations
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './databaseService';
import { AuditService } from './auditService';

export interface McpServer {
  server_id: string;
  name: string;
  display_name: string;
  description?: string;
  category?: string;
  server_type: 'stdio' | 'sse' | 'websocket';
  executable_path?: string;
  args?: string; // JSON array
  env?: string; // JSON object
  available_tools?: string; // JSON array
  required_permissions?: string; // JSON array
  version?: string;
  vendor?: string;
  documentation_url?: string;
  icon_url?: string;
  is_approved: boolean;
  compliance_frameworks?: string; // JSON array
  security_review_status: 'pending' | 'approved' | 'rejected';
  security_review_notes?: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
}

export interface TenantMcpServer {
  id: string;
  tenant_id: string;
  server_id: string;
  is_enabled: boolean;
  custom_name?: string;
  configuration_values?: string; // JSON object
  allowed_tools?: string; // JSON array
  restricted_permissions?: string; // JSON array
  usage_count: number;
  last_used_at?: string;
  health_status: 'healthy' | 'unhealthy' | 'unknown' | 'disabled';
  last_health_check?: string;
  enabled_by_user_id?: string;
  enabled_at: string;
  created_at: string;
  updated_at: string;
}

export class McpServerService {
  private db: DatabaseService;
  private auditService: AuditService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.auditService = new AuditService();
  }

  /**
   * Get all approved MCP servers from the global registry
   */
  async getApprovedServers(): Promise<McpServer[]> {
    const query = `
      SELECT 
        server_id,
        name,
        display_name,
        description,
        category,
        server_type,
        executable_path,
        args,
        env,
        available_tools,
        required_permissions,
        version,
        vendor,
        documentation_url,
        icon_url,
        is_approved,
        compliance_frameworks,
        security_review_status,
        security_review_notes,
        created_at,
        updated_at,
        approved_at
      FROM mcp_server_registry
      WHERE is_approved = 1 AND security_review_status = 'approved'
      ORDER BY display_name ASC
    `;

    const servers = await this.db.query(query, []);
    
    return servers.map(server => ({
      ...server,
      args: this.safeJsonParse(server.args),
      env: this.safeJsonParse(server.env),
      available_tools: this.safeJsonParse(server.available_tools),
      required_permissions: this.safeJsonParse(server.required_permissions),
      compliance_frameworks: this.safeJsonParse(server.compliance_frameworks)
    }));
  }

  /**
   * Get tenant-enabled MCP servers (used by AgentService)
   */
  async getTenantEnabledServers(
    tenantId: string, 
    serverIds?: string[]
  ): Promise<any[]> {
    let query = `
      SELECT 
        tms.id,
        tms.tenant_id,
        tms.server_id,
        tms.is_enabled,
        tms.custom_name,
        tms.configuration_values,
        tms.allowed_tools,
        tms.restricted_permissions,
        tms.usage_count,
        tms.last_used_at,
        tms.health_status,
        tms.last_health_check,
        tms.enabled_by_user_id,
        tms.enabled_at,
        tms.created_at as tenant_created_at,
        tms.updated_at as tenant_updated_at,
        msr.name,
        msr.display_name,
        msr.description,
        msr.category,
        msr.server_type,
        msr.executable_path,
        msr.args,
        msr.env,
        msr.available_tools,
        msr.required_permissions,
        msr.version,
        msr.vendor,
        msr.documentation_url,
        msr.icon_url
      FROM tenant_mcp_servers tms
      INNER JOIN mcp_server_registry msr ON tms.server_id = msr.server_id
      WHERE tms.tenant_id = ?
    `;

    const params = [tenantId];

    if (serverIds && serverIds.length > 0) {
      query += ` AND tms.server_id IN (${serverIds.map(() => '?').join(', ')})`;
      params.push(...serverIds);
    }

    query += ` ORDER BY msr.display_name ASC`;

    const results = await this.db.query(query, params, tenantId);

    return results.map(server => ({
      ...server,
      configuration_values: this.safeJsonParse(server.configuration_values),
      allowed_tools: this.safeJsonParse(server.allowed_tools),
      restricted_permissions: this.safeJsonParse(server.restricted_permissions),
      args: this.safeJsonParse(server.args),
      env: this.safeJsonParse(server.env),
      available_tools: this.safeJsonParse(server.available_tools),
      required_permissions: this.safeJsonParse(server.required_permissions)
    }));
  }

  /**
   * Enable an MCP server for a tenant
   */
  async enableServerForTenant(
    tenantId: string,
    userId: string,
    serverId: string,
    options: {
      customName?: string;
      configurationValues?: Record<string, any>;
      allowedTools?: string[];
      restrictedPermissions?: string[];
    } = {}
  ): Promise<TenantMcpServer> {
    // Check if server exists and is approved
    const serverQuery = `
      SELECT server_id FROM mcp_server_registry 
      WHERE server_id = ? AND is_approved = 1 AND security_review_status = 'approved'
    `;
    const serverExists = await this.db.query(serverQuery, [serverId]);
    if (serverExists.length === 0) {
      throw new Error('MCP server not found or not approved');
    }

    // Check if already enabled
    const existingQuery = `
      SELECT id FROM tenant_mcp_servers 
      WHERE tenant_id = ? AND server_id = ?
    `;
    const existing = await this.db.query(existingQuery, [tenantId, serverId], tenantId);
    if (existing.length > 0) {
      throw new Error('MCP server already enabled for this tenant');
    }

    const enablementId = uuidv4();
    const now = new Date().toISOString();

    const insertQuery = `
      INSERT INTO tenant_mcp_servers (
        id,
        tenant_id,
        server_id,
        is_enabled,
        custom_name,
        configuration_values,
        allowed_tools,
        restricted_permissions,
        usage_count,
        health_status,
        enabled_by_user_id,
        enabled_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      enablementId,
      tenantId,
      serverId,
      true,
      options.customName || null,
      JSON.stringify(options.configurationValues || {}),
      JSON.stringify(options.allowedTools || []),
      JSON.stringify(options.restrictedPermissions || []),
      0, // usage_count
      'unknown', // health_status
      userId,
      now,
      now,
      now
    ];

    await this.db.execute(insertQuery, params, tenantId);

    // Log audit event
    await this.auditService.logEvent({
      eventType: 'mcp_server_enabled',
      eventCategory: 'configuration',
      severity: 'info',
      userId,
      tenantId,
      resourceType: 'mcp_server',
      resourceId: serverId,
      eventSummary: `MCP server '${serverId}' enabled for tenant`,
      eventDetails: {
        serverId,
        customName: options.customName,
        allowedTools: options.allowedTools,
        restrictedPermissions: options.restrictedPermissions
      }
    });

    // Return the enabled server configuration
    const enabled = await this.getTenantEnabledServers(tenantId, [serverId]);
    return enabled[0];
  }

  /**
   * Disable an MCP server for a tenant
   */
  async disableServerForTenant(
    tenantId: string,
    userId: string,
    serverId: string
  ): Promise<boolean> {
    const query = `
      UPDATE tenant_mcp_servers 
      SET is_enabled = 0, updated_at = ?
      WHERE tenant_id = ? AND server_id = ?
    `;

    const result = await this.db.execute(query, [new Date().toISOString(), tenantId, serverId], tenantId);

    if (result) {
      await this.auditService.logEvent({
        eventType: 'mcp_server_disabled',
        eventCategory: 'configuration',
        severity: 'info',
        userId,
        tenantId,
        resourceType: 'mcp_server',
        resourceId: serverId,
        eventSummary: `MCP server '${serverId}' disabled for tenant`
      });
      return true;
    }

    return false;
  }

  /**
   * Update MCP server configuration for a tenant
   */
  async updateServerConfiguration(
    tenantId: string,
    userId: string,
    serverId: string,
    updates: {
      customName?: string;
      configurationValues?: Record<string, any>;
      allowedTools?: string[];
      restrictedPermissions?: string[];
      isEnabled?: boolean;
    }
  ): Promise<TenantMcpServer | null> {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.customName !== undefined) {
      updateFields.push('custom_name = ?');
      params.push(updates.customName);
    }
    if (updates.configurationValues !== undefined) {
      updateFields.push('configuration_values = ?');
      params.push(JSON.stringify(updates.configurationValues));
    }
    if (updates.allowedTools !== undefined) {
      updateFields.push('allowed_tools = ?');
      params.push(JSON.stringify(updates.allowedTools));
    }
    if (updates.restrictedPermissions !== undefined) {
      updateFields.push('restricted_permissions = ?');
      params.push(JSON.stringify(updates.restrictedPermissions));
    }
    if (updates.isEnabled !== undefined) {
      updateFields.push('is_enabled = ?');
      params.push(updates.isEnabled);
    }

    if (updateFields.length === 0) {
      return null;
    }

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(tenantId, serverId);

    const query = `
      UPDATE tenant_mcp_servers 
      SET ${updateFields.join(', ')}
      WHERE tenant_id = ? AND server_id = ?
    `;

    await this.db.execute(query, params, tenantId);

    // Log audit event
    await this.auditService.logEvent({
      eventType: 'mcp_server_updated',
      eventCategory: 'configuration',
      severity: 'info',
      userId,
      tenantId,
      resourceType: 'mcp_server',
      resourceId: serverId,
      eventSummary: `MCP server '${serverId}' configuration updated`,
      eventDetails: updates
    });

    // Return updated configuration
    const updated = await this.getTenantEnabledServers(tenantId, [serverId]);
    return updated[0] || null;
  }

  /**
   * Perform health check on MCP server
   */
  async performHealthCheck(
    tenantId: string,
    serverId: string
  ): Promise<{ healthy: boolean; error?: string }> {
    try {
      // TODO: Implement actual MCP server health check
      // This would involve connecting to the server and running a simple test
      
      // Mock implementation for now
      const isHealthy = Math.random() > 0.1; // 90% success rate
      const healthStatus = isHealthy ? 'healthy' : 'unhealthy';
      const error = isHealthy ? undefined : 'Connection timeout';

      // Update health status in database
      const query = `
        UPDATE tenant_mcp_servers 
        SET health_status = ?, last_health_check = ?, updated_at = ?
        WHERE tenant_id = ? AND server_id = ?
      `;

      const now = new Date().toISOString();
      await this.db.execute(query, [healthStatus, now, now, tenantId, serverId], tenantId);

      return {
        healthy: isHealthy,
        error
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Record MCP server usage
   */
  async recordUsage(tenantId: string, serverId: string): Promise<void> {
    const query = `
      UPDATE tenant_mcp_servers 
      SET usage_count = usage_count + 1, 
          last_used_at = ?, 
          updated_at = ?
      WHERE tenant_id = ? AND server_id = ?
    `;

    const now = new Date().toISOString();
    await this.db.execute(query, [now, now, tenantId, serverId], tenantId);
  }

  /**
   * Get MCP server usage statistics for tenant
   */
  async getTenantUsageStats(tenantId: string): Promise<{
    total_enabled: number;
    total_usage: number;
    most_used_server: string | null;
    health_summary: Record<string, number>;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_enabled,
        SUM(usage_count) as total_usage,
        health_status
      FROM tenant_mcp_servers
      WHERE tenant_id = ? AND is_enabled = 1
      GROUP BY health_status
    `;

    const results = await this.db.query(query, [tenantId], tenantId);

    const healthSummary: Record<string, number> = {};
    let totalEnabled = 0;
    let totalUsage = 0;

    results.forEach(row => {
      healthSummary[row.health_status] = row.total_enabled;
      totalEnabled += row.total_enabled;
      totalUsage += row.total_usage || 0;
    });

    // Get most used server
    const mostUsedQuery = `
      SELECT TOP 1 msr.display_name
      FROM tenant_mcp_servers tms
      INNER JOIN mcp_server_registry msr ON tms.server_id = msr.server_id
      WHERE tms.tenant_id = ? AND tms.is_enabled = 1
      ORDER BY tms.usage_count DESC
    `;

    const mostUsedResult = await this.db.query(mostUsedQuery, [tenantId], tenantId);
    const mostUsedServer = mostUsedResult.length > 0 ? mostUsedResult[0].display_name : null;

    return {
      total_enabled: totalEnabled,
      total_usage: totalUsage,
      most_used_server: mostUsedServer,
      health_summary: healthSummary
    };
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