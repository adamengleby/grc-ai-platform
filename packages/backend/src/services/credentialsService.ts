import { ArcherCredentials } from './mcpClient';

/**
 * Backend credentials service for MCP integration
 * Coordinates with frontend credentials stored in localStorage
 */
export class CredentialsService {
  private credentialsCache = new Map<string, ArcherCredentials>();

  /**
   * Get credentials for a specific connection
   * Note: In production, this would interface with secure credential storage
   */
  async getCredentials(tenantId: string, connectionId: string): Promise<ArcherCredentials | null> {
    const cacheKey = `${tenantId}-${connectionId}`;
    
    // Check cache first
    if (this.credentialsCache.has(cacheKey)) {
      return this.credentialsCache.get(cacheKey)!;
    }

    // In a real implementation, this would fetch from secure storage
    // For now, return null to indicate credentials should be provided by frontend
    console.log(`[Credentials Service] Credentials for ${connectionId} should be provided by frontend`);
    return null;
  }

  /**
   * Cache credentials for a connection (called when frontend provides them)
   */
  async cacheCredentials(tenantId: string, connectionId: string, credentials: ArcherCredentials): Promise<void> {
    const cacheKey = `${tenantId}-${connectionId}`;
    this.credentialsCache.set(cacheKey, credentials);
    console.log(`[Credentials Service] Cached credentials for ${connectionId}`);
  }

  /**
   * Clear cached credentials for a connection
   */
  async clearCredentials(tenantId: string, connectionId: string): Promise<void> {
    const cacheKey = `${tenantId}-${connectionId}`;
    this.credentialsCache.delete(cacheKey);
    console.log(`[Credentials Service] Cleared credentials for ${connectionId}`);
  }

  /**
   * Clear all cached credentials for a tenant
   */
  async clearTenantCredentials(tenantId: string): Promise<void> {
    const keysToDelete = Array.from(this.credentialsCache.keys()).filter(key => 
      key.startsWith(`${tenantId}-`)
    );
    
    keysToDelete.forEach(key => this.credentialsCache.delete(key));
    console.log(`[Credentials Service] Cleared ${keysToDelete.length} credentials for tenant ${tenantId}`);
  }
}

export const credentialsManager = new CredentialsService();