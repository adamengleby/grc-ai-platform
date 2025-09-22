/**
 * Secure MCP Router Implementation
 * Implements proper tenant isolation with JWT-based context extraction
 * 
 * Security Principles:
 * 1. Tenant context ONLY from authenticated JWT tokens
 * 2. No tenant IDs accepted from client requests
 * 3. Comprehensive audit logging for all operations
 * 4. Fail-closed security model
 * 
 * OWASP: A01:2021 Broken Access Control Prevention
 */

import { Router } from 'express';
import { multiMcpClient } from '../services/multiMcpClient';
import { agentConfigService } from '../services/agentConfigService';
import { credentialsManager } from '../services/credentialsService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authz';
import { 
  extractTenantContext, 
  validateTenantScope, 
  TenantContextRequest 
} from '../middleware/tenantContext';
import { auditLogger } from '../services/auditService';
import crypto from 'crypto';

// Privacy protection function that checks tenant settings
async function protectSensitiveData(data: any, tenantId: string): Promise<any> {
  console.log(`[Privacy Secure] Checking privacy settings for tenant: ${tenantId}`);
  console.log(`[Privacy DEBUG Secure] Raw data received:`, JSON.stringify(data, null, 2));
  
  // Check if privacy protection is enabled for this tenant
  try {
    const privacyResponse = await fetch(`http://localhost:3005/api/v1/privacy/settings?scope=tenant&tenantId=${tenantId}`);
    const privacySettings = await privacyResponse.json();
    
    console.log(`[Privacy Secure] Settings retrieved:`, {
      enabled: privacySettings.data?.enable_privacy_masking,
      level: privacySettings.data?.masking_level
    });
    
    // If privacy protection is disabled, return data unchanged
    if (!privacySettings.success || !privacySettings.data?.enable_privacy_masking) {
      console.log(`[Privacy Secure] Privacy protection disabled, returning raw data`);
      return data;
    }
    
    const maskingLevel = privacySettings.data.masking_level || 'moderate';
    console.log(`[Privacy Secure] Applying ${maskingLevel} level masking...`);
    
    const maskedData = applyPrivacyMasking(data, maskingLevel);
    console.log(`[Privacy DEBUG Secure] Data after masking:`, JSON.stringify(maskedData, null, 2));
    console.log(`[Privacy Secure] Masking applied successfully`);
    return maskedData;
  } catch (error) {
    console.error('[Privacy Secure] Error checking privacy settings:', error);
    // On error, apply moderate masking as default for safety
    console.log(`[Privacy Secure] Error occurred, applying moderate masking as fallback`);
    return applyPrivacyMasking(data, 'moderate');
  }
}

