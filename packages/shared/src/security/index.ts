// Shared security utilities for GRC Dashboard

import { z } from 'zod'

export const TenantIdSchema = z.string().min(1, 'Tenant ID is required')
export const UserIdSchema = z.string().min(1, 'User ID is required')

export interface SecurityContext {
  tenantId: string
  userId: string
  permissions: string[]
  ipAddress: string
  userAgent: string
}

export const validateTenantAccess = (
  context: SecurityContext,
  resourceTenantId: string
): boolean => {
  return context.tenantId === resourceTenantId
}

export const hasPermission = (
  context: SecurityContext,
  requiredPermission: string
): boolean => {
  return context.permissions.includes(requiredPermission) || 
         context.permissions.includes('admin')
}

export const sanitizeForLog = (data: Record<string, unknown>): Record<string, unknown> => {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential']
  const sanitized = { ...data }
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
    }
  })
  
  return sanitized
}

export const createAuditContext = (
  tenantId: string,
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  ipAddress: string,
  userAgent: string
) => ({
  tenantId,
  userId,
  action,
  resource,
  resourceId,
  timestamp: new Date(),
  ipAddress,
  userAgent,
})