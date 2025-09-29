import { Router } from 'express';
import { mcpClient } from '../services/mcpClient';
import { multiMcpClient } from '../services/multiMcpClient';
import { agentConfigService } from '../services/agentConfigService';
import { credentialsManager } from '../services/credentialsService';
import { archerSessionService } from '../services/archerSessionService';

// Privacy protection function that checks tenant settings
async function protectSensitiveData(data: any, tenantId: string): Promise<any> {
  console.log(`[Privacy] Checking privacy settings for tenant: ${tenantId}`);
  console.log(`[Privacy DEBUG] Raw data received:`, JSON.stringify(data, null, 2));
  
  // Check if privacy protection is enabled for this tenant
  try {
    const privacyResponse = await fetch(`http://localhost:3005/api/v1/privacy/settings?scope=tenant&tenantId=${tenantId}`);
    const privacySettings = await privacyResponse.json();
    
    console.log(`[Privacy] Settings retrieved:`, {
      enabled: privacySettings.data?.enable_privacy_masking,
      level: privacySettings.data?.masking_level
    });
    
    // If privacy protection is disabled, return data unchanged
    if (!privacySettings.success || !privacySettings.data?.enable_privacy_masking) {
      console.log(`[Privacy] Privacy protection disabled, returning raw data`);
      return data;
    }
    
    const maskingLevel = privacySettings.data.masking_level || 'moderate';
    console.log(`[Privacy] Applying ${maskingLevel} level masking...`);
    
    const maskedData = applyPrivacyMasking(data, maskingLevel);
    console.log(`[Privacy DEBUG] Data after masking:`, JSON.stringify(maskedData, null, 2));
    console.log(`[Privacy] Masking applied successfully`);
    return maskedData;
  } catch (error) {
    console.error('[Privacy] Error checking privacy settings:', error);
    // On error, apply moderate masking as default for safety
    console.log(`[Privacy] Error occurred, applying moderate masking as fallback`);
    return applyPrivacyMasking(data, 'moderate');
  }
}