// Apply privacy masking based on level
function applyPrivacyMasking(data: any, maskingLevel: string): any {
  console.log(`[Privacy DEBUG Secure] Processing item of type: ${typeof data}, masking level: ${maskingLevel}`);
  
  if (typeof data === 'string') {
    console.log(`[Privacy DEBUG Secure] Processing string: "${data.substring(0, 100)}${data.length > 100 ? '...' : ''}"`);
    
    let processedData = data;
    
    // Always mask emails and phone numbers regardless of level
    processedData = processedData.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, (match) => {
      console.log(`[Privacy DEBUG Secure] Masking email: "${match}"`);
      return '[MASKED_EMAIL]';
    });
    
    processedData = processedData.replace(/(\+?\d{1,3}[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}/g, (match) => {
      console.log(`[Privacy DEBUG Secure] Masking phone: "${match}"`);
      return '[MASKED_PHONE]';
    });
    
    // Mask names based on patterns - search within text blocks
    if (maskingLevel === 'moderate' || maskingLevel === 'strict') {
      console.log(`[Privacy DEBUG Secure] Searching for names in text block`);
      
      // Look for "Action_Assignee: LastName, FirstName" patterns in the text
      processedData = processedData.replace(/Action_Assignee:\s*([A-Z][a-z]{1,15},\s*[A-Z][a-z]{1,15})/g, (match, name) => {
        console.log(`[Privacy DEBUG Secure] FOUND Action_Assignee name: "${name}" -> [MASKED_NAME]`);
        return match.replace(name, '[MASKED_NAME]');
      });
      
      // Also look for standalone name patterns that might appear elsewhere
      const namePatterns = [
        { name: 'LastName_FirstName', regex: /\b[A-Z][a-z]{1,15},\s*[A-Z][a-z]{1,15}\b/g }, // "Aliferis, Suzy"
        { name: 'FirstName_LastName', regex: /\b[A-Z][a-z]{1,15}\s+[A-Z][a-z]{1,15}\b/g }, // "John Smith"
      ];
      
      // Common words that are NOT names but might match patterns
      const nonNameWords = [
        // Time/date words
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December',
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
        
        // Business terms
        'Service', 'Credits', 'Report', 'Letter', 'Weekly', 'Monthly', 'Annual',
        'Investment', 'Member', 'Staff', 'Employee', 'Contact', 'Details',
        'Executive', 'Business', 'Unit', 'Department', 'Division', 'Account',
        'Premium', 'Processing', 'Management', 'Feedback', 'System', 'Access',
        
        // Common adjectives/descriptors
        'Active', 'Inactive', 'High', 'Medium', 'Low', 'New', 'Old', 'Recent',
        'Current', 'Previous', 'Next', 'Final', 'Initial', 'Primary', 'Secondary',
        
        // Technical terms
        'Record', 'Field', 'Type', 'Data', 'Action', 'Summary', 'Response', 'Request'
      ];
      
      for (const pattern of namePatterns) {
        processedData = processedData.replace(pattern.regex, (match) => {
          // Check if either word in the match is a common non-name word
          const words = match.split(/[\s,]+/).filter(w => w.length > 0);
          const isNonName = words.some(word => 
            nonNameWords.some(nonName => word.toLowerCase() === nonName.toLowerCase())
          );
          
          if (isNonName) {
            console.log(`[Privacy DEBUG Secure] SKIPPING non-name phrase: "${match}"`);
            return match;
          }
          
          // Additional checks for business terms
          if (match.toLowerCase().includes('service') || match.toLowerCase().includes('credit') ||
              match.toLowerCase().includes('report') || match.toLowerCase().includes('letter') ||
              match.toLowerCase().includes('system') || match.toLowerCase().includes('account')) {
            console.log(`[Privacy DEBUG Secure] SKIPPING business term: "${match}"`);
            return match;
          }
          
          console.log(`[Privacy DEBUG Secure] MATCHED ${pattern.name} in text: "${match}" -> [MASKED_NAME]`);
          return '[MASKED_NAME]';
        });
      }
    }
    
    if (processedData !== data) {
      console.log(`[Privacy DEBUG Secure] Text was modified by masking`);
    } else {
      console.log(`[Privacy DEBUG Secure] No sensitive patterns found in text`);
    }
    
    return processedData;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => applyPrivacyMasking(item, maskingLevel));
  }
  
  if (typeof data === 'object' && data !== null) {
    const protected_data: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Always recursively process ALL values, including strings
      protected_data[key] = applyPrivacyMasking(value, maskingLevel);
    }
    return protected_data;
  }
  
  return data;
}

export const secureMcpRouter = Router();

// Apply authentication and tenant context extraction to all routes
secureMcpRouter.use(authenticateToken);
secureMcpRouter.use(extractTenantContext);

/**
 * Get MCP tools for a specific agent with strict tenant isolation
 */
