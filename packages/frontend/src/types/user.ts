import { User, UserRole } from './tenant';

// Re-export for convenience
export type { UserRole };

// Extended user interface for user management
export interface UserWithMetadata extends User {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastActiveAt?: string;
  profile: UserProfile;
  permissions: UserPermissions;
  auditHistory: UserAuditEvent[];
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  department?: string;
  jobTitle?: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  inApp: boolean;
  riskAlerts: boolean;
  complianceUpdates: boolean;
  auditReports: boolean;
}

export interface UserPermissions {
  role: UserRole;
  customPermissions: Permission[];
  restrictions: PermissionRestriction[];
}

export interface Permission {
  resource: string;
  actions: PermissionAction[];
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'in' | 'not_in';
  value: any;
}

export interface PermissionRestriction {
  resource: string;
  actions: PermissionAction[];
  reason: string;
}

export type PermissionAction = 'read' | 'write' | 'delete' | 'admin' | 'execute' | 'approve';

export interface UserAuditEvent {
  id: string;
  timestamp: string;
  action: UserAction;
  resource: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  outcome: 'success' | 'failure' | 'warning';
}

export type UserAction = 
  | 'login'
  | 'logout'
  | 'profile_update'
  | 'password_change'
  | 'role_change'
  | 'permission_grant'
  | 'permission_revoke'
  | 'mfa_enable'
  | 'mfa_disable'
  | 'data_access'
  | 'config_change'
  | 'agent_interaction'
  | 'export_data';

export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  message?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  location?: string;
  startedAt: string;
  lastActiveAt: string;
  status: 'active' | 'expired' | 'terminated';
}

export interface DeviceInfo {
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  isMobile: boolean;
}

// User management operation types
export interface CreateUserRequest {
  email: string;
  name: string;
  role: UserRole;
  profile: Partial<UserProfile>;
  sendInvitation: boolean;
}

export interface UpdateUserRequest {
  id: string;
  name?: string;
  role?: UserRole;
  profile?: Partial<UserProfile>;
  permissions?: Partial<UserPermissions>;
  isActive?: boolean;
}

export interface UserFilterOptions {
  roles?: UserRole[];
  status?: ('active' | 'inactive')[];
  departments?: string[];
  searchTerm?: string;
  sortBy?: 'name' | 'email' | 'role' | 'lastLogin' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  users: UserWithMetadata[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Role management types
export interface RoleDefinition {
  name: UserRole;
  displayName: string;
  description: string;
  permissions: Permission[];
  isBuiltIn: boolean;
  canBeAssigned: boolean;
}

export interface RoleAssignment {
  userId: string;
  role: UserRole;
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
}