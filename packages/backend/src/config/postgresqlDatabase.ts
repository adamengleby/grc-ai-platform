/**
 * PostgreSQL Database Configuration for Azure
 * Supports both Azure Database for PostgreSQL and local development
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import winston from 'winston';

export interface PostgreSQLDatabase {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  beginTransaction(): Promise<PostgreSQLTransaction>;
  close(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export interface PostgreSQLTransaction {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

class PostgreSQLTransactionImpl implements PostgreSQLTransaction {
  constructor(
    private client: PoolClient,
    private logger: winston.Logger
  ) {}

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      this.logger.debug('Executing transaction query', { sql, paramsCount: params.length });
      const result = await this.client.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      this.logger.error('Transaction query failed', { sql, error: error.message });
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    try {
      this.logger.debug('Executing transaction statement', { sql, paramsCount: params.length });
      await this.client.query(sql, params);
    } catch (error) {
      this.logger.error('Transaction statement failed', { sql, error: error.message });
      throw error;
    }
  }

  async commit(): Promise<void> {
    try {
      await this.client.query('COMMIT');
      this.client.release();
      this.logger.debug('Transaction committed successfully');
    } catch (error) {
      this.logger.error('Transaction commit failed', { error: error.message });
      throw error;
    }
  }

  async rollback(): Promise<void> {
    try {
      await this.client.query('ROLLBACK');
      this.client.release();
      this.logger.debug('Transaction rolled back successfully');
    } catch (error) {
      this.logger.error('Transaction rollback failed', { error: error.message });
      throw error;
    }
  }
}

class PostgreSQLDatabaseImpl implements PostgreSQLDatabase {
  private pool: Pool;
  private logger: winston.Logger;

  constructor(config: PoolConfig, logger: winston.Logger) {
    this.logger = logger;
    this.pool = new Pool({
      ...config,
      // Connection pool settings optimized for Azure
      max: 20, // Maximum number of clients in the pool
      min: 2,  // Minimum number of clients in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
      connectionTimeoutMillis: 5000, // How long to wait when connecting a new client
      maxUses: 7500, // Close (and replace) a connection after it has been used this many times
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
    });

    this.logger.info('PostgreSQL connection pool initialized', {
      host: config.host,
      database: config.database,
      user: config.user,
      maxConnections: 20
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      this.logger.debug('Executing PostgreSQL query', { sql, paramsCount: params.length });
      const result = await client.query(sql, params);
      this.logger.debug('Query executed successfully', { rowCount: result.rowCount });
      return result.rows as T[];
    } catch (error) {
      this.logger.error('PostgreSQL query failed', { sql, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const client = await this.pool.connect();
    try {
      this.logger.debug('Executing PostgreSQL statement', { sql, paramsCount: params.length });
      await client.query(sql, params);
      this.logger.debug('Statement executed successfully');
    } catch (error) {
      this.logger.error('PostgreSQL statement failed', { sql, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async beginTransaction(): Promise<PostgreSQLTransaction> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      this.logger.debug('Transaction started');
      return new PostgreSQLTransactionImpl(client, this.logger);
    } catch (error) {
      client.release();
      this.logger.error('Failed to start transaction', { error: error.message });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1 as health_check');
      return true;
    } catch (error) {
      this.logger.error('PostgreSQL health check failed', { error: error.message });
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.info('PostgreSQL connection pool closed');
    } catch (error) {
      this.logger.error('Error closing PostgreSQL connection pool', { error: error.message });
    }
  }
}

export function getPostgreSQLDatabase(logger: winston.Logger): PostgreSQLDatabase {
  const config: PoolConfig = {
    // Azure Database for PostgreSQL configuration
    host: process.env.POSTGRES_HOST || 'grc-postgres-syd.postgres.database.azure.com',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE || 'grc_platform',
    user: process.env.POSTGRES_USER || 'grcadmin',
    password: process.env.POSTGRES_PASSWORD || 'GrcP@ssw0rd2024!',

    // Azure-specific SSL configuration
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false, // Azure Database for PostgreSQL uses SSL
      ca: undefined, // Azure manages SSL certificates
    } : false, // No SSL for local development

    // Application name for connection tracking
    application_name: 'grc-ai-platform',
  };

  // Validate required configuration
  if (!config.host || !config.user || !config.password) {
    throw new Error('PostgreSQL configuration is incomplete. Please check environment variables.');
  }

  logger.info('Connecting to PostgreSQL database', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: !!config.ssl
  });

  return new PostgreSQLDatabaseImpl(config, logger);
}

// Connection string builder for Azure Container Apps
export function buildPostgreSQLConnectionString(): string {
  const host = process.env.POSTGRES_HOST || 'grc-postgres-syd.postgres.database.azure.com';
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DATABASE || 'grc_platform';
  const user = process.env.POSTGRES_USER || 'grcadmin';
  const password = process.env.POSTGRES_PASSWORD || 'GrcP@ssw0rd2024!';
  const sslMode = process.env.NODE_ENV === 'production' ? 'require' : 'disable';

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=${sslMode}&application_name=grc-ai-platform`;
}

// Export types for external use
export type { PoolConfig };