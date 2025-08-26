import { Router } from 'express';
import { mcpClient } from '../services/mcpClient';
import { multiMcpClient } from '../services/multiMcpClient';
import { agentConfigService } from '../services/agentConfigService';
import { credentialsManager } from '../services/credentialsService';

export const mcpRouter = Router();

/**
 * Get available MCP tools (legacy endpoint)
 */
mcpRouter.get('/tools', async (req, res) => {
  try {
    console.log('[MCP API] Getting available tools (legacy endpoint)...');
    const tools = await mcpClient.getMCPTools();
    
    return res.json({
      success: true,
      tools,
      mode: 'stdio'
    });
  } catch (error) {
    console.error('[MCP API] Error getting tools:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tools: []
    });
  }
});

/**
 * Get MCP tools for a specific agent (multi-server support)
 * Implements strict tenant isolation and agent ownership validation
 */
mcpRouter.get('/tools/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    // Input validation
    if (!agentId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required and cannot be empty'
      });
    }
    
    if (!tenantId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required and cannot be empty'
      });
    }
    
    // Sanitize input to prevent injection attacks
    const sanitizedAgentId = agentId.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
    
    if (sanitizedAgentId !== agentId || sanitizedTenantId !== tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters in Agent ID or Tenant ID'
      });
    }
    
    console.log(`[MCP API] Getting tools for agent ${agentId} in tenant ${tenantId}`);
    
    // Validate agent exists and belongs to tenant (tenant isolation)
    const agentConfig = await agentConfigService.getAgentConfiguration(tenantId, agentId);
    if (!agentConfig) {
      return res.status(404).json({
        success: false,
        error: `Agent ${agentId} not found or does not belong to tenant ${tenantId}`
      });
    }
    
    if (!agentConfig.isEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Agent is disabled'
      });
    }
    
    // Load tools from all enabled MCP servers for this agent
    const tools = await multiMcpClient.getAgentTools(tenantId, agentId);
    
    // Get server health information
    const serverHealth = await multiMcpClient.getTenantServerHealth(tenantId);
    const healthyServers = serverHealth.filter(h => h.status === 'healthy').length;
    
    console.log(`[MCP API] Loaded ${tools.length} tools from ${agentConfig.enabledMcpServers.length} enabled servers (${healthyServers} healthy)`);
    
    return res.json({
      success: true,
      tools,
      agentId,
      tenantId,
      serverCount: agentConfig.enabledMcpServers.length,
      healthyServerCount: healthyServers,
      enabledServers: agentConfig.enabledMcpServers,
      serverHealth: serverHealth.map(h => ({
        serverId: h.serverId,
        status: h.status,
        responseTime: h.responseTime
      }))
    });
    
  } catch (error) {
    console.error('[MCP API] Error getting agent tools:', error);
    
    // Don't expose internal error details to clients
    const isValidationError = error instanceof Error && 
      (error.message.includes('not found') || 
       error.message.includes('does not belong') ||
       error.message.includes('disabled'));
    
    return res.status(isValidationError ? 403 : 500).json({
      success: false,
      error: isValidationError ? error.message : 'Internal server error',
      tools: []
    });
  }
});

/**
 * Call an MCP tool with arguments (enhanced with multi-server support)
 * Implements comprehensive security validation and multi-server routing
 */
