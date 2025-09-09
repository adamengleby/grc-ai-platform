/**
 * Multi-Tenant Authorization Middleware
 * Implements Azure B2C integration with tenant-isolated RBAC
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { AzureB2CToken, UserRole, Permission } from '../types/auth';
import { auditLogger } from '../services/auditService';
import { UserService } from '../services/userService';
import { TenantService } from '../services/tenantService';

// Azure B2C Configuration
const AZURE_B2C_CONFIG = {
  tenantName: process.env.AZURE_B2C_TENANT_NAME || 'grcplatform',
  policyName: process.env.AZURE_B2C_POLICY_NAME || 'B2C_1_signin_signup',
  clientId: process.env.AZURE_B2C_CLIENT_ID,
  jwksUri: `https://${process.env.AZURE_B2C_TENANT_NAME}.b2clogin.com/${process.env.AZURE_B2C_TENANT_NAME}.onmicrosoft.com/${process.env.AZURE_B2C_POLICY_NAME}/discovery/v2.0/keys`,
  issuer: `https://${process.env.AZURE_B2C_TENANT_NAME}.b2clogin.com/${process.env.AZURE_B2C_TENANT_ID}/v2.0/`,
  audience: process.env.AZURE_B2C_CLIENT_ID
};

// JWKS client for token verification
const jwksClientInstance = jwksClient({
  jwksUri: AZURE_B2C_CONFIG.jwksUri,
  requestHeaders: {},
  timeout: 30000,
});

// Extended Request interface with auth context
export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    name: string;
    azureObjectId: string;
    tenantId: string;
    roles: UserRole[];
    permissions: Permission[];
  };
  tenant: {
    tenantId: string;
    name: string;
    subscriptionTier: string;
    status: string;
  };
  tokenData: AzureB2CToken;
}

/**
 * Main authentication middleware
 * Validates Azure B2C JWT tokens and extracts user context
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract Bearer token
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_AUTH_TOKEN',
          message: 'Authorization token is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Decode token header to get kid (key ID)
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader) {
      throw new Error('Invalid token format');
    }

    // Get public key from JWKS
    const getKey = (header: any, callback: any) => {
      jwksClientInstance.getSigningKey(header.kid, (err, key) => {
        if (err) {
          callback(err, null);
          return;
        }
        const signingKey = key?.getPublicKey?.() || key?.rsaPublicKey;
        callback(null, signingKey);
      });
    };

    // Verify JWT token
    const decoded = await new Promise<any>((resolve, reject) => {
      jwt.verify(token, getKey, {
        audience: AZURE_B2C_CONFIG.audience,
        issuer: AZURE_B2C_CONFIG.issuer,
        algorithms: ['RS256']
      }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    const azureToken = decoded as AzureB2CToken;

    // Extract tenant ID from custom header (required for all requests)
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      res.status(400).json({
        error: {
          code: 'MISSING_TENANT_ID',
          message: 'X-Tenant-ID header is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate tenant ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_TENANT_ID',
          message: 'X-Tenant-ID must be a valid UUID',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Load user from database using Azure B2C object ID
    const userService = new UserService();
    const user = await userService.getUserByAzureObjectId(azureToken.oid || azureToken.sub);
    
    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found in system',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate user has access to requested tenant
    const hasAccessToTenant = await userService.userHasAccessToTenant(user.user_id, tenantId);
    if (!hasAccessToTenant) {
      await auditLogger.logSecurityEvent({
        eventType: 'unauthorized_tenant_access',
        userId: user.user_id,
        tenantId,
        details: { requestedTenant: tenantId, userPrimaryTenant: user.primary_tenant_id },
        clientIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(403).json({
        error: {
          code: 'TENANT_ACCESS_DENIED',
          message: 'User does not have access to the requested tenant',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Load tenant information
    const tenantService = new TenantService();
    const tenant = await tenantService.getTenantById(tenantId);
    
    if (!tenant || tenant.status !== 'active') {
      res.status(403).json({
        error: {
          code: 'TENANT_INACTIVE',
          message: 'Tenant is not active',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Get user's roles and permissions for this tenant
    const userRoles = await userService.getUserRolesForTenant(user.user_id, tenantId);
    const permissions = generatePermissionsFromRoles(userRoles);

    // Attach auth context to request
    (req as AuthenticatedRequest).user = {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      azureObjectId: user.azure_b2c_object_id,
      tenantId,
      roles: userRoles,
      permissions
    };

    (req as AuthenticatedRequest).tenant = {
      tenantId: tenant.tenant_id,
      name: tenant.name,
      subscriptionTier: tenant.subscription_tier,
      status: tenant.status
    };

    (req as AuthenticatedRequest).tokenData = azureToken;

    // Log successful authentication for audit trail
    await auditLogger.logAuthenticationEvent({
      eventType: 'authentication_success',
      userId: user.user_id,
      tenantId,
      clientIp: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    await auditLogger.logSecurityEvent({
      eventType: 'authentication_failure',
      tenantId: req.headers['x-tenant-id'] as string,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      clientIp: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Invalid or expired authentication token',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required roles for the operation
 */
