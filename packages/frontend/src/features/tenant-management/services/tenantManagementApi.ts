import { 
  Tenant, 
  TenantSAMLConfig,
  TenantSAMLGroupMapping,
  CreateTenantRequest,
  TenantConfigurationRequest,
  TenantManagementResponse,
  TenantListResponse,
  SAMLTestResult
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV
  ? 'http://localhost:3005/api/v1'
  : 'https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/api/v1');

class TenantManagementApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers here when implementing authentication
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Tenant Management APIs
  async getTenants(page = 1, limit = 10, search?: string): Promise<TenantListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    });

    return this.request<TenantListResponse>(`/tenant-management/tenants?${params}`);
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}`);
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch tenant');
    }
    return response.data;
  }

  async createTenant(tenantData: CreateTenantRequest): Promise<Tenant> {
    const response = await this.request<TenantManagementResponse>('/tenant-management/tenants', {
      method: 'POST',
      body: JSON.stringify(tenantData),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to create tenant');
    }
    return response.data;
  }

  async updateTenant(tenantId: string, tenantData: Partial<CreateTenantRequest>): Promise<Tenant> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(tenantData),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update tenant');
    }
    return response.data;
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete tenant');
    }
  }

  // SAML Configuration APIs
  async getTenantSAMLConfig(tenantId: string): Promise<TenantSAMLConfig | null> {
    try {
      const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}/saml`);
      return response.success ? response.data : null;
    } catch (error) {
      // Return null if SAML config doesn't exist yet
      return null;
    }
  }

  async configureTenantSAML(tenantId: string, config: TenantConfigurationRequest): Promise<TenantSAMLConfig> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}/saml`, {
      method: 'POST',
      body: JSON.stringify(config),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to configure SAML');
    }
    return response.data;
  }

  async updateTenantSAML(tenantId: string, config: Partial<TenantConfigurationRequest>): Promise<TenantSAMLConfig> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}/saml`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update SAML configuration');
    }
    return response.data;
  }

  async testSAMLConfiguration(tenantId: string): Promise<SAMLTestResult> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}/saml/test`, {
      method: 'POST',
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to test SAML configuration');
    }
    return response.data;
  }

  // SAML Group Mapping APIs
  async getTenantGroupMappings(tenantId: string): Promise<TenantSAMLGroupMapping[]> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}/groups`);
    return response.success ? response.data : [];
  }

  async createGroupMapping(tenantId: string, mapping: Omit<TenantSAMLGroupMapping, 'mapping_id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<TenantSAMLGroupMapping> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}/groups`, {
      method: 'POST',
      body: JSON.stringify(mapping),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to create group mapping');
    }
    return response.data;
  }

  async updateGroupMapping(tenantId: string, mappingId: string, mapping: Partial<TenantSAMLGroupMapping>): Promise<TenantSAMLGroupMapping> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}/groups/${mappingId}`, {
      method: 'PUT',
      body: JSON.stringify(mapping),
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update group mapping');
    }
    return response.data;
  }

  async deleteGroupMapping(tenantId: string, mappingId: string): Promise<void> {
    const response = await this.request<TenantManagementResponse>(`/tenant-management/tenants/${tenantId}/groups/${mappingId}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete group mapping');
    }
  }

  // SAML Authentication APIs (for testing)
  async generateSAMLMetadata(tenantSlug: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/auth/saml/${tenantSlug}/metadata`);
    if (!response.ok) {
      throw new Error('Failed to generate SAML metadata');
    }
    return response.text();
  }

  async testSAMLAuth(tenantSlug: string): Promise<SAMLTestResult> {
    const response = await this.request<{ success: boolean; data: SAMLTestResult }>(`/auth/saml/${tenantSlug}/test`);
    return response.data;
  }

  // Utility method to get SAML login URL
  getSAMLLoginUrl(tenantSlug: string, relayState?: string): string {
    const baseUrl = `${API_BASE_URL}/auth/saml/${tenantSlug}/login`;
    if (relayState) {
      return `${baseUrl}?relayState=${encodeURIComponent(relayState)}`;
    }
    return baseUrl;
  }
}

export const tenantManagementApi = new TenantManagementApiService();