// Apply privacy masking based on level
function applyPrivacyMasking(data: any, maskingLevel: string): any {
  console.log(`[Privacy DEBUG] Processing item of type: ${typeof data}, masking level: ${maskingLevel}`);
  
  if (typeof data === 'string') {
    console.log(`[Privacy DEBUG] Processing string: "${data.substring(0, 100)}${data.length > 100 ? '...' : ''}"`);
    
    let processedData = data;
    
    // Always mask emails and phone numbers regardless of level
    processedData = processedData.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, (match) => {
      console.log(`[Privacy DEBUG] Masking email: "${match}"`);
      return '[MASKED_EMAIL]';
    });
    
    processedData = processedData.replace(/(\+?\d{1,3}[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}/g, (match) => {
      console.log(`[Privacy DEBUG] Masking phone: "${match}"`);
      return '[MASKED_PHONE]';
    });
    
    // Mask names based on patterns - search within text blocks
    if (maskingLevel === 'moderate' || maskingLevel === 'strict') {
      console.log(`[Privacy DEBUG] Searching for names in text block`);
      
      // Look for "Action_Assignee: LastName, FirstName" patterns in the text
      processedData = processedData.replace(/Action_Assignee:\s*([A-Z][a-z]{1,15},\s*[A-Z][a-z]{1,15})/g, (match, name) => {
        console.log(`[Privacy DEBUG] FOUND Action_Assignee name: "${name}" -> [MASKED_NAME]`);
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
        'Risk', 'Register', 'Control', 'Policy', 'Policies', 'Issue', 'Issues',
        'Task', 'Tasks', 'Incident', 'Incidents', 'Application', 'Applications',
        
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
            console.log(`[Privacy DEBUG] SKIPPING non-name phrase: "${match}"`);
            return match;
          }
          
          // Additional checks for business terms
          if (match.toLowerCase().includes('service') || match.toLowerCase().includes('credit') ||
              match.toLowerCase().includes('report') || match.toLowerCase().includes('letter') ||
              match.toLowerCase().includes('system') || match.toLowerCase().includes('account')) {
            console.log(`[Privacy DEBUG] SKIPPING business term: "${match}"`);
            return match;
          }
          
          console.log(`[Privacy DEBUG] MATCHED ${pattern.name} in text: "${match}" -> [MASKED_NAME]`);
          return '[MASKED_NAME]';
        });
      }
    }
    
    if (processedData !== data) {
      console.log(`[Privacy DEBUG] Text was modified by masking`);
    } else {
      console.log(`[Privacy DEBUG] No sensitive patterns found in text`);
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

/**
 * Validate source fields to prevent LLM hallucination of non-existent columns
 * Ensures only actual fields from Archer source data are included in responses
 */
function validateSourceFields(data: any, toolName: string): any {
  console.log(`[Field Validation] Validating fields for tool: ${toolName}`);
  
  // Define known field schemas for different Archer applications/tools
  const KNOWN_FIELD_SCHEMAS: Record<string, string[]> = {
    'search_archer_records': [
      'Record ID', 'Action ID', 'Related Ticket Summary', 'Action Assignee', 
      'Action Response', 'Title', 'Description', 'Status', 'Priority',
      'Created Date', 'Modified Date', 'Owner', 'Category', 'Type',
      'Business Unit', 'Region', 'Severity', 'Impact', 'Likelihood'
    ],
    'get_actions': [
      'Record ID', 'Action ID', 'Related Ticket Summary', 'Action Assignee',
      'Action Response', 'Title', 'Description', 'Status', 'Priority',
      'Created Date', 'Modified Date', 'Owner', 'Assigned To'
    ],
    'get_risks': [
      'Record ID', 'Risk', 'Category', 'Business Unit', 'Owner', 
      'Risk Rating', 'Likelihood', 'Impact', 'Status', 'Created Date'
    ],
    'get_controls': [
      'Record ID', 'Control', 'Category', 'Owner', 'Status', 'Effectiveness',
      'Control Type', 'Frequency', 'Created Date', 'Modified Date'
    ],
    // Add more tool schemas as needed
    'default': [
      'Record ID', 'Title', 'Description', 'Status', 'Owner', 
      'Created Date', 'Modified Date', 'Category', 'Priority'
    ]
  };
  
  // Get the allowed fields for this tool
  const allowedFields = KNOWN_FIELD_SCHEMAS[toolName] || KNOWN_FIELD_SCHEMAS['default'];
  console.log(`[Field Validation] Allowed fields for ${toolName}:`, allowedFields);
  
  return filterValidFields(data, allowedFields, toolName);
}

/**
 * Recursively filter data to only include valid fields
 */
function filterValidFields(data: any, allowedFields: string[], toolName: string): any {
  if (typeof data === 'string') {
    // For text responses, add a metadata note about validated fields
    return data + `\n\n[System Note: Response validated to include only actual source fields for ${toolName}]`;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => filterValidFields(item, allowedFields, toolName));
  }
  
  if (typeof data === 'object' && data !== null) {
    const filtered: any = {};
    
    // Handle nested objects and arrays
    for (const [key, value] of Object.entries(data)) {
      // Special handling for known response structures
      if (key === 'content' && Array.isArray(value)) {
        // Filter content array items (like MCP text responses)
        filtered[key] = value.map(item => {
          if (item?.type === 'text' && item?.text) {
            return {
              ...item,
              text: filterValidFields(item.text, allowedFields, toolName)
            };
          }
          return item;
        });
      } else if (key === 'Records' && Array.isArray(value)) {
        // Filter Archer records to only include valid fields
        filtered[key] = value.map(record => {
          const validRecord: any = {};
          for (const [recordKey, recordValue] of Object.entries(record)) {
            // Only include fields that are in the allowed list
            if (allowedFields.some(field => 
              field.toLowerCase() === recordKey.toLowerCase() ||
              recordKey.toLowerCase().includes(field.toLowerCase()) ||
              field.toLowerCase().includes(recordKey.toLowerCase())
            )) {
              validRecord[recordKey] = recordValue;
              console.log(`[Field Validation] ✓ Keeping valid field: ${recordKey}`);
            } else {
              console.log(`[Field Validation] ✗ Filtering out invalid field: ${recordKey}`);
            }
          }
          return validRecord;
        });
      } else {
        // Recursively filter nested objects
        filtered[key] = filterValidFields(value, allowedFields, toolName);
      }
    }
    
    return filtered;
  }
  
  return data;
}

export const mcpRouter = Router();

/**
 * Get available MCP tools (dynamic client selection based on server type)
 */
