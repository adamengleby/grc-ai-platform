import { Router } from 'express';
import { ArcherConnectionTester } from '../services/connectionTesters/archerTester';
import { SqlServerConnectionTester } from '../services/connectionTesters/sqlServerTester';
import { RestApiConnectionTester } from '../services/connectionTesters/restApiTester';

export const connectionTestRouter = Router();

/**
 * Test Archer GRC connection
 * POST /api/v1/connections/test/archer
 */
connectionTestRouter.post('/test/archer', async (req, res) => {
  try {
    const { baseUrl, username, password, instanceId, userDomainId = "1" } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    // Input validation
    if (!baseUrl || !username || !password || !instanceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required Archer connection parameters: baseUrl, username, password, instanceId'
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID required in x-tenant-id header'
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