secureMcpRouter.get('/tools/agent/:agentId', validateTenantScope, async (req, res) => {
  const contextReq = req as TenantContextRequest;
  const { agentId } = req.params;
  
  // Use tenant context from JWT token, NOT from headers or params
  const tenantId = contextReq.tenantContext.tenantId;
  const userId = contextReq.tenantContext.userId;
  const requestId = contextReq.tenantContext.requestId;
  
  try {
    // Input validation
    if (!agentId?.trim()) {
      await auditLogger.logEvent({
        eventType: 'invalid_request',
        eventCategory: 'mcp',
        severity: 'warning',
        tenantId,
        userId,
        details: { error: 'Missing agent ID', requestId }
      });
      
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required',
        requestId
      });
    }
    
    // Sanitize agent ID to prevent injection
    const sanitizedAgentId = agentId.replace(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedAgentId !== agentId) {
      await auditLogger.logSecurityEvent({
        eventType: 'injection_attempt',
        severity: 'high',
        tenantId,
        userId,
        details: { 
          original: agentId, 
          sanitized: sanitizedAgentId,
          requestId 
        }
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID format',
        requestId
      });
    }
    
    console.log(`[Secure MCP] Loading tools for agent ${agentId}, tenant ${tenantId} from JWT`);
    
    // Verify agent belongs to authenticated tenant
    const agentConfig = await agentConfigService.getAgentConfiguration(tenantId, agentId);
    if (!agentConfig) {
      await auditLogger.logSecurityEvent({
        eventType: 'unauthorized_agent_access',
        severity: 'high',
        tenantId,
        userId,
        details: { agentId, requestId }
      });
      
      return res.status(404).json({
        success: false,
        error: 'Agent not found or access denied',
        requestId
      });
    }
    
    if (!agentConfig.isEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Agent is disabled',
        requestId
      });
    }
    
    // Load tools with tenant isolation enforced
    const tools = await multiMcpClient.getAgentTools(tenantId, agentId);
    
    // Get server health
    const serverHealth = await multiMcpClient.getTenantServerHealth(tenantId);
    
    // Audit successful tool retrieval
    await auditLogger.logEvent({
      eventType: 'mcp_tools_retrieved',
      eventCategory: 'mcp',
      severity: 'info',
      tenantId,
      userId,
      details: {
        agentId,
        toolCount: tools.length,
        serverCount: agentConfig.enabledMcpServers.length,
        requestId
      }
    });
    
    return res.json({
      success: true,
      tools,
      agentId,
      requestId,
      serverCount: agentConfig.enabledMcpServers.length,
      serverHealth: serverHealth.map(h => ({
        serverId: h.serverId,
        status: h.status,
        responseTime: h.responseTime
      }))
    });
    
  } catch (error) {
    console.error('[Secure MCP] Error getting agent tools:', error);
    
    await auditLogger.logEvent({
      eventType: 'mcp_tools_error',
      eventCategory: 'mcp',
      severity: 'error',
      tenantId,
      userId,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        agentId,
        requestId
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      requestId,
      tools: []
    });
  }
});

/**
 * Execute MCP tool with secure tenant context
 * Tenant ID comes ONLY from JWT token, never from request body
 */
secureMcpRouter.post('/call', validateTenantScope, async (req, res) => {
  const contextReq = req as TenantContextRequest;
  const requestId = crypto.randomUUID();
  
  // SECURITY: Extract tenant context from authenticated JWT session
  const tenantId = contextReq.tenantContext.tenantId;
  const userId = contextReq.tenantContext.userId;
  
  try {
    const { 
      toolName, 
      arguments: toolArgs, 
      connectionId,
      agentId,
      credentials
    } = req.body;
    
    // SECURITY: Log if client attempted to provide tenant ID
    if (req.body.tenantId || req.body.tenant_id) {
      await auditLogger.logSecurityEvent({
        eventType: 'tenant_spoofing_blocked',
        severity: 'critical',
        tenantId,
        userId,
        details: {
          providedTenantId: req.body.tenantId || req.body.tenant_id,
          authenticatedTenantId: tenantId,
          toolName,
          requestId
        },
        clientIp: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Still proceed with authenticated tenant ID, but log the attempt
    }
    
    // Input validation
    if (!toolName?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required',
        requestId
      });
    }
    
    if (!connectionId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Connection ID is required',
        requestId
      });
    }
    
    if (!agentId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required',
        requestId
      });
    }
    
    // Sanitize inputs
    const sanitizedToolName = toolName.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedAgentId = agentId.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedConnectionId = connectionId.replace(/[^a-zA-Z0-9-_]/g, '');
    
    if (sanitizedToolName !== toolName || 
        sanitizedAgentId !== agentId || 
        sanitizedConnectionId !== connectionId) {
      await auditLogger.logSecurityEvent({
        eventType: 'injection_attempt',
        severity: 'high',
        tenantId,
        userId,
        details: { 
          original: { toolName, agentId, connectionId },
          requestId 
        }
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid characters in request',
        requestId
      });
    }
    
    console.log(`[Secure MCP] Tool call: ${toolName} for tenant ${tenantId} (from JWT)`);
    
    // Verify agent belongs to authenticated tenant
    const agentConfig = await agentConfigService.getAgentConfiguration(tenantId, agentId);
    if (!agentConfig) {
      await auditLogger.logSecurityEvent({
        eventType: 'unauthorized_tool_call',
        severity: 'critical',
        tenantId,
        userId,
        details: { 
          agentId, 
          toolName,
          requestId 
        }
      });
      
      return res.status(403).json({
        success: false,
        error: 'Agent not found or access denied',
        requestId
      });
    }
    
    if (!agentConfig.isEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Agent is disabled',
        requestId
      });
    }
    
    // Log tool execution attempt
    await auditLogger.logEvent({
      eventType: 'mcp_tool_execution_start',
      eventCategory: 'mcp',
      severity: 'info',
      tenantId,
      userId,
      details: {
        toolName,
        agentId,
        connectionId,
        requestId,
        hasCredentials: !!credentials
      }
    });
    
    // Execute tool with secure tenant context from JWT
    const executionResult = await multiMcpClient.executeToolCall({
      toolName,
      arguments: toolArgs || {},
      tenantId,  // From JWT session, NOT from request
      agentId,
      connectionId,
      credentials,
      enabledMcpServers: agentConfig.enabledMcpServers
    });
    
    // Log execution result
    await auditLogger.logEvent({
      eventType: 'mcp_tool_execution_complete',
      eventCategory: 'mcp',
      severity: executionResult.success ? 'info' : 'error',
      tenantId,
      userId,
      details: {
        toolName,
        agentId,
        success: executionResult.success,
        serverId: executionResult.serverId,
        processingTime: executionResult.processingTime,
        requestId
      }
    });
    
    if (!executionResult.success) {
      return res.status(500).json({
        success: false,
        error: executionResult.error,
        toolName,
        agentId,
        requestId
      });
    }
    
    // Apply privacy protection based on tenant settings
    const protectedResult = await protectSensitiveData(executionResult.result, tenantId);
    
    return res.json({
      success: true,
      result: protectedResult,
      toolName,
      agentId,
      serverId: executionResult.serverId,
      processingTime: executionResult.processingTime,
      requestId
    });
    
  } catch (error) {
    console.error('[Secure MCP] Tool execution error:', error);
    
    await auditLogger.logEvent({
      eventType: 'mcp_tool_execution_error',
      eventCategory: 'mcp',
      severity: 'error',
      tenantId,
      userId,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      requestId
    });
  }
});