mcpRouter.post('/call', async (req, res) => {
  try {
    const { 
      toolName, 
      arguments: toolArgs, 
      connectionId, 
      tenantId, 
      credentials,
      agentId,
      enabledMcpServers 
    } = req.body;
    
    // Comprehensive input validation
    if (!toolName?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required and cannot be empty'
      });
    }

    if (!connectionId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Connection ID is required and cannot be empty'
      });
    }

    if (!tenantId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required and cannot be empty'
      });
    }
    
    if (!agentId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required for multi-server routing'
      });
    }
    
    // Sanitize inputs to prevent injection attacks
    const sanitizedToolName = toolName.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedAgentId = agentId.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedConnectionId = connectionId.replace(/[^a-zA-Z0-9-_]/g, '');
    
    if (sanitizedToolName !== toolName || sanitizedTenantId !== tenantId || 
        sanitizedAgentId !== agentId || sanitizedConnectionId !== connectionId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters in request parameters'
      });
    }
    
    // Validate arguments object
    if (toolArgs && typeof toolArgs !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Arguments must be an object'
      });
    }

    console.log(`[MCP API] Multi-server tool call: ${toolName} for tenant: ${tenantId}, agent: ${agentId}`);
    
    // Validate agent exists and belongs to tenant (strict tenant isolation)
    const agentConfig = await agentConfigService.getAgentConfiguration(tenantId, agentId);
    if (!agentConfig) {
      return res.status(403).json({
        success: false,
        error: `Agent ${agentId} not found or access denied for tenant ${tenantId}`
      });
    }
    
    if (!agentConfig.isEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Agent is disabled'
      });
    }
    
    // Execute tool call using multi-server client with comprehensive security
    const executionResult = await multiMcpClient.executeToolCall({
      toolName,
      arguments: toolArgs || {},
      tenantId,
      agentId,
      connectionId,
      credentials,
      enabledMcpServers: agentConfig.enabledMcpServers
    });

    if (!executionResult.success) {
      return res.status(500).json({
        success: false,
        error: executionResult.error,
        toolName,
        agentId,
        serverId: executionResult.serverId
      });
    }

    return res.json({
      success: true,
      result: executionResult.result,
      toolName,
      agentId,
      serverId: executionResult.serverId,
      processingTime: executionResult.processingTime,
      enabledServers: agentConfig.enabledMcpServers.length
    });

  } catch (error) {
    console.error('[MCP API] Error in multi-server tool call:', error);
    
    // Don't expose internal error details
    const isValidationError = error instanceof Error && 
      (error.message.includes('not found') || 
       error.message.includes('access denied') ||
       error.message.includes('disabled') ||
       error.message.includes('required'));
    
    return res.status(isValidationError ? 400 : 500).json({
      success: false,
      error: isValidationError ? error.message : 'Internal server error',
      toolName: req.body.toolName,
      agentId: req.body.agentId
    });
  }
});

/**
 * Initialize MCP connection with specific credentials
 */
mcpRouter.post('/initialize', async (req, res) => {
  try {
    const { connectionId, tenantId } = req.body;
    
    if (!connectionId || !tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Connection ID and Tenant ID are required'
      });
    }

    console.log(`[MCP API] Initializing connection: ${connectionId} for tenant: ${tenantId}`);
    
    // Get credentials for the connection
    const credentials = await credentialsManager.getCredentials(tenantId, connectionId);
    if (!credentials) {
      return res.status(404).json({
        success: false,
        error: `Credentials not found for connection: ${connectionId}`
      });
    }

    // Initialize MCP connection
    await mcpClient.initializeWithConnection(connectionId, credentials);

    return res.json({
      success: true,
      connectionId,
      connected: mcpClient.connected,
      message: 'MCP connection initialized successfully'
    });

  } catch (error) {
    console.error('[MCP API] Error initializing connection:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get MCP connection status with multi-server info
 * Provides comprehensive health information for tenant's enabled servers
 */
mcpRouter.get('/status', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required in x-tenant-id header'
      });
    }
    
    // Sanitize tenant ID
    const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedTenantId !== tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters in tenant ID'
      });
    }
    
    console.log(`[MCP API] Getting multi-server status for tenant: ${tenantId}`);
    
    // Get health status for all tenant servers
    const serverHealth = await multiMcpClient.getTenantServerHealth(tenantId);
    
    const healthyCount = serverHealth.filter(h => h.status === 'healthy').length;
    const totalCount = serverHealth.length;
    
    const status = {
      success: true,
      connected: healthyCount > 0,
      mode: 'multi-server-http',
      tenantId: tenantId,
      serverCount: totalCount,
      healthyServerCount: healthyCount,
      overallHealth: healthyCount === totalCount ? 'healthy' : 
                     healthyCount > 0 ? 'degraded' : 'unhealthy',
      servers: serverHealth.map(h => ({
        id: h.serverId,
        status: h.status,
        endpoint: h.endpoint,
        responseTime: h.responseTime,
        lastCheck: h.lastCheck,
        error: h.error
      })),
      lastUpdated: new Date().toISOString()
    };
    
    return res.json(status);
  } catch (error) {
    console.error('[MCP API] Error getting multi-server status:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      connected: false
    });
  }
});

