/**
 * Secure Tenant Context Middleware
 * Extracts and validates tenant context from authenticated JWT tokens
 * Implements zero-trust principles for multi-tenant isolation
 * 
 * Security Design:
 * - Tenant ID NEVER comes from request body
 * - Always extracted from authenticated JWT token
 * - Validates tenant access rights
 * - Comprehensive audit logging
 * 
 * OWASP References:
 * - A01:2021 Broken Access Control
 * - A08:2021 Software and Data Integrity Failures
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authz';
import { auditLogger } from '../services/auditService';
import crypto from 'crypto';

/**
 * Enhanced request with secure tenant context
 */
export interface TenantContextRequest extends AuthenticatedRequest {
  tenantContext: {
    tenantId: string;
    userId: string;
    sessionId: string;
    requestId: string;
    extractedAt: string;
    source: 'jwt_token';
    validated: boolean;
  };
}

/**
 * Extract tenant context from authenticated JWT session
 * This is the ONLY source of truth for tenant context
 */
export const extractTenantContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Ensure user is authenticated
    if (!authReq.user || !authReq.user.tenantId) {
      res.status(401).json({
        error: {
          code: 'MISSING_TENANT_CONTEXT',
          message: 'Authenticated session required for tenant context',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    // Generate unique request ID for audit trail
    const requestId = crypto.randomUUID();
    
    // Extract tenant context from JWT token (the ONLY trusted source)
    const tenantContext = {
      tenantId: authReq.user.tenantId,
      userId: authReq.user.userId,
      sessionId: authReq.tokenData?.sessionId || crypto.randomUUID(),
      requestId,
      extractedAt: new Date().toISOString(),
      source: 'jwt_token' as const,
      validated: true
    };
    
    // Attach secure tenant context to request
    (req as TenantContextRequest).tenantContext = tenantContext;
    
    // Security: Detect and log any tenant spoofing attempts
    await detectTenantSpoofing(req, tenantContext);
    
    // Log context extraction for audit trail
    await auditLogger.logEvent({
      eventType: 'tenant_context_extracted',
      eventCategory: 'security',
      severity: 'info',
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      details: {
        requestId,
        endpoint: req.path,
        method: req.method,
        source: 'jwt_token'
      }
    });
    
    next();
  } catch (error) {
    console.error('Tenant context extraction failed:', error);
    
    await auditLogger.logSecurityEvent({
      eventType: 'tenant_context_extraction_failure',
      severity: 'high',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: req.path
      },
      clientIp: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(500).json({
      error: {
        code: 'TENANT_CONTEXT_ERROR',
        message: 'Failed to establish secure tenant context',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Validate that all operations are scoped to authenticated tenant
 * Prevents cross-tenant data access
 */
export const validateTenantScope = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const contextReq = req as TenantContextRequest;
  
  if (!contextReq.tenantContext?.validated) {
    res.status(403).json({
      error: {
        code: 'INVALID_TENANT_CONTEXT',
        message: 'Valid tenant context required',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  // Extract any resource IDs that should be tenant-scoped
  const resourceIds = extractResourceIds(req);
  
  // Validate all resources belong to authenticated tenant
  for (const resource of resourceIds) {
    const isValid = await validateResourceTenantOwnership(
      resource.type,
      resource.id,
      contextReq.tenantContext.tenantId
    );
    
    if (!isValid) {
      await auditLogger.logSecurityEvent({
        eventType: 'cross_tenant_access_blocked',
        severity: 'critical',
        tenantId: contextReq.tenantContext.tenantId,
        userId: contextReq.tenantContext.userId,
        details: {
          requestId: contextReq.tenantContext.requestId,
          resourceType: resource.type,
          resourceId: resource.id,
          endpoint: req.path,
          method: req.method
        },
        clientIp: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(403).json({
        error: {
          code: 'CROSS_TENANT_ACCESS_DENIED',
          message: 'Access to resources outside your tenant is not permitted',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
  }
  
  next();
};

/**
 * Inject tenant context into MCP tool calls
 * This ensures tenant context is ALWAYS from authenticated source
 */
export const injectTenantContextForMCP = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contextReq = req as TenantContextRequest;
  
  // If this is an MCP tool call, inject tenant context
  if (req.path.includes('/mcp/call') && req.method === 'POST') {
    // Override any tenant ID in request body with authenticated context
    if (req.body) {
      // Security: Remove any client-provided tenant ID
      delete req.body.tenantId;
      delete req.body.tenant_id;
      
      // Inject authenticated tenant context
      req.body.__secureContext = {
        tenantId: contextReq.tenantContext.tenantId,
        userId: contextReq.tenantContext.userId,
        requestId: contextReq.tenantContext.requestId,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  next();
};

/**
 * Detect tenant spoofing attempts
 */
async function detectTenantSpoofing(
  req: Request,
  authenticatedContext: any
): Promise<void> {
  const suspiciousTenantIds: string[] = [];
  
  // Check for tenant IDs in various request locations
  const checkLocations = [
    req.body?.tenantId,
    req.body?.tenant_id,
    req.body?.TenantId,
    req.params?.tenantId,
    req.params?.tenant_id,
    req.query?.tenantId,
    req.query?.tenant_id
  ];
  
  for (const providedId of checkLocations) {
    if (providedId && providedId !== authenticatedContext.tenantId) {
      suspiciousTenantIds.push(providedId as string);
    }
  }
  
  if (suspiciousTenantIds.length > 0) {
    await auditLogger.logSecurityEvent({
      eventType: 'tenant_spoofing_attempt',
      severity: 'critical',
      tenantId: authenticatedContext.tenantId,
      userId: authenticatedContext.userId,
      details: {
        authenticatedTenantId: authenticatedContext.tenantId,
        attemptedTenantIds: suspiciousTenantIds,
        requestId: authenticatedContext.requestId,
        endpoint: req.path,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query
      },
      clientIp: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
}

/**
 * Extract resource identifiers from request
 */
function extractResourceIds(req: Request): Array<{ type: string; id: string }> {
  const resources: Array<{ type: string; id: string }> = [];
  
  // Extract from route parameters
  if (req.params.agentId) {
    resources.push({ type: 'agent', id: req.params.agentId });
  }
  if (req.params.configId) {
    resources.push({ type: 'llm_config', id: req.params.configId });
  }
  if (req.params.serverId) {
    resources.push({ type: 'mcp_server', id: req.params.serverId });
  }
  if (req.params.sessionId) {
    resources.push({ type: 'chat_session', id: req.params.sessionId });
  }
  
  // Extract from request body
  if (req.body?.agentId) {
    resources.push({ type: 'agent', id: req.body.agentId });
  }
  if (req.body?.connectionId) {
    resources.push({ type: 'connection', id: req.body.connectionId });
  }
  
  return resources;
}

/**
 * Validate resource belongs to tenant
 */
async function validateResourceTenantOwnership(
  resourceType: string,
  resourceId: string,
  tenantId: string
): Promise<boolean> {
  try {
    // Import database service dynamically to avoid circular dependencies
    const { DatabaseService } = await import('../services/databaseService');
    const db = DatabaseService.getInstance();
    
    let query: string;
    let params: any[];
    
    switch (resourceType) {
      case 'agent':
        query = 'SELECT tenant_id FROM agents WHERE id = ? AND tenant_id = ?';
        params = [resourceId, tenantId];
        break;
        
      case 'llm_config':
        query = 'SELECT tenant_id FROM llm_configs WHERE id = ? AND tenant_id = ?';
        params = [resourceId, tenantId];
        break;
        
      case 'mcp_server':
        // MCP servers can be global or tenant-specific
        query = `
          SELECT 1 FROM mcp_servers 
          WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)
        `;
        params = [resourceId, tenantId];
        break;
        
      case 'connection':
        query = 'SELECT tenant_id FROM connections WHERE id = ? AND tenant_id = ?';
        params = [resourceId, tenantId];
        break;
        
      case 'chat_session':
        query = 'SELECT tenant_id FROM chat_sessions WHERE id = ? AND tenant_id = ?';
        params = [resourceId, tenantId];
        break;
        
      default:
        // Unknown resource type - deny by default
        return false;
    }
    
    const result = await db.query(query, params);
    return result.length > 0;
    
  } catch (error) {
    console.error(`Error validating resource ownership: ${resourceType}/${resourceId}`, error);
    // Security: Fail closed - deny access on error
    return false;
  }
}

/**
 * Middleware to ensure tenant context is never exposed to LLM
 */
export const sanitizeLLMRequests = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Remove any tenant identifiers from LLM-bound requests
  if (req.path.includes('/llm') || req.path.includes('/chat')) {
    if (req.body?.messages) {
      // Scan and sanitize messages for tenant IDs
      req.body.messages = req.body.messages.map((msg: any) => {
        if (msg.content && typeof msg.content === 'string') {
          // Remove any UUIDs that might be tenant IDs
          msg.content = msg.content.replace(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            '[REDACTED]'
          );
        }
        return msg;
      });
    }
    
    // Remove tenant context from system prompts
    if (req.body?.systemPrompt) {
      req.body.systemPrompt = req.body.systemPrompt.replace(
        /tenant[_\s-]?id[:\s]+[0-9a-f-]+/gi,
        ''
      );
    }
  }
  
  next();
};

/**
 * Create secure tenant context middleware chain
 */
export const secureTenantContextChain = [
  extractTenantContext,
  validateTenantScope,
  injectTenantContextForMCP,
  sanitizeLLMRequests
];

export default {
  extractTenantContext,
  validateTenantScope,
  injectTenantContextForMCP,
  sanitizeLLMRequests,
  secureTenantContextChain
};