mcpRouter.get('/tools', async (req, res) => {
  try {
    console.log('[MCP API] Getting available tools with dynamic client selection...');
    
    // Check server type from database to determine which client to use
    const { DatabaseService } = await import('../services/databaseService');
    const db = DatabaseService.getInstance();
    
    const serverConfigs = await db.query(`
      SELECT msr.server_type, msr.name, tms.is_enabled
      FROM tenant_mcp_servers tms
      JOIN mcp_server_registry msr ON tms.server_id = msr.server_id
      WHERE tms.is_enabled = 1
      LIMIT 1
    `);
    
    if (serverConfigs.length === 0) {
      console.log('[MCP API] No enabled MCP servers found');
      return res.json({
        success: true,
        tools: [],
        mode: 'no_servers_enabled'
      });
    }
    
    const serverType = serverConfigs[0].server_type;
    console.log(`[MCP API] Using server type: ${serverType}`);
    
    // Always use HTTP client via the HTTP wrapper (port 3006)
    // The HTTP wrapper handles stdio communication internally
    const tools = await mcpClient.getMCPTools();
    return res.json({
      success: true,
      tools,
      mode: 'http_wrapper',
      server_type: serverType
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
 * Get tools from stdio MCP server
 */
async function getToolsFromStdioServer(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const path = require('path');
    
    console.log('[MCP API] Spawning stdio MCP server for tools...');
    
    // Start the MCP server in stdio mode (clear PORT env var to force stdio)
    const mcpServer = spawn(process.execPath, ['dist/index.js'], {
      cwd: path.join(__dirname, '../../mcp-server'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key !== 'PORT')
      )
    });
    
    let response = '';
    let errorOutput = '';
    
    mcpServer.stdout.on('data', (data: Buffer) => {
      response += data.toString();
    });
    
    mcpServer.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });
    
    mcpServer.on('close', (code: number) => {
      if (code === 0 && response.trim()) {
        try {
          // Parse MCP response - look for tools list response
          const lines = response.trim().split('\n');
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.result && parsed.result.tools) {
                console.log(`[MCP API] Got ${parsed.result.tools.length} tools from stdio server`);
                resolve(parsed.result.tools);
                return;
              }
            } catch (parseError) {
              // Skip non-JSON lines
              continue;
            }
          }
          resolve([]); // No tools found but successful execution
        } catch (error) {
          reject(new Error(`Failed to parse stdio MCP response: ${error}`));
        }
      } else {
        reject(new Error(`Stdio MCP server failed with code ${code}: ${errorOutput}`));
      }
    });
    
    // Send tools/list request to stdio server
    const toolsRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
      params: {}
    };
    
    mcpServer.stdin.write(JSON.stringify(toolsRequest) + '\n');
    mcpServer.stdin.end();
  });
}

/**
 * Execute tool call using stdio communication with MCP server
 */
