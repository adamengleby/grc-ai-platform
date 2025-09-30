// Shared types for GRC Dashboard

export interface Tenant {
  id: string
  name: string
  domain: string
  status: 'active' | 'suspended' | 'pending'
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  tenantId: string
  email: string
  name: string
  role: 'admin' | 'tenant_owner' | 'user'
  permissions: string[]
  createdAt: Date
  lastLoginAt?: Date
}

export interface McpServer {
  id: string
  name: string
  description: string
  version: string
  endpoint: string
  capabilities: string[]
  isApproved: boolean
  metadata: Record<string, unknown>
}

export interface Agent {
  id: string
  tenantId: string
  name: string
  description: string
  type: string
  configuration: Record<string, unknown>
  status: 'active' | 'inactive' | 'error'
  createdAt: Date
  updatedAt: Date
}

export interface AuditLog {
  id: string
  tenantId: string
  userId: string
  action: string
  resource: string
  resourceId: string
  details: Record<string, unknown>
  timestamp: Date
  ipAddress: string
  userAgent: string
}