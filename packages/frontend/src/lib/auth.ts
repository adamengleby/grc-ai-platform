// Azure AD B2C authentication mock implementation
// In production, this would use @azure/msal-browser and @azure/msal-react

import { AzureB2CToken, User, UserRole, Tenant } from '@/types/tenant';

// Mock Azure B2C configuration - unused in demo
// const MOCK_B2C_CONFIG = {
//   authority: 'https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/B2C_1_signupsignin',
//   clientId: 'your-client-id',
//   redirectUri: window.location.origin,
//   scopes: ['openid', 'profile', 'https://your-tenant.onmicrosoft.com/api/tenant.read'],
// };

// Mock tenant data for demonstration
const MOCK_TENANTS: Record<string, Tenant> = {
  'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d': {
    id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    name: 'ACME Corporation',
    subscriptionTier: 'enterprise',
    status: 'active',
    region: 'australia-east',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-08-19T00:00:00Z',
    settings: {
      enabledFeatures: ['mcp-tools', 'byo-llm', 'advanced-audit', 'compliance-reports'],
      mcpToolsEnabled: ['archer-connector', 'risk-analyzer', 'compliance-checker'],
      byoLlmEnabled: true,
      auditRetentionDays: 2555, // 7 years for compliance
      allowedMcpServers: ['archer', 'servicenow', 'azure-sentinel'],
      complianceFrameworks: ['ISO27001', 'CPS230'],
    },
    quota: {
      dailyApiCalls: 10000,
      monthlyTokens: 1000000,
      storageGB: 100,
      users: 50,
      currentUsage: {
        apiCalls: 2847,
        tokens: 245000,
        storage: 23.5,
        users: 12,
      },
    },
  },
  'f1234567-89ab-4cde-f012-3456789abcde': {
    id: 'f1234567-89ab-4cde-f012-3456789abcde',
    name: 'FinTech Solutions Ltd',
    subscriptionTier: 'professional',
    status: 'active',
    region: 'australia-east',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-08-19T00:00:00Z',
    settings: {
      enabledFeatures: ['mcp-tools', 'compliance-reports'],
      mcpToolsEnabled: ['archer-connector', 'compliance-checker'],
      byoLlmEnabled: false,
      auditRetentionDays: 2555,
      allowedMcpServers: ['archer', 'azure-sentinel'],
      complianceFrameworks: ['CPS230', 'SOC2'],
    },
    quota: {
      dailyApiCalls: 5000,
      monthlyTokens: 500000,
      storageGB: 50,
      users: 25,
      currentUsage: {
        apiCalls: 1234,
        tokens: 156000,
        storage: 18.2,
        users: 8,
      },
    },
  },
};

const MOCK_USERS: Record<string, User> = {
  'user1@acme.com': {
    id: 'user-001',
    email: 'user1@acme.com',
    name: 'Sarah Chen',
    tenantId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    roles: ['TenantOwner'],
    lastLogin: '2024-08-19T08:30:00Z',
    isActive: true,
    mfaEnabled: true,
  },
  'analyst@acme.com': {
    id: 'user-002',
    email: 'analyst@acme.com',
    name: 'Mike Johnson',
    tenantId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    roles: ['AgentUser'],
    lastLogin: '2024-08-19T07:15:00Z',
    isActive: true,
    mfaEnabled: true,
  },
  'audit@acme.com': {
    id: 'user-003',
    email: 'audit@acme.com',
    name: 'Lisa Wang',
    tenantId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    roles: ['Auditor', 'ComplianceOfficer'],
    lastLogin: '2024-08-18T16:45:00Z',
    isActive: true,
    mfaEnabled: true,
  },
  'owner@fintech.com': {
    id: 'user-004',
    email: 'owner@fintech.com',
    name: 'David Smith',
    tenantId: 'f1234567-89ab-4cde-f012-3456789abcde',
    roles: ['TenantOwner'],
    lastLogin: '2024-08-19T09:00:00Z',
    isActive: true,
    mfaEnabled: true,
  },
  'admin@platform.com': {
    id: 'user-005',
    email: 'admin@platform.com',
    name: 'Alex Rodriguez',
    tenantId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d', // Default tenant for platform admin
    roles: ['PlatformOwner'],
    lastLogin: '2024-08-20T10:15:00Z',
    isActive: true,
    mfaEnabled: true,
  },
};

