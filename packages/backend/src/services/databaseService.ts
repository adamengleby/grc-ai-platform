/**
 * Database Service
 * Wrapper around database for simplified operations
 * Uses SQLite for development, PostgreSQL for production
 */

import winston from 'winston';
import { PostgreSQLDatabase, getPostgreSQLDatabase } from '../config/postgresqlDatabase';
// import { SQLiteDatabase, getSQLiteDatabase } from '../config/sqliteDatabase';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: PostgreSQLDatabase;
  private logger: winston.Logger;
  private isProduction: boolean;

  private constructor() {
    // Initialize logger
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

    // Determine if we're in production (Azure) or development
    this.isProduction = process.env.NODE_ENV === 'production' ||
                      process.env.POSTGRES_HOST !== undefined ||
                      process.env.AZURE_POSTGRES_CONNECTION_STRING !== undefined;

    this.logger.info('Initializing database service', {
      environment: this.isProduction ? 'production' : 'development',
      databaseType: this.isProduction ? 'PostgreSQL' : 'PostgreSQL (local mode)'
    });

    // Use PostgreSQL for all environments now
    this.db = getPostgreSQLDatabase(this.logger);
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Execute a SQL query
   */
  async query<T = any>(
    sql: string, 
    params: any[] = [], 
    tenantId?: string // For compatibility, but not used in SQLite version
  ): Promise<T[]> {
    return this.db.query<T>(sql, params);
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   */
  async execute(
    sql: string, 
    params: any[] = [], 
    tenantId?: string // For compatibility, but not used in SQLite version
  ): Promise<void> {
    this.db.execute(sql, params);
  }

  /**
   * Execute a stored procedure (not supported in SQLite)
   */
  async executeStoredProcedure<T = any>(
    procedureName: string,
    params: Record<string, any> = {},
    tenantId?: string
  ): Promise<T[]> {
    throw new Error('Stored procedures not supported in SQLite');
  }

  /**
   * Begin a transaction (simplified interface)
   */
  async transaction<T>(
    tenantId: string,
    callback: (query: (sql: string, params?: any[]) => Promise<any>) => Promise<T>
  ): Promise<T> {
    const transaction = await this.db.beginTransaction();

    const query = async (sql: string, params: any[] = []) => {
      return transaction.query(sql, params);
    };

    try {
      const result = await callback(query);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    try {
      const isHealthy = await this.db.healthCheck();
      return { postgresql: isHealthy };
    } catch (error) {
      return { postgresql: false };
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): Record<string, any> {
    return {
      database: 'PostgreSQL',
      environment: this.isProduction ? 'production' : 'development',
      host: process.env.POSTGRES_HOST || 'local',
      ssl: this.isProduction
    };
  }

  /**
   * Close database connection (for graceful shutdown)
   */
  async close(): Promise<void> {
    this.db.close();
  }
}