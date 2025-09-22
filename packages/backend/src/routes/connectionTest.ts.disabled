import { Router } from 'express';
import { ArcherConnectionTester } from '../services/connectionTesters/archerTester';
import { SqlServerConnectionTester } from '../services/connectionTesters/sqlServerTester';
import { RestApiConnectionTester } from '../services/connectionTesters/restApiTester';
import { DatabaseService } from '../services/databaseService';

export const connectionTestRouter = Router();

/**
 * Test Archer GRC connection
 * POST /api/v1/connections/test/archer
 */
connectionTestRouter.post('/test/archer', async (req, res) => {
  try {
    let { baseUrl, username, password, instanceId, userDomainId = null, connectionId } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID required in x-tenant-id header'
      });
    }

    // If connectionId is provided, load credentials from database
    if (connectionId) {
      console.log(`[Connection Test] Loading credentials from database for connection ${connectionId}`);
      const db = DatabaseService.getInstance();
      
      const credentials = await db.query(`
        SELECT credential_id, name, base_url, username, encrypted_password, instance_id, user_domain_id
        FROM connection_credentials 
        WHERE tenant_id = ? AND credential_id = ? AND is_enabled = 1
      `, [tenantId, connectionId]);
      
      if (credentials.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Connection not found or disabled'
        });
      }
      
      const cred = credentials[0];
      // Override with database values and decrypt password
      baseUrl = cred.base_url;
      username = cred.username;
      password = cred.encrypted_password.replace('encrypted_', ''); // Simple decryption
      instanceId = cred.instance_id;
      userDomainId = cred.user_domain_id || null;
      
      console.log(`[Connection Test] Loaded credentials from database for connection ${connectionId}`);
    }
    
    // Input validation
    if (!baseUrl || !username || !password || !instanceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required Archer connection parameters: baseUrl, username, password, instanceId'
      });
    }

    console.log(`[Connection Test] Testing Archer connection for tenant: ${tenantId}`);
    console.log(`[Connection Test] Archer URL: ${baseUrl}, Instance: ${instanceId}`);

    const tester = new ArcherConnectionTester();
    const result = await tester.testConnection({
      baseUrl,
      username, 
      password,
      instanceId,
      userDomainId
    });

    // Update database with test results if connectionId was provided
    if (connectionId) {
      try {
        const db = DatabaseService.getInstance();
        await db.execute(`
          UPDATE connection_credentials 
          SET test_status = ?, last_error = ?, last_tested_at = ?, updated_at = ?
          WHERE credential_id = ? AND tenant_id = ?
        `, [
          result.success ? 'success' : 'failed',
          result.success ? null : JSON.stringify(result.error || result.message),
          new Date().toISOString(),
          new Date().toISOString(),
          connectionId,
          tenantId
        ]);
        console.log(`[Connection Test] Updated database status for connection ${connectionId}: ${result.success ? 'success' : 'failed'}`);
      } catch (dbError) {
        console.error('[Connection Test] Failed to update database status:', dbError);
        // Don't fail the response if database update fails
      }
    }

    return res.json({
      success: result.success,
      message: result.message,
      responseTime: result.responseTime,
      details: result.details,
      error: result.error
    });

  } catch (error) {
    console.error('[Connection Test] Archer test failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during connection test'
    });
  }
});

/**
 * Test SQL Server connection
 * POST /api/v1/connections/test/sql-server
 */
connectionTestRouter.post('/test/sql-server', async (req, res) => {
  try {
    const { host, port, database, username, password, encrypt = true } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!host || !database || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required SQL Server parameters: host, database, username, password'
      });
    }

    console.log(`[Connection Test] Testing SQL Server connection for tenant: ${tenantId}`);
    
    const tester = new SqlServerConnectionTester();
    const result = await tester.testConnection({
      host,
      port: port || 1433,
      database,
      username,
      password,
      encrypt
    });

    return res.json(result);

  } catch (error) {
    console.error('[Connection Test] SQL Server test failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'SQL Server connection test failed'
    });
  }
});

/**
 * Test REST API connection
 * POST /api/v1/connections/test/rest-api
 */
connectionTestRouter.post('/test/rest-api', async (req, res) => {
  try {
    const { baseUrl, authType, apiKey, bearerToken, username, password } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!baseUrl) {
      return res.status(400).json({
        success: false,
        error: 'baseUrl is required for REST API connection'
      });
    }

    console.log(`[Connection Test] Testing REST API connection for tenant: ${tenantId}`);
    
    const tester = new RestApiConnectionTester();
    const result = await tester.testConnection({
      baseUrl,
      authType,
      apiKey,
      bearerToken,
      username,
      password
    });

    return res.json(result);

  } catch (error) {
    console.error('[Connection Test] REST API test failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'REST API connection test failed'
    });
  }
});

/**
 * Generic connection test endpoint that routes to specific testers
 * POST /api/v1/connections/test
 */
connectionTestRouter.post('/test', async (req, res) => {
  try {
    const { type, ...connectionParams } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Connection type is required'
      });
    }

    console.log(`[Connection Test] Testing ${type} connection for tenant: ${tenantId}`);

    // Route to specific tester based on type
    switch (type.toLowerCase()) {
      case 'archer-grc':
      case 'archer':
        req.body = connectionParams;
        return connectionTestRouter.handle({...req, url: '/test/archer'}, res, () => {});
        
      case 'sql-server':
        req.body = connectionParams;
        return connectionTestRouter.handle({...req, url: '/test/sql-server'}, res, () => {});
        
      case 'rest-api':
        req.body = connectionParams;
        return connectionTestRouter.handle({...req, url: '/test/rest-api'}, res, () => {});
        
      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported connection type: ${type}`
        });
    }

  } catch (error) {
    console.error('[Connection Test] Generic test failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    });
  }
});

export default connectionTestRouter;