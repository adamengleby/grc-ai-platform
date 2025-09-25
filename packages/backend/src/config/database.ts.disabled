import { ConnectionPool, config as SQLConfig, Request } from 'mssql';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import winston from 'winston';
import * as cron from 'node-cron';

// Database configuration interface
export interface DatabaseConfig {
  server: string;
  database: string;
  authentication: {
    type: 'azure-active-directory-msi-app-service' | 'sql-password' | 'azure-active-directory-default';
    options?: {
      userName?: string;
      password?: string;
      clientId?: string;
    };
  };
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    connectionTimeout: number;
    requestTimeout: number;
    enableArithAbort: boolean;
  };
  pool: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };
}

// Multi-tenant database manager
export class MultiTenantDatabaseManager {
  private pools: Map<string, ConnectionPool> = new Map();
  private config: DatabaseConfig;
  private keyVaultClient?: SecretClient;
  private logger: winston.Logger;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: DatabaseConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    
    // Initialize Azure Key Vault client if needed
    if (process.env.AZURE_KEY_VAULT_URL) {
      const credential = new DefaultAzureCredential();
      this.keyVaultClient = new SecretClient(process.env.AZURE_KEY_VAULT_URL, credential);
    }

    this.setupHealthChecks();
  }

  // Get or create connection pool for a tenant
  async getPool(tenantId?: string): Promise<ConnectionPool> {
    const poolKey = tenantId || 'default';
    
    let pool = this.pools.get(poolKey);
    if (!pool) {
      pool = await this.createPool(tenantId);
      this.pools.set(poolKey, pool);
    }

    // Verify pool is connected
    if (!pool.connected && !pool.connecting) {
      try {
        await pool.connect();
        this.logger.info(`Database pool connected for tenant: ${poolKey}`);
      } catch (error) {
        this.logger.error(`Failed to connect database pool for tenant: ${poolKey}`, error);
        throw error;
      }
    }

    return pool;
  }

  // Create a new connection pool with tenant-specific configuration
  private async createPool(tenantId?: string): Promise<ConnectionPool> {
    const poolConfig = await this.buildPoolConfig(tenantId);
    
    const pool = new ConnectionPool(poolConfig);
    
    // Set up pool event handlers
    pool.on('connect', () => {
      this.logger.info(`Database connected for tenant: ${tenantId || 'default'}`);
    });

    pool.on('close', () => {
      this.logger.info(`Database connection closed for tenant: ${tenantId || 'default'}`);
    });

    pool.on('error', (error) => {
      this.logger.error(`Database error for tenant: ${tenantId || 'default'}`, error);
    });

    return pool;
  }

  // Build pool configuration with tenant-specific settings
  private async buildPoolConfig(tenantId?: string): Promise<SQLConfig> {
    const baseConfig: SQLConfig = {
      server: this.config.server,
      database: this.config.database,
      options: {
        ...this.config.options,
        appName: `grc-platform-${tenantId || 'default'}`,
        abortTransactionOnError: true,
      },
      pool: this.config.pool,
    };

    // Configure authentication
    switch (this.config.authentication.type) {
      case 'azure-active-directory-default':
        baseConfig.authentication = {
          type: 'azure-active-directory-default'
        };
        break;
      
      case 'azure-active-directory-msi-app-service':
        baseConfig.authentication = {
          type: 'azure-active-directory-msi-app-service'
        };
        break;
      
      case 'sql-password':
        if (this.config.authentication.options?.userName && this.config.authentication.options?.password) {
          baseConfig.user = this.config.authentication.options.userName;
          baseConfig.password = await this.resolveSecret(this.config.authentication.options.password, tenantId);
        }
        break;
    }

    return baseConfig;
  }

  // Resolve secrets from Azure Key Vault
  private async resolveSecret(secretName: string, tenantId?: string): Promise<string> {
    if (!this.keyVaultClient) {
      return secretName; // Return as-is if no Key Vault configured
    }

    try {
      // Use tenant-specific secret if available
      const tenantSecretName = tenantId ? `${tenantId}-${secretName}` : secretName;
      
      try {
        const secret = await this.keyVaultClient.getSecret(tenantSecretName);
        return secret.value || secretName;
      } catch {
        // Fall back to global secret
        const secret = await this.keyVaultClient.getSecret(secretName);
        return secret.value || secretName;
      }
    } catch (error) {
      this.logger.error(`Failed to resolve secret: ${secretName}`, error);
      throw new Error(`Failed to resolve database secret: ${secretName}`);
    }
  }

  // Execute query with tenant isolation
  async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    tenantId?: string,
    options: { timeout?: number; transaction?: boolean } = {}
  ): Promise<T[]> {
    const pool = await this.getPool(tenantId);
    const request = new Request(pool);

    // Set request timeout
    if (options.timeout) {
      request.setTimeout(options.timeout);
    }

    // Add parameters
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });

    try {
      const result = await request.query(query);
      
      // Log query for audit purposes
      this.logger.debug('Database query executed', {
        tenantId,
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        rowCount: result.recordset.length,
        duration: Date.now()
      });

      return result.recordset as T[];
    } catch (error) {
      this.logger.error('Database query failed', {
        tenantId,
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        error: error.message
      });
      throw error;
    }
  }

  // Execute stored procedure with tenant isolation
  async executeStoredProcedure<T = any>(
    procedureName: string,
    params: Record<string, any> = {},
    tenantId?: string,
    options: { timeout?: number } = {}
  ): Promise<T[]> {
    const pool = await this.getPool(tenantId);
    const request = new Request(pool);

    // Set request timeout
    if (options.timeout) {
      request.setTimeout(options.timeout);
    }

    // Add parameters
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });

    try {
      const result = await request.execute(procedureName);
      
      this.logger.debug('Stored procedure executed', {
        tenantId,
        procedureName,
        rowCount: result.recordset.length
      });

      return result.recordset as T[];
    } catch (error) {
      this.logger.error('Stored procedure failed', {
        tenantId,
        procedureName,
        error: error.message
      });
      throw error;
    }
  }

  // Health check for all active pools
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};
    
    for (const [poolKey, pool] of this.pools) {
      try {
        if (pool.connected) {
          const request = new Request(pool);
          await request.query('SELECT 1 as health_check');
          results[poolKey] = true;
        } else {
          results[poolKey] = false;
        }
      } catch (error) {
        this.logger.error(`Health check failed for pool: ${poolKey}`, error);
        results[poolKey] = false;
      }
    }

    return results;
  }

  // Setup automated health checks
  private setupHealthChecks(): void {
    // Run health checks every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      try {
        const results = await this.healthCheck();
        const failedPools = Object.entries(results).filter(([, healthy]) => !healthy);
        
        if (failedPools.length > 0) {
          this.logger.warn('Database health check failures', { failedPools });
          
          // Attempt to reconnect failed pools
          for (const [poolKey] of failedPools) {
            try {
              const pool = this.pools.get(poolKey);
              if (pool && !pool.connecting) {
                await pool.close();
                await pool.connect();
                this.logger.info(`Reconnected database pool: ${poolKey}`);
              }
            } catch (error) {
              this.logger.error(`Failed to reconnect pool: ${poolKey}`, error);
            }
          }
        }
      } catch (error) {
        this.logger.error('Health check routine failed', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Graceful shutdown
  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const closePromises = Array.from(this.pools.values()).map(async (pool) => {
      try {
        await pool.close();
      } catch (error) {
        this.logger.error('Error closing database pool', error);
      }
    });

    await Promise.allSettled(closePromises);
    this.pools.clear();
    this.logger.info('Database manager closed');
  }

  // Get pool statistics
  getPoolStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [poolKey, pool] of this.pools) {
      stats[poolKey] = {
        connected: pool.connected,
        connecting: pool.connecting,
        healthy: pool.healthy,
        size: pool.size,
        available: pool.available,
        pending: pool.pending,
        borrowed: pool.borrowed
      };
    }

    return stats;
  }
}

// Default database configuration
export const defaultDatabaseConfig: DatabaseConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'grc_platform',
  authentication: {
    type: process.env.DB_AUTH_TYPE as any || 'azure-active-directory-default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      clientId: process.env.AZURE_CLIENT_ID
    }
  },
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000'),
    enableArithAbort: true
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    min: parseInt(process.env.DB_POOL_MIN || '5'),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '60000'),
    createTimeoutMillis: parseInt(process.env.DB_POOL_CREATE_TIMEOUT || '30000'),
    destroyTimeoutMillis: parseInt(process.env.DB_POOL_DESTROY_TIMEOUT || '5000'),
    reapIntervalMillis: parseInt(process.env.DB_POOL_REAP_INTERVAL || '1000'),
    createRetryIntervalMillis: parseInt(process.env.DB_POOL_CREATE_RETRY_INTERVAL || '200')
  }
};

// Export singleton instance
let databaseManager: MultiTenantDatabaseManager;

export const getDatabaseManager = (logger: winston.Logger): MultiTenantDatabaseManager => {
  if (!databaseManager) {
    databaseManager = new MultiTenantDatabaseManager(defaultDatabaseConfig, logger);
  }
  return databaseManager;
};