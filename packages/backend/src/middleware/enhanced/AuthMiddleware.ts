import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export interface User {
  id: string;
  tenantId?: string;
  name: string;
  email: string;
  roles: string[];
  grcPermissions?: {
    canViewIncidents: boolean;
    canCreateRisks: boolean;
    canManageCompliance: boolean;
    canAccessAuditLogs: boolean;
  };
}

export interface AuthenticatedRequest extends Request {
  user: User;
}

export class AuthMiddleware {
  private mockMode: boolean;
  private jwksClients: Map<string, jwksClient.JwksClient>;

  constructor() {
    // Check if we're in development mode
    this.mockMode = process.env.NODE_ENV !== 'production' || !process.env.AZURE_B2C_TENANT_ID;
    this.jwksClients = new Map();

    if (!this.mockMode) {
      console.log('🔐 Enhanced Auth Middleware initialized for Azure B2C');
      this.initializeJWKSClients();
    } else {
      console.log('🔓 Enhanced Auth Middleware initialized in development mode (mock auth)');
    }
  }

  private initializeJWKSClients(): void {
    // Initialize JWKS clients for different tenants
    const tenantId = process.env.AZURE_B2C_TENANT_ID;
    const policyName = process.env.AZURE_B2C_POLICY_NAME || 'B2C_1_signupsignin';

    if (tenantId) {
      const jwksUri = `https://${tenantId}.b2clogin.com/${tenantId}.onmicrosoft.com/${policyName}/discovery/v2.0/keys`;

      this.jwksClients.set('default', jwksClient({
        jwksUri,
        requestHeaders: {},
        timeout: 30000,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksRequestTimeout: 30000
      }));

      console.log(`🔑 JWKS client initialized for tenant: ${tenantId}`);
    }
  }

  validateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (this.mockMode) {
        // Mock user for development with GRC permissions
        (req as AuthenticatedRequest).user = {
          id: 'mock-user-123',
          tenantId: 'mock-tenant-grc',
          name: 'GRC Developer User',
          email: 'dev@grc-platform.com',
          roles: ['grc_analyst', 'compliance_officer'],
          grcPermissions: {
            canViewIncidents: true,
            canCreateRisks: true,
            canManageCompliance: true,
            canAccessAuditLogs: true
          }
        };
        return next();
      }

      // Production Azure B2C token validation
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'No valid Bearer token provided'
          }
        });
        return;
      }

      const token = authHeader.substring(7);
      const user = await this.validateAzureB2CToken(token);

      (req as AuthenticatedRequest).user = user;
      next();

    } catch (error) {
      console.error('Auth validation error:', error);
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token validation failed',
          details: error.message
        }
      });
    }
  };

  private async validateAzureB2CToken(token: string): Promise<User> {
    return new Promise((resolve, reject) => {
      // Decode token header to get kid (key ID)
      const decodedHeader = jwt.decode(token, { complete: true })?.header;

      if (!decodedHeader || !decodedHeader.kid) {
        reject(new Error('Invalid token header'));
        return;
      }

      // Get the appropriate JWKS client
      const jwksClientInstance = this.jwksClients.get('default');

      if (!jwksClientInstance) {
        reject(new Error('JWKS client not configured'));
        return;
      }

      // Get the signing key
      jwksClientInstance.getSigningKey(decodedHeader.kid, (err, key) => {
        if (err) {
          reject(new Error(`Failed to get signing key: ${err.message}`));
          return;
        }

        const signingKey = key?.getPublicKey();

        if (!signingKey) {
          reject(new Error('No signing key available'));
          return;
        }

        // Verify the token
        jwt.verify(token, signingKey, {
          algorithms: ['RS256'],
          audience: process.env.AZURE_B2C_CLIENT_ID,
          issuer: `https://${process.env.AZURE_B2C_TENANT_ID}.b2clogin.com/${process.env.AZURE_B2C_TENANT_ID}.onmicrosoft.com/v2.0/`
        }, (verifyErr, decoded) => {
          if (verifyErr) {
            reject(new Error(`Token verification failed: ${verifyErr.message}`));
            return;
          }

          const payload = decoded as any;

          // Extract user information from token
          const user: User = {
            id: payload.sub || payload.oid,
            tenantId: payload.tid,
            name: payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
            email: payload.email || payload.emails?.[0] || payload.preferred_username,
            roles: payload.extension_roles || payload.roles || ['user'],
            grcPermissions: this.determineGRCPermissions(payload.extension_roles || payload.roles || [])
          };

          resolve(user);
        });
      });
    });
  }

  private determineGRCPermissions(roles: string[]): User['grcPermissions'] {
    const permissions = {
      canViewIncidents: false,
      canCreateRisks: false,
      canManageCompliance: false,
      canAccessAuditLogs: false
    };

    // Map roles to GRC permissions
    const rolePermissions: Record<string, Partial<User['grcPermissions']>> = {
      'grc_admin': {
        canViewIncidents: true,
        canCreateRisks: true,
        canManageCompliance: true,
        canAccessAuditLogs: true
      },
      'grc_analyst': {
        canViewIncidents: true,
        canCreateRisks: true,
        canManageCompliance: false,
        canAccessAuditLogs: false
      },
      'compliance_officer': {
        canViewIncidents: true,
        canCreateRisks: false,
        canManageCompliance: true,
        canAccessAuditLogs: true
      },
      'risk_manager': {
        canViewIncidents: true,
        canCreateRisks: true,
        canManageCompliance: false,
        canAccessAuditLogs: false
      },
      'auditor': {
        canViewIncidents: true,
        canCreateRisks: false,
        canManageCompliance: false,
        canAccessAuditLogs: true
      },
      'user': {
        canViewIncidents: false,
        canCreateRisks: false,
        canManageCompliance: false,
        canAccessAuditLogs: false
      }
    };

    // Apply permissions based on user roles
    for (const role of roles) {
      const rolePerms = rolePermissions[role.toLowerCase()];
      if (rolePerms) {
        Object.assign(permissions, rolePerms);
      }
    }

    return permissions;
  }

  requireGRCPermission = (permission: keyof User['grcPermissions']) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      if (!user.grcPermissions?.[permission]) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `GRC permission required: ${permission}`,
            requiredPermission: permission,
            userRoles: user.roles
          }
        });
        return;
      }

      next();
    };
  };

  requireRole = (requiredRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const hasRequiredRole = requiredRoles.some(role =>
        user.roles.includes(role.toLowerCase())
      );

      if (!hasRequiredRole) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'Required role not found',
            requiredRoles,
            userRoles: user.roles
          }
        });
        return;
      }

      next();
    };
  };

  getTenantContext = (req: Request): string | null => {
    const user = (req as AuthenticatedRequest).user;
    return user?.tenantId || null;
  };

  logGRCAccess = (action: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as AuthenticatedRequest).user;

      console.log(`🔐 GRC Access Log: ${action}`, {
        userId: user?.id,
        tenantId: user?.tenantId,
        email: user?.email,
        roles: user?.roles,
        timestamp: new Date().toISOString(),
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      next();
    };
  };

  validateTenantAccess = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    const requestedTenantId = req.headers['x-tenant-id'] || req.params.tenantId;

    if (requestedTenantId && user.tenantId !== requestedTenantId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_ACCESS_DENIED',
          message: 'Access denied to requested tenant',
          userTenant: user.tenantId,
          requestedTenant: requestedTenantId
        }
      });
      return;
    }

    next();
  };
}