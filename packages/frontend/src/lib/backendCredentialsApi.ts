/**
 * Backend Database Credentials API
 * COMPLETE REPLACEMENT for localStorage-based credentialsApi.ts
 * Uses our new database-backed backend APIs instead of localStorage
 */

import { buildApiUrl } from '@/utils/apiUrls';

export interface ArcherCredentials {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  instanceId: string;
  instanceName: string;
  userDomainId: string;
  isDefault: boolean;
  created: string;
  lastTested?: string;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  lastError?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    responseTime: number;
    version?: string;
    instanceInfo?: any;
  };
  error?: string;
}

class BackendCredentialsManager {
  private tenantId: string | null = null;
  private get baseUrl() {
    // Use environment-aware API URL
    return buildApiUrl('').replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Set tenant context for secure partitioning
   */
  setTenantContext(tenantId: string): void {
    this.tenantId = tenantId;
    console.log(`🔄 [Backend Credentials] Set tenant context: ${tenantId}`);
  }

  /**
   * Initialize - no longer needs encryption setup since backend handles it
   */
  async initialize(): Promise<void> {
    console.log('✅ [Backend Credentials] Initialized - using database backend');
    // No initialization needed - backend handles encryption and storage
  }

  /**
   * Get all credentials for the tenant
   * REPLACES: localStorage.getItem(`grc_encrypted_credentials_${tenantId}`)
   */
  async getAllCredentials(): Promise<ArcherCredentials[]> {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }

    try {
      console.log('🔍 [Backend Credentials] Loading credentials from database...');
      
      const response = await fetch(`${this.baseUrl}/simple-credentials`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': this.tenantId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load credentials: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load credentials');
      }

      // Convert database format to frontend format
      const credentials: ArcherCredentials[] = data.data.credentials.map((cred: any) => ({
        id: cred.credential_id,
        name: cred.name,
        baseUrl: cred.base_url,
        username: cred.username,
        password: '[ENCRYPTED]', // Never expose actual password
        instanceId: cred.instance_id || '',
        instanceName: cred.instance_name || '',
        userDomainId: cred.user_domain_id || '1',
        isDefault: cred.is_default === 1,
        created: cred.created_at,
        lastTested: cred.last_tested_at,
        status: this.mapTestStatusToStatus(cred.test_status),
        lastError: cred.last_error
      }));

      console.log(`✅ [Backend Credentials] Loaded ${credentials.length} credentials from database`);
      return credentials;
    } catch (error) {
      console.error('❌ [Backend Credentials] Failed to load credentials:', error);
      throw error;
    }
  }

  /**
   * Save credentials to database
   * REPLACES: localStorage.setItem(`grc_encrypted_credentials_${tenantId}`, ...)
   */
  async saveCredentials(credentials: ArcherCredentials): Promise<ArcherCredentials> {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }

    try {
      console.log('💾 [Backend Credentials] Saving credentials to database:', credentials.name);

      const payload = {
        name: credentials.name,
        connection_type: 'archer-grc',
        base_url: credentials.baseUrl,
        username: credentials.username,
        password: credentials.password, // Backend will encrypt this
        instance_id: credentials.instanceId,
        instance_name: credentials.instanceName,
        user_domain_id: credentials.userDomainId,
        is_default: credentials.isDefault
      };

      // Check if this is an update (credential has an ID and exists) or create new
      const isUpdate = credentials.id && credentials.id !== 'new' && !credentials.id.startsWith('temp-');
      let response;
      
      if (isUpdate) {
        console.log('🔄 [Backend Credentials] Updating existing credential:', credentials.id);
        response = await fetch(`${this.baseUrl}/simple-credentials/${credentials.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': this.tenantId,
          },
          body: JSON.stringify(payload),
        });
      } else {
        console.log('➕ [Backend Credentials] Creating new credential');
        response = await fetch(`${this.baseUrl}/simple-credentials/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': this.tenantId,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to save credentials: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to save credentials');
      }

      // Convert response back to frontend format
      const responseData = data.data.credential || data.data; // Handle both create and update response formats
      const savedCredential: ArcherCredentials = {
        id: responseData.credential_id,
        name: responseData.name,
        baseUrl: responseData.base_url,
        username: responseData.username,
        password: '[ENCRYPTED]',
        instanceId: responseData.instance_id || '',
        instanceName: responseData.instance_name || '',
        userDomainId: responseData.user_domain_id || '1',
        isDefault: responseData.is_default === 1,
        created: responseData.created_at,
        lastTested: data.data.last_tested_at,
        status: this.mapTestStatusToStatus(data.data.test_status),
        lastError: data.data.last_error
      };

      console.log('✅ [Backend Credentials] Saved credentials to database');
      return savedCredential;
    } catch (error) {
      console.error('❌ [Backend Credentials] Failed to save credentials:', error);
      throw error;
    }
  }

  /**
   * Update existing credentials
   */
  async updateCredentials(credentialId: string, updates: Partial<ArcherCredentials>): Promise<ArcherCredentials> {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }

    try {
      console.log('📝 [Backend Credentials] Updating credentials:', credentialId);

      const payload: any = {};
      if (updates.name) payload.name = updates.name;
      if (updates.baseUrl) payload.base_url = updates.baseUrl;
      if (updates.username) payload.username = updates.username;
      if (updates.password && updates.password !== '[ENCRYPTED]') payload.password = updates.password;
      if (updates.instanceId) payload.instance_id = updates.instanceId;
      if (updates.instanceName) payload.instance_name = updates.instanceName;
      if (updates.userDomainId) payload.user_domain_id = updates.userDomainId;
      if (updates.isDefault !== undefined) payload.is_default = updates.isDefault;
      if (updates.status) payload.test_status = this.mapStatusToTestStatus(updates.status);
      if (updates.lastTested) payload.last_tested_at = updates.lastTested;
      if (updates.lastError !== undefined) payload.last_error = updates.lastError;

      const response = await fetch(`${this.baseUrl}/simple-credentials/${credentialId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': this.tenantId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to update credentials: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update credentials');
      }

      // Convert response back to frontend format
      const updatedCredential: ArcherCredentials = {
        id: data.data.credential_id,
        name: data.data.name,
        baseUrl: data.data.base_url,
        username: data.data.username,
        password: '[ENCRYPTED]',
        instanceId: data.data.instance_id || '',
        instanceName: data.data.instance_name || '',
        userDomainId: data.data.user_domain_id || '1',
        isDefault: data.data.is_default === 1,
        created: data.data.created_at,
        lastTested: data.data.last_tested_at,
        status: this.mapTestStatusToStatus(data.data.test_status),
        lastError: data.data.last_error
      };

      console.log('✅ [Backend Credentials] Updated credentials in database');
      return updatedCredential;
    } catch (error) {
      console.error('❌ [Backend Credentials] Failed to update credentials:', error);
      throw error;
    }
  }

  /**
   * Delete credentials
   */
  async deleteCredentials(credentialId: string): Promise<void> {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }

    try {
      console.log('🗑️ [Backend Credentials] Deleting credentials:', credentialId);

      const response = await fetch(`${this.baseUrl}/simple-credentials/${credentialId}`, {
        method: 'DELETE',
        headers: {
          'x-tenant-id': this.tenantId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete credentials: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete credentials');
      }

      console.log('✅ [Backend Credentials] Deleted credentials from database');
    } catch (error) {
      console.error('❌ [Backend Credentials] Failed to delete credentials:', error);
      throw error;
    }
  }

  /**
   * Clear all credentials (for debugging)
   */
  async clearAllCredentials(): Promise<void> {
    console.log('🧹 [Backend Credentials] Clearing all credentials from database...');
    
    try {
      const credentials = await this.getAllCredentials();
      
      for (const credential of credentials) {
        await this.deleteCredentials(credential.id);
      }
      
      console.log('✅ [Backend Credentials] All credentials cleared from database');
    } catch (error) {
      console.error('❌ [Backend Credentials] Failed to clear credentials:', error);
      throw error;
    }
  }

  /**
   * Load credentials (alias for getAllCredentials for backward compatibility)
   */
  async loadCredentials(): Promise<ArcherCredentials[]> {
    return await this.getAllCredentials();
  }

  /**
   * Test connection using backend API
   */
  async testConnection(credentials: ArcherCredentials): Promise<ConnectionTestResult> {
    try {
      console.log('🧪 [Backend Credentials] Testing connection via backend...');

      const response = await fetch('/api/v1/connections/test/archer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': this.tenantId || ''
        },
        body: JSON.stringify({
          baseUrl: credentials.baseUrl,
          username: credentials.username,
          password: credentials.password,
          instanceId: credentials.instanceId,
          userDomainId: credentials.userDomainId,
          connectionId: credentials.id
        }),
      });

      const data = await response.json();
      
      const result: ConnectionTestResult = {
        success: data.success || false,
        message: data.message || 'Connection test completed',
        details: data.details,
        error: data.error
      };

      // Update credential status based on test result
      if (credentials.id) {
        await this.updateCredentials(credentials.id, {
          status: result.success ? 'connected' : 'error',
          lastTested: new Date().toISOString(),
          lastError: result.error || null
        });
      }

      console.log(`${result.success ? '✅' : '❌'} [Backend Credentials] Connection test result:`, result.success);
      return result;
    } catch (error) {
      console.error('❌ [Backend Credentials] Connection test failed:', error);
      return {
        success: false,
        message: 'Connection test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper methods for status mapping
  private mapTestStatusToStatus(testStatus: string): 'connected' | 'disconnected' | 'testing' | 'error' {
    switch (testStatus) {
      case 'success': return 'connected';
      case 'failed': return 'error';
      case 'pending': return 'disconnected';
      default: return 'disconnected';
    }
  }

  private mapStatusToTestStatus(status: string): string {
    switch (status) {
      case 'connected': return 'success';
      case 'error': return 'failed';
      case 'testing': return 'pending';
      default: return 'pending';
    }
  }
}

// Export singleton instance - DROP-IN REPLACEMENT for existing credentialsManager
export const credentialsManager = new BackendCredentialsManager();

// Export helper functions to match existing API
export const getAllCredentials = () => credentialsManager.getAllCredentials();
export const saveCredentials = (credentials: ArcherCredentials) => credentialsManager.saveCredentials(credentials);
export const deleteCredentials = (credentialId: string) => credentialsManager.deleteCredentials(credentialId);