/**
 * Get MCP service health with tenant isolation
 */
secureMcpRouter.get('/health', async (req, res) => {
  const contextReq = req as TenantContextRequest;
  const tenantId = contextReq.tenantContext.tenantId;
  const requestId = contextReq.tenantContext.requestId;
  
  try {
    // Get health for tenant's enabled servers only
    const serverHealth = await multiMcpClient.getTenantServerHealth(tenantId);
    
    const healthyCount = serverHealth.filter(h => h.status === 'healthy').length;
    const totalCount = serverHealth.length;
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      requestId,
      tenant: {
        tenantId,  // From JWT, not from request
        serverCount: totalCount,
        healthyServers: healthyCount,
        overallHealth: healthyCount === totalCount ? 'healthy' : 
                       healthyCount > 0 ? 'degraded' : 'unhealthy'
      },
      servers: serverHealth.map(h => ({
        id: h.serverId,
        status: h.status,
        responseTime: h.responseTime,
        lastCheck: h.lastCheck
      }))
    };
    
    return res.json({
      success: true,
      health: healthStatus
    });
    
  } catch (error) {
    console.error('[Secure MCP] Health check error:', error);
    
    return res.status(503).json({
      success: false,
      error: 'Health check failed',
      requestId
    });
  }
});

/**
 * Initialize connection with tenant isolation
 */
secureMcpRouter.post('/initialize', async (req, res) => {
  const contextReq = req as TenantContextRequest;
  const tenantId = contextReq.tenantContext.tenantId;
  const userId = contextReq.tenantContext.userId;
  const requestId = crypto.randomUUID();
  
  try {
    const { connectionId } = req.body;
    
    if (!connectionId?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Connection ID is required',
        requestId
      });
    }
    
    // Validate connection belongs to tenant
    const credentials = await credentialsManager.getCredentials(tenantId, connectionId);
    if (!credentials) {
      await auditLogger.logSecurityEvent({
        eventType: 'unauthorized_connection_init',
        severity: 'high',
        tenantId,
        userId,
        details: { connectionId, requestId }
      });
      
      return res.status(404).json({
        success: false,
        error: 'Connection not found or access denied',
        requestId
      });
    }
    
    // Clear and refresh credentials
    await credentialsManager.clearCredentials(tenantId, connectionId);
    
    // Log initialization
    await auditLogger.logEvent({
      eventType: 'mcp_connection_initialized',
      eventCategory: 'mcp',
      severity: 'info',
      tenantId,
      userId,
      details: { connectionId, requestId }
    });
    
    return res.json({
      success: true,
      connectionId,
      message: 'Connection initialized successfully',
      requestId
    });
    
  } catch (error) {
    console.error('[Secure MCP] Initialization error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      requestId
    });
  }
});

export default secureMcpRouter;