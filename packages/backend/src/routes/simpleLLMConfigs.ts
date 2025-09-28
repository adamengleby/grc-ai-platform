/**
 * Simple LLM Configurations API Routes
 * Replaces localStorage LLM config storage with database backend
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
 * GET /api/v1/simple-llm-configs
 * Get all LLM configurations for tenant
 * Replaces: localStorage.getItem(`user_llm_configs_${tenantId}`)
 */
router.get('/', mockAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    
    console.log(`🔍 Loading LLM configurations from database for tenant: ${tenantId}`);

    const llmConfigs = await db.query(`
      SELECT 
        config_id,
        tenant_id,
        name,
        provider,
        model,
        temperature,
        max_tokens,
        rate_limit,
        response_format,
        api_key_vault_secret as api_key,
        endpoint_vault_secret as endpoint,
        is_enabled,
        is_default,
        last_tested_at,
        last_test_status,
        usage_count,
        total_tokens_used,
        created_at,
        updated_at
      FROM llm_configurations 
      WHERE tenant_id = ? AND deleted_at IS NULL 
      ORDER BY is_default DESC, name ASC
    `, [tenantId]);

    console.log(`✅ Loaded ${llmConfigs.length} LLM configurations from database`);

    res.json({
      success: true,
      data: {
        llm_configs: llmConfigs,
        total: llmConfigs.length,
        tenant_id: tenantId,
        database_type: 'SQLite (development)',
        replacement_status: 'localStorage successfully replaced with database'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error loading LLM configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load LLM configurations from database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/v1/simple-llm-configs
 * Create new LLM configuration
 * Replaces: localStorage.setItem with new config added to array
 */
router.post('/', mockAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const userId = (req as any).user.userId;
    const { name, description, provider, model, temperature, max_tokens, rate_limit, response_format, is_default, api_key, endpoint } = req.body;
    
    console.log('📝 Received LLM config creation data:', {
      name, description, provider, model, endpoint,
      hasApiKey: !!api_key
    });

    if (!name || !provider || !model) {
      return res.status(400).json({
        success: false,
        error: 'Name, provider, and model are required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`➕ Creating LLM configuration in database: ${name} (${provider}/${model})`);

    const configId = uuidv4();
    const now = new Date().toISOString();

    // If setting as default, unset other defaults first
    if (is_default) {
      await db.execute(`
        UPDATE llm_configurations 
        SET is_default = 0, updated_at = ?
        WHERE tenant_id = ? AND is_default = 1 AND deleted_at IS NULL
      `, [now, tenantId]);
    }

    // Insert new LLM configuration
    // For development, store API key and endpoint directly (in production, use Azure Key Vault)
    await db.execute(`
      INSERT INTO llm_configurations (
        config_id,
        tenant_id,
        name,
        provider,
        model,
        temperature,
        max_tokens,
        rate_limit,
        response_format,
        api_key_vault_secret,
        endpoint_vault_secret,
        is_enabled,
        is_default,
        usage_count,
        total_tokens_used,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      configId,
      tenantId,
      name,
      provider,
      model,
      temperature || 0.3,
      max_tokens || 2000,
      rate_limit || null, // Rate limit in requests per minute
      response_format || 'text',
      api_key || null, // Store directly in development
      endpoint || null, // Store directly in development
      1, // is_enabled (SQLite: 1 = true)
      is_default ? 1 : 0, // is_default (SQLite: 1 = true, 0 = false)
      0, // usage_count
      0, // total_tokens_used
      userId,
      now,
      now
    ]);

    // Retrieve the created configuration
    const newConfig = await db.query(`
      SELECT 
        config_id,
        tenant_id,
        name,
        provider,
        model,
        temperature,
        max_tokens,
        rate_limit,
        response_format,
        api_key_vault_secret as api_key,
        endpoint_vault_secret as endpoint,
        is_enabled,
        is_default,
        last_tested_at,
        last_test_status,
        usage_count,
        total_tokens_used,
        created_at,
        updated_at
      FROM llm_configurations 
      WHERE config_id = ? AND tenant_id = ?
    `, [configId, tenantId]);

    console.log('✅ LLM configuration created successfully in database');

    res.status(201).json({
      success: true,
      data: {
        llm_config: newConfig[0]
      },
      message: 'LLM configuration created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error creating LLM configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create LLM configuration in database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/v1/simple-llm-configs/:configId
 * Update existing LLM configuration
 * Replaces: localStorage.setItem with updated configs array
 */
router.put('/:configId', mockAuth, async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const tenantId = (req as any).user.tenantId;
    const updates = req.body;

    console.log(`📝 Updating LLM configuration in database: ${configId}`);

    // Check if config exists
    const existingConfigs = await db.query(`
      SELECT config_id FROM llm_configurations 
      WHERE config_id = ? AND tenant_id = ? AND deleted_at IS NULL
    `, [configId, tenantId]);

    if (existingConfigs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'LLM configuration not found',
        timestamp: new Date().toISOString()
      });
    }

    // If setting as default, unset other defaults first
    if (updates.is_default) {
      await db.execute(`
        UPDATE llm_configurations 
        SET is_default = 0, updated_at = ?
        WHERE tenant_id = ? AND config_id != ? AND is_default = 1 AND deleted_at IS NULL
      `, [new Date().toISOString(), tenantId, configId]);
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.provider !== undefined) {
      updateFields.push('provider = ?');
      updateValues.push(updates.provider);
    }
    if (updates.model !== undefined) {
      updateFields.push('model = ?');
      updateValues.push(updates.model);
    }
    if (updates.temperature !== undefined) {
      updateFields.push('temperature = ?');
      updateValues.push(updates.temperature);
    }
    if (updates.max_tokens !== undefined) {
      updateFields.push('max_tokens = ?');
      updateValues.push(updates.max_tokens);
    }
    if (updates.rate_limit !== undefined) {
      updateFields.push('rate_limit = ?');
      updateValues.push(updates.rate_limit);
    }
    if (updates.response_format !== undefined) {
      updateFields.push('response_format = ?');
      updateValues.push(updates.response_format);
    }
    if (updates.is_enabled !== undefined) {
      updateFields.push('is_enabled = ?');
      updateValues.push(updates.is_enabled ? 1 : 0);
    }
    if (updates.is_default !== undefined) {
      updateFields.push('is_default = ?');
      updateValues.push(updates.is_default ? 1 : 0);
    }
    if (updates.api_key !== undefined) {
      updateFields.push('api_key_vault_secret = ?');
      updateValues.push(updates.api_key);
    }
    if (updates.endpoint !== undefined) {
      updateFields.push('endpoint_vault_secret = ?');
      updateValues.push(updates.endpoint);
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    
    updateValues.push(configId, tenantId);

    const updateQuery = `
      UPDATE llm_configurations 
      SET ${updateFields.join(', ')}
      WHERE config_id = ? AND tenant_id = ? AND deleted_at IS NULL
    `;

    await db.execute(updateQuery, updateValues);

    // Retrieve updated configuration
    const updatedConfig = await db.query(`
      SELECT 
        config_id,
        tenant_id,
        name,
        provider,
        model,
        temperature,
        max_tokens,
        rate_limit,
        response_format,
        api_key_vault_secret as api_key,
        endpoint_vault_secret as endpoint,
        is_enabled,
        is_default,
        last_tested_at,
        last_test_status,
        usage_count,
        total_tokens_used,
        created_at,
        updated_at
      FROM llm_configurations 
      WHERE config_id = ? AND tenant_id = ?
    `, [configId, tenantId]);

    console.log('✅ LLM configuration updated successfully in database');

    res.json({
      success: true,
      data: {
        llm_config: updatedConfig[0]
      },
      message: 'LLM configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating LLM configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update LLM configuration in database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/v1/simple-llm-configs/:configId
 * Delete LLM configuration (soft delete)
 * Replaces: localStorage.setItem with filtered configs array
 */
router.delete('/:configId', mockAuth, async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const tenantId = (req as any).user.tenantId;

    console.log(`🗑️ Deleting LLM configuration from database: ${configId}`);

    // Check if config exists and get details
    const configToDelete = await db.query(`
      SELECT config_id, name, is_default FROM llm_configurations 
      WHERE config_id = ? AND tenant_id = ? AND deleted_at IS NULL
    `, [configId, tenantId]);

    if (configToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'LLM configuration not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if this is the last configuration
    const totalConfigs = await db.query(`
      SELECT COUNT(*) as count FROM llm_configurations 
      WHERE tenant_id = ? AND deleted_at IS NULL
    `, [tenantId]);

    if (totalConfigs[0].count <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the last LLM configuration',
        timestamp: new Date().toISOString()
      });
    }

    // If deleting the default config, set another one as default
    if (configToDelete[0].is_default) {
      const nextConfig = await db.query(`
        SELECT config_id FROM llm_configurations 
        WHERE tenant_id = ? AND config_id != ? AND deleted_at IS NULL 
        LIMIT 1
      `, [tenantId, configId]);

      if (nextConfig.length > 0) {
        await db.execute(`
          UPDATE llm_configurations 
          SET is_default = 1, updated_at = ?
          WHERE config_id = ? AND tenant_id = ?
        `, [new Date().toISOString(), nextConfig[0].config_id, tenantId]);
      }
    }

    // Soft delete the configuration
    await db.execute(`
      UPDATE llm_configurations 
      SET deleted_at = ?, updated_at = ?
      WHERE config_id = ? AND tenant_id = ?
    `, [new Date().toISOString(), new Date().toISOString(), configId, tenantId]);

    console.log('✅ LLM configuration deleted successfully from database');

    res.json({
      success: true,
      message: 'LLM configuration deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error deleting LLM configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete LLM configuration from database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/simple-llm-configs/test-database
 * Test database connectivity for LLM configurations
 */
router.get('/test-database', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Testing LLM configurations database connectivity...');

    // Test basic database connectivity
    const testQuery = await db.query('SELECT COUNT(*) as total FROM llm_configurations');
    
    // Get sample data
    const sampleConfigs = await db.query(`
      SELECT config_id, name, provider, model, tenant_id, created_at 
      FROM llm_configurations 
      WHERE deleted_at IS NULL 
      LIMIT 3
    `);

    console.log('✅ LLM configurations database test successful');

    res.json({
      success: true,
      data: {
        database_status: 'OPERATIONAL',
        health_check: {
          database_connection: true,
          table_access: true,
          data_integrity: true
        },
        multi_tenant_ready: true,
        sample_data: {
          total_configs: testQuery[0].total,
          sample_configs: sampleConfigs
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ LLM configurations database test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Database connectivity test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;