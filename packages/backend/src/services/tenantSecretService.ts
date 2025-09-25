/**
 * Tenant Secret Service
 * Manages tenant-specific secrets in Azure Key Vault
 * Implements Option 2: Tenant Self-Service (Advanced) pattern
 */

// Azure Key Vault imports - disabled for local development
// import { SecretClient } from '@azure/keyvault-secrets';
// import { DefaultAzureCredential } from '@azure/identity';
import winston from 'winston';
import { DatabaseService } from './databaseService';

export interface TenantSecret {
  name: string;
  description?: string;
  type: 'api-key' | 'connection-string' | 'certificate' | 'custom';
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface SecretReference {
  keyVaultName: string;
  secretName: string;
  version?: string;
}

export class TenantSecretService {
  private static instance: TenantSecretService;
  // private credential: DefaultAzureCredential;  // Disabled for local dev
  private logger: winston.Logger;
  private db: DatabaseService;
  private mockSecrets: Map<string, string> = new Map(); // Mock storage for development

  private constructor() {
    // this.credential = new DefaultAzureCredential();  // Disabled for local dev
    this.db = DatabaseService.getInstance();
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
      ]
    });
  }

  public static getInstance(): TenantSecretService {
    if (!TenantSecretService.instance) {
      TenantSecretService.instance = new TenantSecretService();
    }
    return TenantSecretService.instance;
  }

  /**
   * Get the Key Vault URL for a specific tenant
   */
  private getTenantKeyVaultUrl(tenantId: string): string {
    // In development, use a single Key Vault for all tenants
    // In production, each tenant gets their own Key Vault
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return process.env.AZURE_KEY_VAULT_URL || `https://grc-platform-dev.vault.azure.net/`;
    }
    
    // Production: tenant-specific Key Vault
    return `https://${tenantId}-keyvault.vault.azure.net/`;
  }

  /**
   * Get a Secret Client for the tenant's Key Vault
   * In development mode, returns null since we use mock storage
   */
  private getSecretClient(tenantId: string): any {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      this.logger.info(`[Tenant Secrets] Development mode - using mock storage for tenant ${tenantId}`);
      return null; // Use mock storage instead
    }
    
    // Production would use: 
    // const keyVaultUrl = this.getTenantKeyVaultUrl(tenantId);
    // return new SecretClient(keyVaultUrl, this.credential);
    throw new Error('Azure Key Vault not available - use development mode');
  }

  /**
   * Create or update a secret for a tenant
   */
  async setTenantSecret(
    tenantId: string,
    secretName: string,
    secretValue: string,
    options: {
      description?: string;
      type?: TenantSecret['type'];
      contentType?: string;
      tags?: Record<string, string>;
    } = {}
  ): Promise<SecretReference> {
    try {
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      // Prefix secret name with tenant ID for isolation in development
      const prefixedSecretName = `${tenantId}-${secretName}`;

      if (isDevelopment) {
        // Development: Store in memory map
        this.mockSecrets.set(prefixedSecretName, secretValue);
        
        this.logger.info(`[Tenant Secrets] Mock storage - secret stored: ${prefixedSecretName}`);
        
        // Mock result for development
        const mockResult = {
          properties: {
            version: 'dev-' + Date.now().toString()
          }
        };
        
        // Store metadata in database
        await this.storeTenantSecretMetadata(tenantId, secretName, {
          type: options.type || 'custom',
          description: options.description,
          keyVaultReference: {
            keyVaultName: `mock-${tenantId}`,
            secretName: prefixedSecretName,
            version: mockResult.properties.version
          }
        });
        
        return this.generateSecretReference(tenantId, secretName);
      } else {
        // Production: Use Azure Key Vault (not implemented in this build)
        throw new Error('Azure Key Vault not available - use development mode');
      }

    } catch (error) {
      this.logger.error('Failed to set tenant secret', {
        tenantId,
        secretName,
        error: error.message
      });
      throw new Error(`Failed to store secret: ${error.message}`);
    }
  }

  /**
   * Retrieve a secret value for a tenant
   */
  async getTenantSecret(tenantId: string, secretName: string): Promise<string> {
    try {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const prefixedSecretName = `${tenantId}-${secretName}`;
      
      if (isDevelopment) {
        // Development: Get from memory map
        const secretValue = this.mockSecrets.get(prefixedSecretName);
        
        if (!secretValue) {
          throw new Error(`Secret not found: ${secretName}`);
        }
        
        this.logger.debug('Mock secret retrieved', {
          tenantId,
          secretName
        });
        
        return secretValue;
      } else {
        // Production: Use Azure Key Vault (not implemented in this build)
        throw new Error('Azure Key Vault not available - use development mode');
      }

    } catch (error) {
      this.logger.error('Failed to get tenant secret', {
        tenantId,
        secretName,
        error: error.message
      });
      throw new Error(`Failed to retrieve secret: ${error.message}`);
    }
  }

  /**
   * List all secrets for a tenant (metadata only)
   */
  async listTenantSecrets(tenantId: string): Promise<TenantSecret[]> {
    try {
      const secrets = await this.db.query<any>(
        `SELECT secret_name, secret_type, description, created_at, updated_at, is_active 
         FROM tenant_secrets 
         WHERE tenant_id = ? AND is_active = true 
         ORDER BY created_at DESC`,
        [tenantId]
      );

      return secrets.map(secret => ({
        name: secret.secret_name,
        type: secret.secret_type,
        description: secret.description,
        createdAt: new Date(secret.created_at),
        updatedAt: new Date(secret.updated_at),
        isActive: secret.is_active
      }));

    } catch (error) {
      this.logger.error('Failed to list tenant secrets', {
        tenantId,
        error: error.message
      });
      throw new Error(`Failed to list secrets: ${error.message}`);
    }
  }

  /**
   * Delete a tenant secret
   */
  async deleteTenantSecret(tenantId: string, secretName: string): Promise<void> {
    try {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const prefixedSecretName = `${tenantId}-${secretName}`;

      if (isDevelopment) {
        // Development: Remove from memory map
        this.mockSecrets.delete(prefixedSecretName);
        
        this.logger.info('Mock secret deleted', {
          tenantId,
          secretName
        });
      } else {
        // Production: Use Azure Key Vault (not implemented in this build)
        throw new Error('Azure Key Vault not available - use development mode');
      }

      // Mark as inactive in database
      await this.db.execute(
        `UPDATE tenant_secrets 
         SET is_active = 0, updated_at = datetime('now') 
         WHERE tenant_id = ? AND secret_name = ?`,
        [tenantId, secretName]
      );

      this.logger.info('Tenant secret deleted', {
        tenantId,
        secretName
      });

    } catch (error) {
      this.logger.error('Failed to delete tenant secret', {
        tenantId,
        secretName,
        error: error.message
      });
      throw new Error(`Failed to delete secret: ${error.message}`);
    }
  }

  /**
   * Test connectivity to tenant's Key Vault
   */
  async testTenantKeyVaultAccess(tenantId: string): Promise<boolean> {
    try {
      const secretClient = this.getSecretClient(tenantId);
      
      // Try to list secrets (just to test access)
      const secretsIterator = secretClient.listPropertiesOfSecrets();
      await secretsIterator.next();
      
      return true;
    } catch (error) {
      this.logger.warn('Key Vault access test failed', {
        tenantId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Store secret metadata in database
   */
  private async storeTenantSecretMetadata(
    tenantId: string,
    secretName: string,
    metadata: {
      type: TenantSecret['type'];
      description?: string;
      keyVaultReference: SecretReference;
    }
  ): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO tenant_secrets 
       (tenant_id, secret_name, secret_type, description, key_vault_reference, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        tenantId,
        secretName,
        metadata.type,
        metadata.description || '',
        JSON.stringify(metadata.keyVaultReference)
      ]
    );
  }

  /**
   * Extract Key Vault name from tenant ID
   */
  private extractKeyVaultName(tenantId: string): string {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return 'grc-platform-dev';
    }
    
    return `${tenantId}-keyvault`;
  }

  /**
   * Generate a secure secret reference for storing in configurations
   */
  generateSecretReference(tenantId: string, secretName: string): string {
    const keyVaultName = this.extractKeyVaultName(tenantId);
    const prefixedSecretName = process.env.NODE_ENV === 'development' 
      ? `${tenantId}-${secretName}` 
      : secretName;
    
    return `@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=${prefixedSecretName})`;
  }
}

export const tenantSecretService = TenantSecretService.getInstance();