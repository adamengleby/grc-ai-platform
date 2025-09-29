/**
 * MCP Tool Access Control API Routes
 * Provides admin UI for managing which user groups can access which MCP tools
 */

import express from 'express';
import { DatabaseService } from '../services/databaseService';
import { oauthMcpService } from '../services/oauthMcpService';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const db = DatabaseService.getInstance();

// Get all tool groups for a tenant
router.get('/groups', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';

    const groups = await db.query<{
      group_id: string;
      group_name: string;
      description: string;
      created_at: string;
      tool_count: number;
    }>(`
      SELECT 
        g.group_id,
        g.group_name,
        g.description,
        g.created_at,
        COUNT(gt.tool_name) as tool_count
      FROM mcp_tool_groups g
      LEFT JOIN mcp_tool_group_tools gt ON g.group_id = gt.group_id
      WHERE g.tenant_id = ?
      GROUP BY g.group_id, g.group_name, g.description, g.created_at
      ORDER BY g.group_name
    `, [tenantId]);

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Failed to get tool groups:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve tool groups' }
    });
  }
});

// Get tools for a specific group
router.get('/groups/:groupId/tools', async (req, res) => {
  try {
    const { groupId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';

    const tools = await db.query<{
      id: string;
      server_id: string;
      tool_name: string;
      allowed_scopes: string;
      server_name: string;
      server_display_name: string;
    }>(`
      SELECT 
        gt.id,
        gt.server_id,
        gt.tool_name,
        gt.allowed_scopes,
        sr.name as server_name,
        sr.display_name as server_display_name
      FROM mcp_tool_group_tools gt
      JOIN mcp_server_registry sr ON gt.server_id = sr.server_id
      WHERE gt.group_id = ? AND gt.tenant_id = ?
      ORDER BY sr.display_name, gt.tool_name
    `, [groupId, tenantId]);

    // Parse allowed_scopes JSON
    const parsedTools = tools.map(tool => ({
      ...tool,
      allowed_scopes: JSON.parse(tool.allowed_scopes)
    }));

    res.json({
      success: true,
      data: parsedTools
    });
  } catch (error) {
    console.error('Failed to get group tools:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve group tools' }
    });
  }
});

// Get available MCP servers and their tools
router.get('/available-tools', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';

    const servers = await db.query<{
      server_id: string;
      name: string;
      display_name: string;
      description: string;
      available_tools: string;
    }>(`
      SELECT 
        sr.server_id,
        sr.name,
        sr.display_name,
        sr.description,
        sr.available_tools
      FROM mcp_server_registry sr
      JOIN tenant_mcp_servers tms ON sr.server_id = tms.server_id
      WHERE tms.tenant_id = ? AND tms.is_enabled = 1 AND sr.is_approved = 1
      ORDER BY sr.display_name
    `, [tenantId]);

    // Parse available_tools JSON and expand into individual tools
    const expandedTools = servers.flatMap(server => {
      try {
        const tools = JSON.parse(server.available_tools) as string[];
        return tools.map(toolName => ({
          server_id: server.server_id,
          server_name: server.name,
          server_display_name: server.display_name,
          server_description: server.description,
          tool_name: toolName
        }));
      } catch (error) {
        console.error(`Failed to parse tools for server ${server.server_id}:`, error);
        return [];
      }
    });

    res.json({
      success: true,
      data: expandedTools
    });
  } catch (error) {
    console.error('Failed to get available tools:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve available tools' }
    });
  }
});

// Create new tool group
router.post('/groups', async (req, res) => {
  try {
    const { group_name, description } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';
    const userId = req.headers['x-user-id'] as string || 'U1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6';

    if (!group_name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Group name is required' }
      });
    }

    const groupId = uuidv4();

    await db.execute(`
      INSERT INTO mcp_tool_groups (group_id, tenant_id, group_name, description, created_by_user_id)
      VALUES (?, ?, ?, ?, ?)
    `, [groupId, tenantId, group_name, description, userId]);

    res.json({
      success: true,
      data: {
        group_id: groupId,
        group_name,
        description,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to create tool group:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create tool group' }
    });
  }
});

