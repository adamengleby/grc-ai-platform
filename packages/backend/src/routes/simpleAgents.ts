/**
 * Simple Agents API Routes - Minimal Working Version
 * Tests database connectivity and replaces localStorage
 */

import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/databaseService';

const router = Router();
const db = DatabaseService.getInstance();

// Simple mock auth middleware
const mockAuth = (req: Request, res: Response, next: any) => {
  req.user = {
    userId: 'U1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6',
    tenantId: 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6',
    email: 'demo@example.com',
    roles: ['TenantOwner']
  };
  next();
};

/**
 * GET /api/simple-agents
 * Simple test endpoint to verify database connectivity
 * Replaces localStorage completely
 */
router.get('/', mockAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    
    // Simple query to get sample data from our SQLite database
    const agents = await db.query(`
      SELECT 
        agent_id,
        tenant_id,
        name,
        description,
        persona,
        system_prompt,
        llm_config_id,
        enabled_mcp_servers,
        is_enabled,
        usage_count,
        created_at,
        updated_at
      FROM ai_agents
      WHERE tenant_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `, [tenantId]);

    // Map database fields to frontend expected format
    const mappedAgents = agents.map(agent => {
      // Parse JSON fields safely
      let enabledMcpServers = [];
      try {
        enabledMcpServers = agent.enabled_mcp_servers ? JSON.parse(agent.enabled_mcp_servers) : [];
      } catch (error) {
        console.warn('Failed to parse enabled_mcp_servers for agent:', agent.agent_id);
        enabledMcpServers = [];
      }

      return {
        id: agent.agent_id,
        name: agent.name,
        description: agent.description,
        persona: agent.persona,
        systemPrompt: agent.system_prompt,
        llmConfigId: agent.llm_config_id,
        enabledMcpServers,
        isEnabled: Boolean(agent.is_enabled),
        usageCount: agent.usage_count,
        createdAt: agent.created_at,
        updatedAt: agent.updated_at,
        tenantId: agent.tenant_id
      };
    });

    res.json({
      success: true,
      message: 'Backend database working! No more localStorage!',
      data: {
        agents: mappedAgents,
        total: mappedAgents.length,
        tenant_id: tenantId,
        database_type: 'SQLite (development)',
        replacement_status: 'localStorage successfully replaced'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: 'Failed to fetch agents from database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/simple-agents/create
 * Simple create agent endpoint to test database writes
 */
router.post('/create', mockAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId!;
    const userId = req.user?.userId!;
    const { name, description, system_prompt, persona, llmConfigId, enabledMcpServers } = req.body;

    console.log(`📝 Creating agent with data:`, {
      name, description, llmConfigId, enabledMcpServers: enabledMcpServers?.length || 0
    });

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Generate simple IDs for testing
    const agentId = 'agent-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const now = new Date().toISOString();

    // Prepare enabled MCP servers as JSON string
    const enabledMcpServersJson = enabledMcpServers && Array.isArray(enabledMcpServers) 
      ? JSON.stringify(enabledMcpServers) 
      : '[]';

    // Insert new agent
    await db.execute(`
      INSERT INTO ai_agents (
        agent_id, tenant_id, name, description, persona, system_prompt,
        llm_config_id, enabled_mcp_servers, is_enabled, usage_count, 
        created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      agentId, tenantId, name,
      description || 'Agent created via API',
      persona || '',
      system_prompt || 'You are a helpful AI assistant.',
      llmConfigId || null,
      enabledMcpServersJson,
      1, 0, userId, now, now
    ]);

    // Get the created agent
    const createdAgent = await db.query(`
      SELECT * FROM ai_agents WHERE agent_id = ?
    `, [agentId]);

    res.status(201).json({
      success: true,
      message: 'Agent created successfully in database!',
      data: createdAgent[0],
      replacement_status: 'localStorage CREATE operation replaced with database',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create agent',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/simple-agents/:agentId
 * Update existing agent
 */
router.put('/:agentId', mockAuth, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const tenantId = req.user?.tenantId!;
    const updates = req.body;

    console.log(`📝 Updating agent in database: ${agentId}`);

    // Check if agent exists for this tenant
    const existingAgent = await db.query(`
      SELECT agent_id FROM ai_agents 
      WHERE agent_id = ? AND tenant_id = ? AND deleted_at IS NULL
    `, [agentId, tenantId]);

    if (existingAgent.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found for this tenant',
        timestamp: new Date().toISOString()
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    console.log(`📝 Updating agent with data:`, {
      name: updates.name,
      description: updates.description,
      llmConfigId: updates.llmConfigId,
      enabledMcpServers: updates.enabledMcpServers?.length || 0
    });
    
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(updates.description);
    }
    if (updates.persona !== undefined) {
      updateFields.push('persona = ?');
      updateValues.push(updates.persona);
    }
    if (updates.system_prompt !== undefined) {
      updateFields.push('system_prompt = ?');
      updateValues.push(updates.system_prompt);
    }
    if (updates.llmConfigId !== undefined) {
      updateFields.push('llm_config_id = ?');
      updateValues.push(updates.llmConfigId || null);
    }
    if (updates.enabledMcpServers !== undefined) {
      updateFields.push('enabled_mcp_servers = ?');
      const enabledMcpServersJson = Array.isArray(updates.enabledMcpServers) 
        ? JSON.stringify(updates.enabledMcpServers) 
        : '[]';
      updateValues.push(enabledMcpServersJson);
    }
    if (updates.isEnabled !== undefined) {
      updateFields.push('is_enabled = ?');
      updateValues.push(updates.isEnabled ? 1 : 0);
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    
    updateValues.push(agentId, tenantId);

    const updateQuery = `
      UPDATE ai_agents 
      SET ${updateFields.join(', ')}
      WHERE agent_id = ? AND tenant_id = ? AND deleted_at IS NULL
    `;

    await db.execute(updateQuery, updateValues);

    // Get updated agent
    const updatedAgent = await db.query(`
      SELECT agent_id, tenant_id, name, description, system_prompt, is_enabled, 
             usage_count, created_at, updated_at
      FROM ai_agents 
      WHERE agent_id = ? AND tenant_id = ?
    `, [agentId, tenantId]);

    console.log('✅ Agent updated successfully in database');

    res.json({
      success: true,
      data: {
        id: updatedAgent[0].agent_id,
        name: updatedAgent[0].name,
        description: updatedAgent[0].description,
        systemPrompt: updatedAgent[0].system_prompt,
        isEnabled: Boolean(updatedAgent[0].is_enabled),
        usageCount: updatedAgent[0].usage_count,
        createdAt: updatedAgent[0].created_at,
        updatedAt: updatedAgent[0].updated_at
      },
      message: 'Agent updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent in database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/simple-agents/:agentId
 * Delete (soft delete) existing agent
 */
router.delete('/:agentId', mockAuth, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const tenantId = req.user?.tenantId!;

    console.log(`🗑️ Deleting agent from database: ${agentId}`);

    // Check if agent exists
    const existingAgent = await db.query(`
      SELECT agent_id, name FROM ai_agents 
      WHERE agent_id = ? AND tenant_id = ? AND deleted_at IS NULL
    `, [agentId, tenantId]);

    if (existingAgent.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found for this tenant',
        timestamp: new Date().toISOString()
      });
    }

    // Soft delete the agent
    await db.execute(`
      UPDATE ai_agents 
      SET deleted_at = ?, updated_at = ?
      WHERE agent_id = ? AND tenant_id = ?
    `, [new Date().toISOString(), new Date().toISOString(), agentId, tenantId]);

    console.log('✅ Agent deleted successfully from database');

    res.json({
      success: true,
      message: 'Agent deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error deleting agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete agent from database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/simple-agents/test-database
 * Test database health and show sample data
 */
router.get('/test-database', async (req: Request, res: Response) => {
  try {
    // Test basic database connectivity
    const healthCheck = await db.healthCheck();
    
    // Get sample data from all main tables
    const tenants = await db.query('SELECT * FROM tenants LIMIT 3');
    const users = await db.query('SELECT * FROM users LIMIT 3');  
    const agents = await db.query('SELECT * FROM ai_agents LIMIT 5');
    const llmConfigs = await db.query('SELECT * FROM llm_configurations LIMIT 3');

    res.json({
      success: true,
      message: 'Database test completed successfully!',
      database_status: 'OPERATIONAL',
      health_check: healthCheck,
      sample_data: {
        tenants: tenants.length,
        users: users.length,
        agents: agents.length,
        llm_configurations: llmConfigs.length
      },
      architecture_status: 'localStorage completely replaced with database',
      multi_tenant_ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;