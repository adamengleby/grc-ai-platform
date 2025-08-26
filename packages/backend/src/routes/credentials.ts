import { Router } from 'express';

export interface ArcherCredentials {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  instanceId: string;
  instanceName: string;
  userDomainId: string;
  isDefault: boolean;
  created: string;
  lastTested?: string;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  lastError?: string;
}

export const credentialsRouter = Router();

/**
 * Get Archer credentials for a tenant
 * This is called by MCP client to get dynamic credentials
 */
credentialsRouter.get('/archer/:tenantId', (req, res): void => {
  const { tenantId } = req.params;

  try {
    // Check if credentials were passed from frontend
    const credentials = (req as any).archerCredentials;
    
    if (credentials && credentials.length > 0) {
      // Return the default or first credential
      const defaultCred = credentials.find((cred: ArcherCredentials) => cred.isDefault) || credentials[0];
      res.json({
        success: true,
        credentials: defaultCred
      });
      return;
    }

    // If no credentials from frontend, return error
    res.status(404).json({
      success: false,
      error: 'No Archer credentials found for tenant',
      message: 'Please configure Archer connections in the frontend'
    });

  } catch (error) {
    console.error(`[Credentials API] Error getting credentials for tenant ${tenantId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test Archer connection for a tenant - makes direct API call to Archer
 */
credentialsRouter.post('/archer/:tenantId/test', async (req, res) => {
  const { tenantId } = req.params;
  const credentials = req.body as ArcherCredentials;
  const startTime = Date.now();

  try {
    console.log(`[Credentials API] Testing direct Archer connection for tenant ${tenantId}`);

    // Make direct API call to Archer login endpoint (server-side, no CORS issues)
    const loginUrl = `${credentials.baseUrl}/api/core/security/login`;
    const loginData = {
      InstanceName: credentials.instanceId,
      Username: credentials.username,
      UserDomain: credentials.userDomainId || '',
      Password: credentials.password
    };

    console.log(`[Credentials API] Attempting Archer login to: ${loginUrl}`);

    // Use node-fetch or axios for server-side HTTP requests
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(loginData)
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const result = await response.json();
      
      // Check if we got a valid session token
      if ((result as any).RequestedObject && (result as any).RequestedObject.SessionToken) {
        console.log(`[Credentials API] Archer authentication successful for tenant ${tenantId}`);
        res.json({
          success: true,
          message: 'Connection successful - Archer authenticated',
          responseTime,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log(`[Credentials API] Archer response missing session token:`, result);
        res.json({
          success: false,
          message: 'Authentication failed - invalid credentials',
          error: (result as any).ValidationMessages?.join(', ') || 'Invalid username/password or instance',
          responseTime,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log(`[Credentials API] Archer API call failed: ${response.status} ${response.statusText}`);
      res.json({
        success: false,
        message: 'Connection failed - server error',
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error(`[Credentials API] Error testing connection for tenant ${tenantId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      message: error instanceof Error ? error.message : 'Network or server error',
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Initialize MCP connection with specific credentials
 * Called by frontend when setting up MCP server with connection ID
 */
credentialsRouter.post('/archer/:tenantId/initialize', async (req, res) => {
  const { tenantId } = req.params;
  const { connectionId, credentials } = req.body as { connectionId: string; credentials: ArcherCredentials };

  try {
    console.log(`[Credentials API] Initializing MCP connection for tenant ${tenantId} with connection ${connectionId}`);
    
    // Import MCP client
    const { mcpClient } = await import('../services/mcpClient');
    
    // Initialize MCP client with the connection
    await mcpClient.initializeWithConnection(connectionId, credentials);
    
    res.json({
      success: true,
      message: 'MCP connection initialized successfully',
      connectionId,
      credentialsName: credentials.name,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Credentials API] Error initializing MCP connection for tenant ${tenantId}:`, error);
    res.status(500).json({
      success: false,
      error: 'MCP initialization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});