// Add tool to group
router.post('/groups/:groupId/tools', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { server_id, tool_name, allowed_scopes = ['read', 'write'] } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';

    if (!server_id || !tool_name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Server ID and tool name are required' }
      });
    }

    const toolMappingId = uuidv4();

    await db.execute(`
      INSERT INTO mcp_tool_group_tools (id, group_id, tenant_id, server_id, tool_name, allowed_scopes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [toolMappingId, groupId, tenantId, server_id, tool_name, JSON.stringify(allowed_scopes)]);

    res.json({
      success: true,
      data: {
        id: toolMappingId,
        group_id: groupId,
        server_id,
        tool_name,
        allowed_scopes
      }
    });
  } catch (error) {
    console.error('Failed to add tool to group:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to add tool to group' }
    });
  }
});

// Remove tool from group
router.delete('/groups/:groupId/tools/:toolId', async (req, res) => {
  try {
    const { groupId, toolId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';

    await db.execute(`
      DELETE FROM mcp_tool_group_tools 
      WHERE id = ? AND group_id = ? AND tenant_id = ?
    `, [toolId, groupId, tenantId]);

    res.json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    console.error('Failed to remove tool from group:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to remove tool from group' }
    });
  }
});

// Get role-to-group access mappings
router.get('/role-access', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';

    const mappings = await db.query<{
      id: string;
      role_name: string;
      group_id: string;
      group_name: string;
      granted_at: string;
      tool_count: number;
    }>(`
      SELECT 
        ra.id,
        ra.role_name,
        ra.group_id,
        g.group_name,
        ra.granted_at,
        COUNT(gt.tool_name) as tool_count
      FROM mcp_role_tool_access ra
      JOIN mcp_tool_groups g ON ra.group_id = g.group_id
      LEFT JOIN mcp_tool_group_tools gt ON g.group_id = gt.group_id
      WHERE ra.tenant_id = ?
      GROUP BY ra.id, ra.role_name, ra.group_id, g.group_name, ra.granted_at
      ORDER BY ra.role_name, g.group_name
    `, [tenantId]);

    res.json({
      success: true,
      data: mappings
    });
  } catch (error) {
    console.error('Failed to get role access mappings:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve role access mappings' }
    });
  }
});

// Grant role access to tool group
router.post('/role-access', async (req, res) => {
  try {
    const { role_name, group_id } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';
    const userId = req.headers['x-user-id'] as string || 'U1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6';

    if (!role_name || !group_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Role name and group ID are required' }
      });
    }

    const accessId = uuidv4();

    await db.execute(`
      INSERT INTO mcp_role_tool_access (id, tenant_id, role_name, group_id, granted_by_user_id)
      VALUES (?, ?, ?, ?, ?)
    `, [accessId, tenantId, role_name, group_id, userId]);

    res.json({
      success: true,
      data: {
        id: accessId,
        role_name,
        group_id,
        granted_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to grant role access:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to grant role access' }
    });
  }
});

// Revoke role access to tool group
router.delete('/role-access/:accessId', async (req, res) => {
  try {
    const { accessId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';

    await db.execute(`
      DELETE FROM mcp_role_tool_access 
      WHERE id = ? AND tenant_id = ?
    `, [accessId, tenantId]);

    res.json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    console.error('Failed to revoke role access:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to revoke role access' }
    });
  }
});

// Generate OAuth token for user (simulates SAML assertion)
router.post('/oauth/token', async (req, res) => {
  try {
    const { username, groups, tenantId: reqTenantId } = req.body;
    const tenantId = reqTenantId || req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';

    if (!username || !Array.isArray(groups)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Username and groups array are required' }
      });
    }

    const result = await oauthMcpService.generateOAuthTokenFromSAML({
      username,
      groups,
      tenantId,
      sessionExpiresAt: new Date(Date.now() + 3600000) // 1 hour
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Failed to generate OAuth token:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate OAuth token' }
    });
  }
});

// Validate OAuth token
router.post('/oauth/validate', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { message: 'Token is required' }
      });
    }

    const result = await oauthMcpService.validateOAuthToken(token);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Failed to validate OAuth token:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to validate OAuth token' }
    });
  }
});

// Check tool permission
router.post('/oauth/check-permission', async (req, res) => {
  try {
    const { token, server_id, tool_name, scope } = req.body;

    if (!token || !server_id || !tool_name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Token, server_id, and tool_name are required' }
      });
    }

    const hasPermission = await oauthMcpService.hasToolPermission(token, server_id, tool_name, scope);

    res.json({
      success: true,
      data: { 
        has_permission: hasPermission,
        server_id,
        tool_name,
        scope: scope || 'none'
      }
    });
  } catch (error) {
    console.error('Failed to check tool permission:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to check tool permission' }
    });
  }
});

// Get access statistics
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';

    const stats = await oauthMcpService.getToolAccessStats(tenantId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Failed to get access statistics:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve access statistics' }
    });
  }
});

export default router;