export const requireRoles = (requiredRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User must be authenticated',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const userRoles = authReq.user.roles;
    const hasRequiredRole = requiredRoles.some(role => 
      userRoles.includes(role) || userRoles.includes('PlatformOwner') // Platform owners have access to everything
    );

    if (!hasRequiredRole) {
      await auditLogger.logSecurityEvent({
        eventType: 'authorization_failure',
        userId: authReq.user.userId,
        tenantId: authReq.user.tenantId,
        details: { 
          requiredRoles, 
          userRoles, 
          resource: req.route?.path,
          method: req.method
        },
        clientIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'User does not have required roles for this operation',
          details: {
            required: requiredRoles,
            user_roles: userRoles
          },
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 * Checks if user has specific permissions for resources and actions
 */
export const requirePermissions = (resource: string, actions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User must be authenticated',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const userPermissions = authReq.user.permissions;
    const hasPermission = actions.every(action => 
      hasResourcePermission(userPermissions, resource, action)
    );

    if (!hasPermission) {
      await auditLogger.logSecurityEvent({
        eventType: 'authorization_failure',
        userId: authReq.user.userId,
        tenantId: authReq.user.tenantId,
        details: { 
          requiredPermissions: { resource, actions }, 
          userPermissions,
          endpoint: req.route?.path,
          method: req.method
        },
        clientIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'User does not have required permissions for this operation',
          details: {
            required: { resource, actions },
            missing: actions.filter(action => !hasResourcePermission(userPermissions, resource, action))
          },
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
};

/**
 * Resource ownership middleware
 * Validates that the user has ownership/access rights to specific resources
 */
export const requireResourceAccess = (resourceType: string, resourceIdParam: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const resourceId = req.params[resourceIdParam];

    if (!resourceId) {
      res.status(400).json({
        error: {
          code: 'MISSING_RESOURCE_ID',
          message: `Resource ID parameter '${resourceIdParam}' is required`,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Check if user has access to this specific resource
    // This would be implemented based on the specific resource type
    const hasAccess = await checkResourceAccess(
      authReq.user.userId,
      authReq.user.tenantId,
      authReq.user.roles,
      resourceType,
      resourceId
    );

    if (!hasAccess) {
      await auditLogger.logSecurityEvent({
        eventType: 'unauthorized_resource_access',
        userId: authReq.user.userId,
        tenantId: authReq.user.tenantId,
        details: { 
          resourceType,
          resourceId,
          endpoint: req.route?.path,
          method: req.method
        },
        clientIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(403).json({
        error: {
          code: 'RESOURCE_ACCESS_DENIED',
          message: 'User does not have access to this resource',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
};

/**
 * Tenant quota enforcement middleware
 * Checks if tenant has remaining quota for the operation
 */
export const enforceQuota = (quotaType: 'api_calls' | 'tokens' | 'storage') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    
    const tenantService = new TenantService();
    const quota = await tenantService.getTenantQuota(authReq.user.tenantId);
    
    if (!quota) {
      res.status(500).json({
        error: {
          code: 'QUOTA_CHECK_FAILED',
          message: 'Unable to check tenant quota',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    let hasQuota = true;
    let quotaMessage = '';

    switch (quotaType) {
      case 'api_calls':
        hasQuota = quota.currentUsage.apiCalls < quota.dailyApiCalls;
        quotaMessage = 'Daily API call quota exceeded';
        break;
      case 'tokens':
        hasQuota = quota.currentUsage.tokens < quota.monthlyTokens;
        quotaMessage = 'Monthly token quota exceeded';
        break;
      case 'storage':
        hasQuota = quota.currentUsage.storage < quota.storageGB;
        quotaMessage = 'Storage quota exceeded';
        break;
    }

    if (!hasQuota) {
      await auditLogger.logEvent({
        eventType: 'quota_exceeded',
        eventCategory: 'usage',
        severity: 'warning',
        userId: authReq.user.userId,
        tenantId: authReq.user.tenantId,
        details: { quotaType, quota }
      });

      res.status(429).json({
        error: {
          code: 'QUOTA_EXCEEDED',
          message: quotaMessage,
          details: {
            quotaType,
            currentUsage: quota.currentUsage,
            limits: {
              dailyApiCalls: quota.dailyApiCalls,
              monthlyTokens: quota.monthlyTokens,
              storageGB: quota.storageGB
            }
          },
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Increment usage counter for API calls
    if (quotaType === 'api_calls') {
      await tenantService.incrementApiCallUsage(authReq.user.tenantId);
    }

    next();
  };
};

/**
 * Cross-tenant access prevention middleware
 * Ensures all operations are scoped to the authenticated tenant
 */
export const preventCrossTenantAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  
  // Check if request contains any tenant IDs in body/params that don't match authenticated tenant
  const requestTenantIds = extractTenantIdsFromRequest(req);
  const authenticatedTenantId = authReq.user.tenantId;
  
  const hasInvalidTenantId = requestTenantIds.some(id => id !== authenticatedTenantId);
  
  if (hasInvalidTenantId) {
    await auditLogger.logSecurityEvent({
      eventType: 'cross_tenant_access_attempt',
      userId: authReq.user.userId,
      tenantId: authenticatedTenantId,
      details: { 
        requestTenantIds,
        authenticatedTenantId,
        endpoint: req.route?.path,
        method: req.method,
        body: req.body,
        params: req.params
      },
      clientIp: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(403).json({
      error: {
        code: 'CROSS_TENANT_ACCESS_DENIED',
        message: 'Cannot access resources from other tenants',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  next();
};

// Helper Functions

/**
 * Generate permissions based on user roles
 */
function generatePermissionsFromRoles(roles: UserRole[]): Permission[] {
  const permissions: Permission[] = [];

  roles.forEach(role => {
    switch (role) {
      case 'PlatformOwner':
        permissions.push(
          { resource: '*', actions: ['read', 'write', 'delete', 'admin'] },
          { resource: 'cross-tenant', actions: ['read', 'write', 'delete', 'admin'] }
        );
        break;
      case 'TenantOwner':
        permissions.push(
          { resource: '*', actions: ['read', 'write', 'delete', 'admin'] }
        );
        break;
      case 'AgentUser':
        permissions.push(
          { resource: 'dashboard', actions: ['read'] },
          { resource: 'agents', actions: ['read', 'write'] },
          { resource: 'mcp-tools', actions: ['read', 'write'] },
          { resource: 'chat', actions: ['read', 'write'] },
          { resource: 'llm-configs', actions: ['read'] }
        );
        break;
      case 'Auditor':
      case 'ComplianceOfficer':
        permissions.push(
          { resource: 'audit', actions: ['read'] },
          { resource: 'compliance', actions: ['read'] },
          { resource: 'reports', actions: ['read'] },
          { resource: 'dashboard', actions: ['read'] }
        );
        break;
    }
  });

  return permissions;
}

/**
 * Check if user has specific resource permission
 */
function hasResourcePermission(permissions: Permission[], resource: string, action: string): boolean {
  return permissions.some(permission => {
    const resourceMatch = permission.resource === '*' || permission.resource === resource;
    const actionMatch = permission.actions.includes(action) || permission.actions.includes('admin');
    return resourceMatch && actionMatch;
  });
}

/**
 * Check if user has access to specific resource
 */
async function checkResourceAccess(
  userId: string,
  tenantId: string,
  userRoles: UserRole[],
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  // Platform owners have access to everything
  if (userRoles.includes('PlatformOwner')) {
    return true;
  }

  // Tenant owners have access to all resources in their tenant
  if (userRoles.includes('TenantOwner')) {
    // Just need to verify the resource belongs to the tenant
    return await verifyResourceBelongsToTenant(resourceType, resourceId, tenantId);
  }

  // For other roles, implement specific access checks
  switch (resourceType) {
    case 'agent':
      // Users can access agents they created or all agents if they're AgentUsers
      return await verifyAgentAccess(userId, tenantId, resourceId);
    case 'llm-config':
      return await verifyLlmConfigAccess(userId, tenantId, resourceId);
    case 'chat-session':
      return await verifyChatSessionAccess(userId, tenantId, resourceId);
    default:
      return false;
  }
}

/**
 * Extract tenant IDs from request body and parameters
 */
function extractTenantIdsFromRequest(req: Request): string[] {
  const tenantIds: string[] = [];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Check common parameter names
  const checkField = (value: any) => {
    if (typeof value === 'string' && uuidRegex.test(value)) {
      tenantIds.push(value);
    }
  };

  // Check request body
  if (req.body) {
    if (req.body.tenant_id) checkField(req.body.tenant_id);
    if (req.body.tenantId) checkField(req.body.tenantId);
  }

  // Check parameters
  if (req.params.tenant_id) checkField(req.params.tenant_id);
  if (req.params.tenantId) checkField(req.params.tenantId);

  return tenantIds;
}

// Placeholder functions for resource access verification
// These would be implemented with actual database queries
async function verifyResourceBelongsToTenant(resourceType: string, resourceId: string, tenantId: string): Promise<boolean> {
  // Implementation would query the database to verify resource ownership
  return true; // Placeholder
}

async function verifyAgentAccess(userId: string, tenantId: string, agentId: string): Promise<boolean> {
  // Implementation would check if user has access to this specific agent
  return true; // Placeholder
}

async function verifyLlmConfigAccess(userId: string, tenantId: string, configId: string): Promise<boolean> {
  // Implementation would check if user has access to this LLM config
  return true; // Placeholder
}

async function verifyChatSessionAccess(userId: string, tenantId: string, sessionId: string): Promise<boolean> {
  // Implementation would check if user owns this chat session
  return true; // Placeholder
}