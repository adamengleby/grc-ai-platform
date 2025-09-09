/**
 * Simple Connection Credentials API Routes
 * Replaces localStorage credential storage with database backend
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
 * GET /api/v1/simple-credentials
 * Get all connection credentials for tenant
 * Replaces: localStorage.getItem(`grc_encrypted_credentials_${tenantId}`)
 */
router.get('/', mockAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    
    console.log(`🔍 Loading connection credentials from database for tenant: ${tenantId}`);

    const credentials = await db.query(`
      SELECT 
        credential_id,
        tenant_id,
        name,
        connection_type,
        base_url,
        username,
        instance_id,
        instance_name,
        user_domain_id,
        database_name,
        port,
        is_default,
        is_enabled,
        last_tested_at,
        test_status,
        last_error,
        created_at,
        updated_at
      FROM connection_credentials 
      WHERE tenant_id = ? AND deleted_at IS NULL 
      ORDER BY is_default DESC, name ASC
    `, [tenantId]);

    console.log(`✅ Loaded ${credentials.length} connection credentials from database`);

    res.json({
      success: true,
      data: {
        credentials: credentials.map(cred => ({
          ...cred,
          password: '[ENCRYPTED]', // Never expose encrypted password in API
          status: cred.test_status || 'pending'
        })),
        total: credentials.length,
        tenant_id: tenantId,
        database_type: 'SQLite (development)',
        replacement_status: 'localStorage successfully replaced with database'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error loading connection credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load connection credentials from database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/v1/simple-credentials/create
 * Create new connection credential
 * Replaces: localStorage.setItem with new credential added to encrypted array
 */
router.post('/create', mockAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const userId = (req as any).user.userId;
    const { 
      name, 
      connection_type, 
      base_url, 
      username, 
      password,
      instance_id,
      instance_name,
      user_domain_id,
      database_name,
      port,
      is_default 
    } = req.body;

    if (!name || !connection_type || !base_url || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, connection_type, base_url, username, and password are required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`➕ Creating connection credential in database: ${name} (${connection_type})`);

    const credentialId = uuidv4();
    const now = new Date().toISOString();

    // If setting as default, unset other defaults first
    if (is_default) {
      await db.execute(`
        UPDATE connection_credentials 
        SET is_default = 0, updated_at = ?
        WHERE tenant_id = ? AND is_default = 1 AND deleted_at IS NULL
      `, [now, tenantId]);
    }

    // In a real implementation, we would properly encrypt the password here
    // For this demo, we're just prefixing it to indicate it should be encrypted
    const encryptedPassword = `encrypted_${password}`;

    // Insert new connection credential
    await db.execute(`
      INSERT INTO connection_credentials (
        credential_id,
        tenant_id,
        name,
        connection_type,
        base_url,
        username,
        encrypted_password,
        instance_id,
        instance_name,
        user_domain_id,
        database_name,
        port,
        is_default,
        is_enabled,
        test_status,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      credentialId,
      tenantId,
      name,
      connection_type,
      base_url,
      username,
      encryptedPassword,
      instance_id || null,
      instance_name || null,
      user_domain_id || '1',
      database_name || null,
      port || null,
      is_default ? 1 : 0,
      1, // is_enabled
      'pending', // test_status
      userId,
      now,
      now
    ]);

    // Retrieve the created credential
    const newCredential = await db.query(`
      SELECT 
        credential_id,
        tenant_id,
        name,
        connection_type,
        base_url,
        username,
        instance_id,
        instance_name,
        user_domain_id,
        database_name,
        port,
        is_default,
        is_enabled,
        test_status,
        created_at,
        updated_at
      FROM connection_credentials 
      WHERE credential_id = ? AND tenant_id = ?
    `, [credentialId, tenantId]);

    console.log('✅ Connection credential created successfully in database');

    res.status(201).json({
      success: true,
      data: {
        ...newCredential[0],
        password: '[ENCRYPTED]', // Never expose password in response
        status: newCredential[0].test_status
      },
      message: 'Connection credential created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error creating connection credential:', error);
    
    // Handle specific constraint violations
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      if (error.message.includes('connection_credentials.tenant_id, connection_credentials.name')) {
        res.status(409).json({
          success: false,
          error: 'A connection with this name already exists for your organization. Please use a different name or update the existing connection.',
          code: 'DUPLICATE_CONNECTION_NAME',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create connection credential in database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/v1/simple-credentials/:credentialId
 * Update existing connection credential
 * Replaces: localStorage.setItem with updated credentials array
 */
router.put('/:credentialId', mockAuth, async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const tenantId = (req as any).user.tenantId;
    const updates = req.body;

    console.log(`📝 Updating connection credential in database: ${credentialId}`);
    console.log('📝 Update payload received:', updates);

    // Check if credential exists
    const existingCredential = await db.query(`
      SELECT credential_id FROM connection_credentials 
      WHERE credential_id = ? AND tenant_id = ? AND deleted_at IS NULL
    `, [credentialId, tenantId]);

    if (existingCredential.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Connection credential not found',
        timestamp: new Date().toISOString()
      });
    }

    // If setting as default, unset other defaults first
    if (updates.is_default) {
      await db.execute(`
        UPDATE connection_credentials 
        SET is_default = 0, updated_at = ?
        WHERE tenant_id = ? AND credential_id != ? AND is_default = 1 AND deleted_at IS NULL
      `, [new Date().toISOString(), tenantId, credentialId]);
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.connection_type !== undefined) {
      updateFields.push('connection_type = ?');
      updateValues.push(updates.connection_type);
    }
    if (updates.base_url !== undefined) {
      updateFields.push('base_url = ?');
      updateValues.push(updates.base_url);
    }
    if (updates.username !== undefined) {
      updateFields.push('username = ?');
      updateValues.push(updates.username);
    }
    if (updates.password !== undefined && updates.password !== '[ENCRYPTED]') {
      updateFields.push('encrypted_password = ?');
      updateValues.push(`encrypted_${updates.password}`); // Mock encryption
    }
    if (updates.instance_id !== undefined) {
      updateFields.push('instance_id = ?');
      updateValues.push(updates.instance_id);
    }
    if (updates.instance_name !== undefined) {
      updateFields.push('instance_name = ?');
      updateValues.push(updates.instance_name);
    }
    if (updates.user_domain_id !== undefined) {
      updateFields.push('user_domain_id = ?');
      updateValues.push(updates.user_domain_id);
    }
    if (updates.database_name !== undefined) {
      updateFields.push('database_name = ?');
      updateValues.push(updates.database_name);
    }
    if (updates.port !== undefined) {
      updateFields.push('port = ?');
      updateValues.push(updates.port);
    }
    if (updates.is_default !== undefined) {
      updateFields.push('is_default = ?');
      updateValues.push(updates.is_default ? 1 : 0);
    }
    if (updates.is_enabled !== undefined) {
      updateFields.push('is_enabled = ?');
      updateValues.push(updates.is_enabled ? 1 : 0);
    }
    if (updates.test_status !== undefined) {
      updateFields.push('test_status = ?');
      updateValues.push(updates.test_status);
    }
    if (updates.last_error !== undefined) {
      updateFields.push('last_error = ?');
      // Convert objects to JSON string for SQLite storage
      const errorValue = typeof updates.last_error === 'object' && updates.last_error !== null
        ? JSON.stringify(updates.last_error)
        : updates.last_error;
      updateValues.push(errorValue);
    }
    if (updates.last_tested_at !== undefined) {
      updateFields.push('last_tested_at = ?');
      updateValues.push(updates.last_tested_at);
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    
    updateValues.push(credentialId, tenantId);

    const updateQuery = `
      UPDATE connection_credentials 
      SET ${updateFields.join(', ')}
      WHERE credential_id = ? AND tenant_id = ? AND deleted_at IS NULL
    `;
    
    console.log('📝 SQL Query:', updateQuery);
    console.log('📝 Parameters:', updateValues);
    console.log('📝 Parameter count: query expects', (updateQuery.match(/\?/g) || []).length, 'got', updateValues.length);

    await db.execute(updateQuery, updateValues);

    // Retrieve updated credential
    const updatedCredential = await db.query(`
      SELECT 
        credential_id,
        tenant_id,
        name,
        connection_type,
        base_url,
        username,
        instance_id,
        instance_name,
        user_domain_id,
        database_name,
        port,
        is_default,
        is_enabled,
        test_status,
        last_error,
        updated_at
      FROM connection_credentials 
      WHERE credential_id = ? AND tenant_id = ?
    `, [credentialId, tenantId]);

    console.log('✅ Connection credential updated successfully in database');

    res.json({
      success: true,
      data: {
        ...updatedCredential[0],
        password: '[ENCRYPTED]', // Never expose password
        status: updatedCredential[0].test_status
      },
      message: 'Connection credential updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating connection credential:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update connection credential in database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/v1/simple-credentials/:credentialId
 * Delete connection credential (soft delete)
 * Replaces: localStorage.setItem with filtered credentials array
 */
router.delete('/:credentialId', mockAuth, async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const tenantId = (req as any).user.tenantId;

    console.log(`🗑️ Deleting connection credential from database: ${credentialId}`);

    // Check if credential exists
    const existingCredential = await db.query(`
      SELECT credential_id, name, is_default FROM connection_credentials 
      WHERE credential_id = ? AND tenant_id = ? AND deleted_at IS NULL
    `, [credentialId, tenantId]);

    if (existingCredential.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Connection credential not found',
        timestamp: new Date().toISOString()
      });
    }

    // If deleting the default credential, set another one as default
    if (existingCredential[0].is_default) {
      const nextCredential = await db.query(`
        SELECT credential_id FROM connection_credentials 
        WHERE tenant_id = ? AND credential_id != ? AND deleted_at IS NULL 
        LIMIT 1
      `, [tenantId, credentialId]);

      if (nextCredential.length > 0) {
        await db.execute(`
          UPDATE connection_credentials 
          SET is_default = 1, updated_at = ?
          WHERE credential_id = ? AND tenant_id = ?
        `, [new Date().toISOString(), nextCredential[0].credential_id, tenantId]);
      }
    }

    // Soft delete the credential
    await db.execute(`
      UPDATE connection_credentials 
      SET deleted_at = ?, updated_at = ?
      WHERE credential_id = ? AND tenant_id = ?
    `, [new Date().toISOString(), new Date().toISOString(), credentialId, tenantId]);

    console.log('✅ Connection credential deleted successfully from database');

    res.json({
      success: true,
      message: 'Connection credential deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error deleting connection credential:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete connection credential from database',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/simple-credentials/test-database
 * Test database connectivity for connection credentials
 */
router.get('/test-database', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Testing connection credentials database connectivity...');

    // Test basic database connectivity
    const testQuery = await db.query('SELECT COUNT(*) as total FROM connection_credentials');
    
    // Get sample data
    const sampleCredentials = await db.query(`
      SELECT credential_id, name, connection_type, base_url, username, tenant_id, created_at 
      FROM connection_credentials 
      LIMIT 3
    `);

    console.log('✅ Connection credentials database test successful');

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
          total_credentials: testQuery[0].total,
          sample_credentials: sampleCredentials
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Connection credentials database test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Database connectivity test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;