async function executeToolCallStdio(request: {
  toolName: string;
  arguments: any;
  tenantId: string;
  agentId?: string;
  connectionId: string;
  credentials?: any;
  sessionToken?: string;
  userInfo?: any;
}): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const { spawn } = require('child_process');
    const path = require('path');
    
    console.log(`[MCP API] Executing tool ${request.toolName} via stdio`);
    
    // Get credentials if not provided
    let authData = request.credentials;
    if (!authData) {
      if (request.sessionToken && request.userInfo) {
        // Use session authentication
        authData = {
          sessionToken: request.sessionToken,
          baseUrl: request.userInfo.baseUrl,
          username: request.userInfo.username,
          instanceId: request.userInfo.instanceId
        };
      } else {
        // Load credentials from database
        try {
          const { DatabaseService } = await import('../services/databaseService');
          const db = DatabaseService.getInstance();
          
          const credentialResult = await db.query(`
            SELECT 
              credential_id as id,
              name,
              base_url as baseUrl,
              username,
              encrypted_password,
              instance_id as instanceId,
              instance_name as instanceName,
              user_domain_id as userDomainId
            FROM connection_credentials 
            WHERE credential_id = ? AND tenant_id = ? AND deleted_at IS NULL
            LIMIT 1
          `, [request.connectionId, request.tenantId]);
          
          if (credentialResult.length > 0) {
            const credential = credentialResult[0];
            authData = {
              id: credential.id,
              name: credential.name,
              baseUrl: credential.baseUrl,
              username: credential.username,
              password: credential.encrypted_password?.replace('encrypted_', '') || '',
              instanceId: credential.instanceId,
              instanceName: credential.instanceName,
              userDomainId: credential.userDomainId || '1'
            };
          }
        } catch (error) {
          console.error('[MCP API] Error loading credentials for stdio call:', error);
        }
      }
    }
    
    // Start the MCP server in stdio mode (clear PORT env var to force stdio)
    const mcpServer = spawn(process.execPath, ['dist/index.js'], {
      cwd: path.join(__dirname, '../../mcp-server'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key !== 'PORT')
      )
    });
    
    let response = '';
    let errorOutput = '';
    
    mcpServer.stdout.on('data', (data: Buffer) => {
      response += data.toString();
    });
    
    mcpServer.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });
    
    mcpServer.on('close', (code: number) => {
      if (code === 0 && response.trim()) {
        try {
          // Parse MCP response - look for tool call result
          const lines = response.trim().split('\n');
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.result) {
                console.log(`[MCP API] Tool ${request.toolName} executed successfully via stdio`);
                resolve({
                  success: true,
                  result: parsed.result,
                  toolName: request.toolName,
                  serverId: 'stdio-server',
                  agentId: request.agentId,
                  processingTime: 0
                });
                return;
              }
            } catch (parseError) {
              // Skip non-JSON lines
              continue;
            }
          }
          // No result found - treat as error
          reject(new Error('No valid result found in MCP stdio response'));
        } catch (error) {
          reject(new Error(`Failed to parse stdio MCP response: ${error}`));
        }
      } else {
        reject(new Error(`Stdio MCP server failed with code ${code}: ${errorOutput}`));
      }
    });
    
    // Prepare tool call arguments
    const toolArgs = {
      ...request.arguments,
      tenant_id: request.tenantId,
      connection_id: request.connectionId,
      agent_id: request.agentId
    };
    
    // Add authentication data
    if (authData) {
      toolArgs.archer_connection = authData;
    }
    
    // Send tool call request to stdio server
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: request.toolName,
        arguments: toolArgs
      }
    };
    
    console.log(`[MCP API] Sending stdio request:`, {
      toolName: request.toolName,
      tenantId: request.tenantId,
      hasAuth: !!authData
    });
    
    mcpServer.stdin.write(JSON.stringify(toolCallRequest) + '\n');
    mcpServer.stdin.end();
  });
}

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
      enabledMcpServers,
      archerSessionId 
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
    
    // Secure session lookup using session ID
    let sessionToken: string | undefined;
    let userInfo: any | undefined;
    let archerConnectionConfig: any = null;
    
    if (archerSessionId) {
      console.log(`[MCP API] Looking up Archer session: ${archerSessionId}`);
      
      const session = await archerSessionService.getValidSession(archerSessionId);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired Archer session. Please re-authenticate.'
        });
      }
      
      // Extract session details for MCP server
      sessionToken = session.session_token;
      userInfo = {
        username: session.username,
        instanceId: session.instance_id,
        baseUrl: session.base_url
      };
      
      // Build archer connection config for MCP server
      archerConnectionConfig = await archerSessionService.getArcherConnectionConfig(archerSessionId);
      
      console.log(`[MCP API] Session validated for user: ${userInfo.username}@${userInfo.instanceId}`);
    }
    
    // Add archer connection to tool arguments if session is available
    let finalToolArgs = toolArgs || {};
    if (archerConnectionConfig) {
      finalToolArgs = {
        ...finalToolArgs,
        archer_connection: archerConnectionConfig
      };
      console.log(`[MCP API] Added Archer connection config to tool arguments`);
    }
    
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
    
    // Always use HTTP wrapper instead of direct stdio communication
    // The HTTP wrapper on port 3006 handles stdio communication internally
    console.log('[MCP API] Using HTTP wrapper for tool call');
    
    // Use the single MCP client that connects to HTTP wrapper
    const { mcpClient } = await import('../services/mcpClient');
    
    // Execute tool via HTTP wrapper
    const executionResult = await mcpClient.sendMCPRequest('tools/call', {
      name: toolName,
      arguments: finalToolArgs
    });
    
    // The HTTP wrapper returns the response directly, not wrapped in a result property
    // Check if the response indicates success or failure
    if (executionResult.success === false) {
      return res.status(400).json({
        success: false,
        error: executionResult.error || executionResult.message || 'Tool execution failed',
        details: executionResult.details,
        toolName,
        agentId,
        serverId: 'http-wrapper'
      });
    }

    // Apply privacy protection based on tenant settings
    const protectedResult = await protectSensitiveData(executionResult, tenantId);

    // Apply field validation to prevent LLM hallucination of non-existent fields
    // TODO: Re-enable field validation once implementation is stable
    const validatedResult = protectedResult; // validateSourceFields(protectedResult, toolName);

    return res.json({
      success: true,
      result: validatedResult,
      toolName,
      agentId,
      serverId: 'http-wrapper',
      processingTime: 0,
      enabledServers: 1
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
          endpoint: 'http://localhost:3006',
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