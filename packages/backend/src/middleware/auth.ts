import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';

/**
 * Authentication middleware
 * For now, provides mock authentication for development
 * TODO: Integrate with Azure AD B2C in production
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  // In development mode, use mock authentication
  if (config.development.useMockAuth) {
    // Mock user based on common demo users
    req.user = {
      id: 'mock-user-123',
      tenantId: 'acme-corp', // Default to ACME Corporation for testing
      roles: ['TenantOwner', 'AgentUser', 'ComplianceOfficer', 'Auditor'],
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ 
      success: false, 
      error: 'Access token required',
      timestamp: new Date() 
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    req.user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      roles: decoded.roles || [],
    };
    next();
  } catch (error) {
    res.status(403).json({ 
      success: false, 
      error: 'Invalid or expired token',
      timestamp: new Date() 
    });
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        timestamp: new Date() 
      });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasPermission = allowedRoles.some(role => userRoles.includes(role));

    if (!hasPermission) {
      res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions',
        timestamp: new Date(),
        required: allowedRoles,
        userRoles 
      });
      return;
    }

    next();
  };
};

/**
 * Tenant isolation middleware
 * Ensures users can only access their tenant's data
 */
export const enforceTenantIsolation = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.tenantId) {
    res.status(401).json({ 
      success: false, 
      error: 'Tenant context required',
      timestamp: new Date() 
    });
    return;
  }

  // Add tenant context to request for use in services
  req.query.tenantId = req.user.tenantId;
  next();
};