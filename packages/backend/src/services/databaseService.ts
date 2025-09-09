/**
 * Database Service
 * Wrapper around database for simplified operations
 * Uses SQLite for development, can be extended for production databases
 */

import winston from 'winston';
import { SQLiteDatabase, getSQLiteDatabase } from '../config/sqliteDatabase';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: SQLiteDatabase;
  private logger: winston.Logger;

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

    this.db = getSQLiteDatabase(this.logger);
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
    const transaction = this.db.beginTransaction();
    
    const query = async (sql: string, params: any[] = []) => {
      return this.db.query(sql, params);
    };

    try {
      const result = await callback(query);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    try {
      this.db.query('SELECT 1 as health_check');
      return { sqlite: true };
    } catch (error) {
      return { sqlite: false };
    }
  }

  /**
   * Get connection pool statistics (not applicable for SQLite)
   */
  getPoolStats(): Record<string, any> {
    return { sqlite: 'file-based database' };
  }

  /**
   * Close database connection (for graceful shutdown)
   */
  async close(): Promise<void> {
    this.db.close();
  }
}