/**
 * Get comprehensive MCP configuration for a tenant
 */
mcpRouter.get('/config/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }
    
    console.log(`[MCP API] Getting configuration for tenant: ${tenantId}`);
    
    // In production, this would query the database for tenant's MCP configuration
    const config = {
      tenantId,
      enabledServers: [
        {
          id: 'default-mcp-server',
          name: 'Default MCP Server',
          endpoint: 'http://localhost:3002',
          status: 'active',
          toolCount: 0,
          lastHealthCheck: new Date().toISOString()
        }
      ],
      totalTools: 0,
      lastUpdated: new Date().toISOString()
    };
    
    // Get tool count from default server
    try {
      const tools = await mcpClient.getMCPTools();
      config.totalTools = tools.length;
      config.enabledServers[0].toolCount = tools.length;
    } catch (error) {
      console.warn('[MCP API] Could not get tool count:', error);
    }
    
    return res.json({
      success: true,
      config
    });
    
  } catch (error) {
    console.error('[MCP API] Error getting tenant config:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check endpoint for MCP services
 * Provides comprehensive health status for the multi-server architecture
 */
mcpRouter.get('/health', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    // Get health for all servers if tenant ID provided, otherwise just service health
    let serverHealth = [];
    let multiMcpClientStatus = 'healthy';
    
    if (tenantId && tenantId.trim()) {
      try {
        const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
        if (sanitizedTenantId === tenantId) {
          serverHealth = await multiMcpClient.getTenantServerHealth(tenantId);
          const unhealthyCount = serverHealth.filter(h => h.status !== 'healthy').length;
          multiMcpClientStatus = unhealthyCount === 0 ? 'healthy' : 
                                 unhealthyCount < serverHealth.length ? 'degraded' : 'unhealthy';
        }
      } catch (error) {
        console.warn('[MCP API] Error checking server health in health endpoint:', error);
        multiMcpClientStatus = 'degraded';
      }
    }
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        legacyMcpClient: {
          connected: mcpClient.connected,
          status: mcpClient.connected ? 'healthy' : 'unhealthy'
        },
        multiMcpClient: {
          status: multiMcpClientStatus,
          serverCount: serverHealth.length,
          healthyServers: serverHealth.filter(h => h.status === 'healthy').length
        },
        agentConfigService: {
          status: 'healthy' // In production, check service health
        },
        credentialsManager: {
          status: 'healthy' // In production, check credentials manager health
        }
      },
      servers: serverHealth.length > 0 ? serverHealth.map(h => ({
        id: h.serverId,
        status: h.status,
        responseTime: h.responseTime,
        lastCheck: h.lastCheck
      })) : undefined
    };
    
    // Determine overall status
    const servicesHealthy = Object.values(healthStatus.services)
      .every(service => service.status === 'healthy');
    
    const overallStatus = servicesHealthy ? 200 : 503;
    
    return res.status(overallStatus).json({
      success: true,
      health: healthStatus
    });
    
  } catch (error) {
    console.error('[MCP API] Health check failed:', error);
    return res.status(503).json({
      success: false,
      error: 'Health check failed',
      health: {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default mcpRouter;