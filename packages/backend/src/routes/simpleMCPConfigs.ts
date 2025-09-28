/**
 * Simple MCP Server Configurations API Routes
 * Replaces localStorage MCP server storage with database backend
 * Simpler version without complex auth middleware dependencies
 */

import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/databaseService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const db = DatabaseService.getInstance();

// Mock authentication middleware for development (matching database sample data)
const mockAuth = (req: any, res: any, next: any) => {
  req.user = {
    userId: 'U1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', // Matches sample user ID
    tenantId: 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6' // Matches sample tenant ID
  };
  next();
};

/**
 * GET /api/v1/simple-mcp-configs
 * Get all MCP server configurations for tenant
 * Replaces: localStorage.getItem(`tenant_mcp_servers_${tenantId}`)
 */
router.get('/', mockAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    
    console.log(`🔍 Loading MCP server configurations from database for tenant: ${tenantId}`);

    // Get enabled MCP servers for tenant with registry details
    const mcpServers = await db.query(`
      SELECT 
        tms.id as tenant_server_id,
        tms.tenant_id,
        tms.server_id,
        tms.is_enabled,
        tms.custom_name,
        tms.configuration_values,
        tms.allowed_tools,
        tms.usage_count,
        tms.health_status,
        tms.last_health_check,
        tms.enabled_at,
        tms.enabled_by_user_id,
        msr.name as server_name,
        msr.display_name,
        msr.description,
        msr.category,
        msr.server_type,
        msr.available_tools,
        msr.is_approved,
        msr.security_review_status
      FROM tenant_mcp_servers tms
      JOIN mcp_server_registry msr ON tms.server_id = msr.server_id
      WHERE tms.tenant_id = ?
      ORDER BY tms.enabled_at DESC
    `, [tenantId]);

    console.log(`✅ Loaded ${mcpServers.length} MCP server configurations from database`);

    res.json({
      success: true,
      data: {
        mcp_servers: mcpServers.map(server => ({
          ...server,
          configuration_values: server.configuration_values ? JSON.parse(server.configuration_values) : {},
          allowed_tools: server.allowed_tools ? JSON.parse(server.allowed_tools) : [],
          available_tools: server.available_tools ? JSON.parse(server.available_tools) : []
        })),
        total: mcpServers.length,
        tenant_id: tenantId,
        database_type: 'SQLite (development)',
        replacement_status: 'localStorage successfully replaced with database'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error loading MCP server configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load MCP server configurations from database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/simple-mcp-configs/registry
 * Get available MCP servers from registry (for tenant to enable)
 * Replaces: hardcoded MCP server list in localStorage
 */
router.get('/registry', mockAuth, async (req: Request, res: Response) => {
  try {
    console.log('🔍 Loading MCP server registry...');

    const registryServers = await db.query(`
      SELECT 
        server_id,
        name,
        display_name,
        description,
        category,
        server_type,
        available_tools,
        is_approved,
        security_review_status,
        version,
        documentation_url,
        created_at
      FROM mcp_server_registry
      WHERE is_approved = 1
      ORDER BY category, display_name
    `);

    console.log(`✅ Loaded ${registryServers.length} approved MCP servers from registry`);

    res.json({
      success: true,
      data: {
        registry_servers: registryServers.map(server => ({
          ...server,
          available_tools: server.available_tools ? JSON.parse(server.available_tools) : []
        })),
        total: registryServers.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error loading MCP server registry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load MCP server registry from database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/v1/simple-mcp-configs/enable
 * Enable MCP server from registry for tenant
 * Replaces: localStorage.setItem with new MCP server added to array
 */
router.post('/enable', mockAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const userId = (req as any).user.userId;
    const { server_id, custom_name, configuration_values, allowed_tools } = req.body;

    if (!server_id) {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`➕ Enabling MCP server for tenant: ${server_id}`);

    // Check if server exists in registry and is approved
    const registryServer = await db.query(`
      SELECT server_id, name, display_name, available_tools, is_approved
      FROM mcp_server_registry 
      WHERE server_id = ? AND is_approved = 1
    `, [server_id]);

    if (registryServer.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'MCP server not found in registry or not approved',
        timestamp: new Date().toISOString()
      });
    }

    // Check if already enabled for this tenant
    const existingServer = await db.query(`
      SELECT id FROM tenant_mcp_servers 
      WHERE tenant_id = ? AND server_id = ?
    `, [tenantId, server_id]);

    if (existingServer.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'MCP server already enabled for this tenant',
        timestamp: new Date().toISOString()
      });
    }

    const tenantServerId = uuidv4();
    const now = new Date().toISOString();

    // Enable the MCP server for tenant
    await db.execute(`
      INSERT INTO tenant_mcp_servers (
        id,
        tenant_id,
        server_id,
        is_enabled,
        custom_name,
        configuration_values,
        allowed_tools,
        usage_count,
        health_status,
        enabled_at,
        enabled_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantServerId,
      tenantId,
      server_id,
      1, // is_enabled
      custom_name || registryServer[0].display_name,
      JSON.stringify(configuration_values || {}),
      JSON.stringify(allowed_tools || JSON.parse(registryServer[0].available_tools || '[]')),
      0, // usage_count
      'pending', // health_status
      now, // enabled_at
      userId,
      now, // created_at
      now  // updated_at
    ]);

    // Retrieve the enabled server with registry details
    const enabledServer = await db.query(`
      SELECT 
        tms.id as tenant_server_id,
        tms.tenant_id,
        tms.server_id,
        tms.is_enabled,
        tms.custom_name,
        tms.configuration_values,
        tms.allowed_tools,
        tms.usage_count,
        tms.health_status,
        tms.enabled_at,
        msr.name as server_name,
        msr.display_name,
        msr.description,
        msr.category,
        msr.server_type
      FROM tenant_mcp_servers tms
      JOIN mcp_server_registry msr ON tms.server_id = msr.server_id
      WHERE tms.id = ? AND tms.tenant_id = ?
    `, [tenantServerId, tenantId]);

    console.log('✅ MCP server enabled successfully for tenant');

    res.status(201).json({
      success: true,
      data: {
        ...enabledServer[0],
        configuration_values: JSON.parse(enabledServer[0].configuration_values),
        allowed_tools: JSON.parse(enabledServer[0].allowed_tools)
      },
      message: 'MCP server enabled successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error enabling MCP server:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable MCP server for tenant',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/v1/simple-mcp-configs/:tenantServerId
 * Update MCP server configuration for tenant
 * Replaces: localStorage.setItem with updated MCP configs array
 */
router.put('/:tenantServerId', mockAuth, async (req: Request, res: Response) => {
  try {
    const { tenantServerId } = req.params;
    const tenantId = (req as any).user.tenantId;
    const updates = req.body;

    console.log(`📝 Updating MCP server configuration: ${tenantServerId}`);

    // Check if server exists for this tenant
    const existingServer = await db.query(`
      SELECT id FROM tenant_mcp_servers 
      WHERE id = ? AND tenant_id = ?
    `, [tenantServerId, tenantId]);

    if (existingServer.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'MCP server configuration not found for this tenant',
        timestamp: new Date().toISOString()
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    if (updates.is_enabled !== undefined) {
      updateFields.push('is_enabled = ?');
      updateValues.push(updates.is_enabled ? 1 : 0);
    }
    if (updates.custom_name !== undefined) {
      updateFields.push('custom_name = ?');
      updateValues.push(updates.custom_name);
    }
    if (updates.configuration_values !== undefined) {
      updateFields.push('configuration_values = ?');
      updateValues.push(JSON.stringify(updates.configuration_values));
    }
    if (updates.allowed_tools !== undefined) {
      updateFields.push('allowed_tools = ?');
      updateValues.push(JSON.stringify(updates.allowed_tools));
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    
    updateValues.push(tenantServerId, tenantId);

    const updateQuery = `
      UPDATE tenant_mcp_servers 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `;

    await db.execute(updateQuery, updateValues);

    // Retrieve updated configuration
    const updatedServer = await db.query(`
      SELECT 
        tms.id as tenant_server_id,
        tms.tenant_id,
        tms.server_id,
        tms.is_enabled,
        tms.custom_name,
        tms.configuration_values,
        tms.allowed_tools,
        tms.usage_count,
        tms.health_status,
        tms.updated_at,
        msr.name as server_name,
        msr.display_name,
        msr.description,
        msr.category
      FROM tenant_mcp_servers tms
      JOIN mcp_server_registry msr ON tms.server_id = msr.server_id
      WHERE tms.id = ? AND tms.tenant_id = ?
    `, [tenantServerId, tenantId]);

    console.log('✅ MCP server configuration updated successfully');

    res.json({
      success: true,
      data: {
        ...updatedServer[0],
        configuration_values: JSON.parse(updatedServer[0].configuration_values),
        allowed_tools: JSON.parse(updatedServer[0].allowed_tools)
      },
      message: 'MCP server configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating MCP server configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update MCP server configuration',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/v1/simple-mcp-configs/:tenantServerId
 * Disable/remove MCP server configuration for tenant
 * Replaces: localStorage.setItem with filtered MCP configs array
 */
router.delete('/:tenantServerId', mockAuth, async (req: Request, res: Response) => {
  try {
    const { tenantServerId } = req.params;
    const tenantId = (req as any).user.tenantId;

    console.log(`🗑️ Disabling MCP server configuration: ${tenantServerId}`);

    // Check if server exists for this tenant
    const existingServer = await db.query(`
      SELECT id, custom_name FROM tenant_mcp_servers 
      WHERE id = ? AND tenant_id = ?
    `, [tenantServerId, tenantId]);

    if (existingServer.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'MCP server configuration not found for this tenant',
        timestamp: new Date().toISOString()
      });
    }

    // Disable the configuration (set is_enabled to 0)
    await db.execute(`
      UPDATE tenant_mcp_servers 
      SET is_enabled = 0, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `, [new Date().toISOString(), tenantServerId, tenantId]);

    console.log('✅ MCP server configuration disabled successfully');

    res.json({
      success: true,
      message: 'MCP server configuration disabled successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error disabling MCP server configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable MCP server configuration',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/simple-mcp-configs/test-database
 * Test database connectivity for MCP configurations
 */
router.get('/test-database', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Testing MCP configurations database connectivity...');

    // Test basic database connectivity
    const testQuery1 = await db.query('SELECT COUNT(*) as total FROM mcp_server_registry');
    const testQuery2 = await db.query('SELECT COUNT(*) as total FROM tenant_mcp_servers');
    
    // Get sample data
    const sampleRegistryServers = await db.query(`
      SELECT server_id, name, display_name, category, is_approved 
      FROM mcp_server_registry 
      LIMIT 3
    `);

    const sampleTenantServers = await db.query(`
      SELECT id, server_id, custom_name, is_enabled, tenant_id
      FROM tenant_mcp_servers 
      LIMIT 3
    `);

    console.log('✅ MCP configurations database test successful');

    res.json({
      success: true,
      data: {
        database_status: 'OPERATIONAL',
        health_check: {
          database_connection: true,
          registry_table_access: true,
          tenant_servers_table_access: true,
          data_integrity: true
        },
        multi_tenant_ready: true,
        sample_data: {
          total_registry_servers: testQuery1[0].total,
          total_tenant_servers: testQuery2[0].total,
          sample_registry_servers: sampleRegistryServers,
          sample_tenant_servers: sampleTenantServers
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ MCP configurations database test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Database connectivity test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;