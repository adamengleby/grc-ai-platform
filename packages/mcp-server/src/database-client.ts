/**
 * Database Client for MCP Server
 * Handles database queries for session and authentication data
 */

import { Database } from 'sqlite3';

export interface ArcherSession {
  session_id: string;
  tenant_id: string;
  user_id: string;
  username: string;
  session_token: string;
  instance_id: string;
  base_url: string;
  user_domain_id?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export class DatabaseClient {
  private db: Database | null = null;
  
  constructor(private dbPath: string = '../backend/data/grc-platform.db') {}
  
  private async connect(): Promise<Database> {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      this.db = new Database(this.dbPath, (err: any) => {
        if (err) {
          console.error('[MCP Database] Failed to connect to SQLite:', err);
          reject(err);
        } else {
          console.log('[MCP Database] Connected to SQLite database');
          resolve(this.db!);
        }
      });
    });
  }
  
  /**
   * Get valid Archer session by session ID
   */
  async getValidArcherSession(sessionId: string): Promise<ArcherSession | null> {
    try {
      const db = await this.connect();
      
      const row = await new Promise<any>((resolve, reject) => {
        db.get(`
          SELECT * FROM archer_sessions 
          WHERE session_id = ? AND expires_at > datetime('now')
        `, [sessionId], (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!row) {
        console.log(`[MCP Database] No valid session found for: ${sessionId}`);
        return null;
      }
      
      console.log(`[MCP Database] Found valid session for ${row.username}@${row.instance_id}`);
      return {
        session_id: row.session_id,
        tenant_id: row.tenant_id,
        user_id: row.user_id,
        username: row.username,
        session_token: row.session_token,
        instance_id: row.instance_id,
        base_url: row.base_url,
        user_domain_id: row.user_domain_id,
        expires_at: row.expires_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
      
    } catch (error: any) {
      console.error(`[MCP Database] Error retrieving session: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve) => {
        this.db!.close(() => {
          console.log('[MCP Database] Database connection closed');
          this.db = null;
          resolve();
        });
      });
    }
  }
}

// Export singleton instance
export const databaseClient = new DatabaseClient();