export class AuthService {
  private static instance: AuthService;
  private currentToken: AzureB2CToken | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Mock login - simulates Azure B2C authentication
  // In real OAuth, this would redirect to Azure AD B2C
  async login(email: string, password?: string): Promise<{ token: AzureB2CToken; user: User; tenant: Tenant }> {
    // Simulate network delay for more realistic experience
    await new Promise(resolve => setTimeout(resolve, 1500));

    const user = MOCK_USERS[email];
    if (!user) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    // In credential mode, validate that password was provided (any password works for demo)
    if (password !== undefined && !password) {
      throw new Error('Password is required');
    }

    const tenant = MOCK_TENANTS[user.tenantId];
    if (!tenant || tenant.status !== 'active') {
      throw new Error('Tenant not active or not found');
    }

    // Create mock JWT token
    const token: AzureB2CToken = {
      tenantId: user.tenantId,
      userId: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours expiry for demo
      aud: 'api://your-saas',
      iss: 'https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/v2.0/',
    };

    this.currentToken = token;
    
    // Store in localStorage for persistence (in production, use secure token storage)
    localStorage.setItem('auth_token', JSON.stringify(token));
    localStorage.setItem('current_user', JSON.stringify(user));
    localStorage.setItem('current_tenant', JSON.stringify(tenant));

    return { token, user, tenant };
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    try {
      const token = this.getCurrentToken();
      if (!token) return false;
      
      // Check if token is expired
      return token.exp > Math.floor(Date.now() / 1000);
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  // Get current token
  getCurrentToken(): AzureB2CToken | null {
    if (this.currentToken && this.currentToken.exp > Math.floor(Date.now() / 1000)) {
      return this.currentToken;
    }

    // Try to load from localStorage
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      try {
        const token = JSON.parse(stored) as AzureB2CToken;
        if (token.exp > Math.floor(Date.now() / 1000)) {
          this.currentToken = token;
          return token;
        }
      } catch {
        // Invalid stored token
      }
    }

    return null;
  }

  // Get current user
  getCurrentUser(): User | null {
    const stored = localStorage.getItem('current_user');
    if (stored) {
      try {
        return JSON.parse(stored) as User;
      } catch {
        return null;
      }
    }
    return null;
  }

  // Get current tenant
  getCurrentTenant(): Tenant | null {
    const stored = localStorage.getItem('current_tenant');
    if (stored) {
      try {
        return JSON.parse(stored) as Tenant;
      } catch {
        return null;
      }
    }
    return null;
  }

  // Switch tenant (for multi-tenant users)
  async switchTenant(tenantId: string): Promise<Tenant> {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // In production, verify user has access to this tenant
    const tenant = MOCK_TENANTS[tenantId];
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    localStorage.setItem('current_tenant', JSON.stringify(tenant));
    
    // Update token with new tenantId
    const token = this.getCurrentToken();
    if (token) {
      token.tenantId = tenantId;
      this.currentToken = token;
      localStorage.setItem('auth_token', JSON.stringify(token));
    }

    return tenant;
  }

  // Logout
  async logout(): Promise<void> {
    this.currentToken = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('current_tenant');
  }

  // Check if user has specific role
  hasRole(role: UserRole): boolean {
    const user = this.getCurrentUser();
    return user?.roles.includes(role) || false;
  }

  // Check if user has permission for action on resource
  hasPermission(resource: string, action: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    // Simple permission logic based on roles
    if (user.roles.includes('PlatformOwner')) {
      return true; // Platform owners have all permissions across all tenants
    }
    
    if (user.roles.includes('TenantOwner')) {
      return true; // Tenant owners have all permissions within their tenant
    }

    if (user.roles.includes('Auditor') || user.roles.includes('ComplianceOfficer')) {
      return action === 'read'; // Auditors have read-only access
    }

    if (user.roles.includes('AgentUser')) {
      // Agent users can read most things and execute certain actions
      return action === 'read' || (resource.includes('agent') && action === 'execute');
    }

    return false;
  }

  // Get available tenants for current user (mock)
  async getAvailableTenants(): Promise<Tenant[]> {
    const user = this.getCurrentUser();
    if (!user) return [];

    // Platform owners can access all tenants
    if (user.roles.includes('PlatformOwner')) {
      return Object.values(MOCK_TENANTS);
    }

    // In production, this would query the API for tenants the user has access to
    // Regular users only access their own tenant
    return Object.values(MOCK_TENANTS).filter(tenant => 
      tenant.id === user.tenantId
    );
  }
}

export const authService = AuthService.getInstance();