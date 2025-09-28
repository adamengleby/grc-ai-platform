import { MultiTenantDatabaseManager } from './database';
import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

export interface Migration {
  id: string;
  description: string;
  up: string;
  down: string;
  tenant_specific: boolean;
  created_at: Date;
}

export class MigrationManager {
  private dbManager: MultiTenantDatabaseManager;
  private logger: winston.Logger;
  private migrationsPath: string;

  constructor(dbManager: MultiTenantDatabaseManager, logger: winston.Logger, migrationsPath?: string) {
    this.dbManager = dbManager;
    this.logger = logger;
    this.migrationsPath = migrationsPath || path.join(__dirname, '../migrations');
  }

  // Initialize migration tracking tables
  async initializeMigrationTables(): Promise<void> {
    const createMigrationsTableSQL = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='schema_migrations' AND xtype='U')
      BEGIN
        CREATE TABLE schema_migrations (
          migration_id NVARCHAR(255) PRIMARY KEY,
          description NVARCHAR(500),
          tenant_id UNIQUEIDENTIFIER NULL,
          applied_at DATETIME2 DEFAULT GETUTCDATE(),
          rollback_sql NVARCHAR(MAX),
          
          INDEX IX_schema_migrations_tenant_id (tenant_id),
          INDEX IX_schema_migrations_applied_at (applied_at DESC)
        );
      END
    `;

    try {
      await this.dbManager.executeQuery(createMigrationsTableSQL);
      this.logger.info('Migration tracking tables initialized');
    } catch (error) {
      this.logger.error('Failed to initialize migration tables', error);
      throw error;
    }
  }

  // Run all pending migrations
  async migrate(tenantId?: string): Promise<void> {
    await this.initializeMigrationTables();
    
    const migrations = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations(tenantId);
    
    const pendingMigrations = migrations.filter(m => 
      !appliedMigrations.includes(m.id) && 
      (!m.tenant_specific || tenantId)
    );

    if (pendingMigrations.length === 0) {
      this.logger.info(`No pending migrations for tenant: ${tenantId || 'global'}`);
      return;
    }

    this.logger.info(`Running ${pendingMigrations.length} migrations for tenant: ${tenantId || 'global'}`);

    for (const migration of pendingMigrations) {
      try {
        await this.runMigration(migration, tenantId);
        this.logger.info(`Migration applied: ${migration.id} - ${migration.description}`);
      } catch (error) {
        this.logger.error(`Migration failed: ${migration.id}`, error);
        throw error;
      }
    }
  }

  // Run a single migration
  private async runMigration(migration: Migration, tenantId?: string): Promise<void> {
    const pool = await this.dbManager.getPool(tenantId);
    const transaction = pool.transaction();
    
    try {
      await transaction.begin();
      
      // Execute migration SQL
      const request = transaction.request();
      await request.query(migration.up);
      
      // Record migration as applied
      const recordRequest = transaction.request();
      recordRequest.input('migrationId', migration.id);
      recordRequest.input('description', migration.description);
      recordRequest.input('tenantId', tenantId || null);
      recordRequest.input('rollbackSql', migration.down);
      
      await recordRequest.query(`
        INSERT INTO schema_migrations (migration_id, description, tenant_id, rollback_sql)
        VALUES (@migrationId, @description, @tenantId, @rollbackSql)
      `);
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Rollback last migration
  async rollback(tenantId?: string): Promise<void> {
    const lastMigration = await this.getLastAppliedMigration(tenantId);
    
    if (!lastMigration) {
      this.logger.info(`No migrations to rollback for tenant: ${tenantId || 'global'}`);
      return;
    }

    const pool = await this.dbManager.getPool(tenantId);
    const transaction = pool.transaction();
    
    try {
      await transaction.begin();
      
      // Execute rollback SQL
      const request = transaction.request();
      await request.query(lastMigration.rollback_sql);
      
      // Remove migration record
      const deleteRequest = transaction.request();
      deleteRequest.input('migrationId', lastMigration.migration_id);
      deleteRequest.input('tenantId', tenantId || null);
      
      const whereClause = tenantId 
        ? 'migration_id = @migrationId AND tenant_id = @tenantId'
        : 'migration_id = @migrationId AND tenant_id IS NULL';
        
      await deleteRequest.query(`
        DELETE FROM schema_migrations 
        WHERE ${whereClause}
      `);
      
      await transaction.commit();
      
      this.logger.info(`Migration rolled back: ${lastMigration.migration_id}`);
    } catch (error) {
      await transaction.rollback();
      this.logger.error(`Failed to rollback migration: ${lastMigration.migration_id}`, error);
      throw error;
    }
  }

  // Get applied migrations for a tenant
  private async getAppliedMigrations(tenantId?: string): Promise<string[]> {
    const whereClause = tenantId 
      ? 'tenant_id = @tenantId OR tenant_id IS NULL'
      : 'tenant_id IS NULL';
    
    const query = `
      SELECT migration_id 
      FROM schema_migrations 
      WHERE ${whereClause}
      ORDER BY applied_at ASC
    `;
    
    const results = await this.dbManager.executeQuery<{ migration_id: string }>(
      query, 
      tenantId ? [tenantId] : [], 
      tenantId
    );
    
    return results.map(r => r.migration_id);
  }

  // Get last applied migration
  private async getLastAppliedMigration(tenantId?: string): Promise<any> {
    const whereClause = tenantId 
      ? 'tenant_id = @tenantId'
      : 'tenant_id IS NULL';
    
    const query = `
      SELECT TOP 1 migration_id, rollback_sql 
      FROM schema_migrations 
      WHERE ${whereClause}
      ORDER BY applied_at DESC
    `;
    
    const results = await this.dbManager.executeQuery(
      query, 
      tenantId ? [tenantId] : [], 
      tenantId
    );
    
    return results[0] || null;
  }

  // Load migration files from disk
  private async getMigrationFiles(): Promise<Migration[]> {
    const migrations: Migration[] = [];
    
    if (!fs.existsSync(this.migrationsPath)) {
      this.logger.warn(`Migrations directory not found: ${this.migrationsPath}`);
      return migrations;
    }

    const files = fs.readdirSync(this.migrationsPath).sort();
    
    for (const file of files) {
      if (file.endsWith('.sql')) {
        const migrationPath = path.join(this.migrationsPath, file);
        const content = fs.readFileSync(migrationPath, 'utf8');
        
        // Parse migration file
        const migration = this.parseMigrationFile(file, content);
        migrations.push(migration);
      }
    }
    
    return migrations;
  }

  // Parse migration file content
  private parseMigrationFile(filename: string, content: string): Migration {
    const lines = content.split('\n');
    const metadata: any = {};
    const upStatements: string[] = [];
    const downStatements: string[] = [];
    
    let currentSection = 'metadata';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('-- @')) {
        const [key, value] = trimmedLine.substring(4).split(':');
        metadata[key.trim()] = value?.trim() || true;
      } else if (trimmedLine === '-- UP') {
        currentSection = 'up';
      } else if (trimmedLine === '-- DOWN') {
        currentSection = 'down';
      } else if (!trimmedLine.startsWith('--') && trimmedLine.length > 0) {
        if (currentSection === 'up') {
          upStatements.push(line);
        } else if (currentSection === 'down') {
          downStatements.push(line);
        }
      }
    }
    
    return {
      id: filename.replace('.sql', ''),
      description: metadata.description || 'No description',
      up: upStatements.join('\n'),
      down: downStatements.join('\n'),
      tenant_specific: metadata.tenant_specific === 'true',
      created_at: new Date()
    };
  }

  // Create new migration file
  async createMigration(name: string, tenantSpecific = false): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
    const filepath = path.join(this.migrationsPath, filename);
    
    const template = `-- @description: ${name}
-- @tenant_specific: ${tenantSpecific}
-- @created_at: ${new Date().toISOString()}

-- UP
-- Add your migration SQL here


-- DOWN  
-- Add your rollback SQL here

`;

    // Ensure migrations directory exists
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
    }
    
    fs.writeFileSync(filepath, template);
    
    this.logger.info(`Created migration file: ${filepath}`);
    return filepath;
  }

  // Get migration status
  async getStatus(tenantId?: string): Promise<{
    applied: string[];
    pending: string[];
    total: number;
  }> {
    const allMigrations = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations(tenantId);
    
    const relevantMigrations = allMigrations.filter(m => 
      !m.tenant_specific || tenantId
    );
    
    const pendingMigrations = relevantMigrations
      .filter(m => !appliedMigrations.includes(m.id))
      .map(m => m.id);
    
    return {
      applied: appliedMigrations,
      pending: pendingMigrations,
      total: relevantMigrations.length
    };
  }

  // Migrate all tenants (for global migrations)
  async migrateAllTenants(): Promise<void> {
    // First run global migrations
    await this.migrate();
    
    // Get all active tenants
    const tenants = await this.dbManager.executeQuery<{ tenant_id: string }>(
      "SELECT tenant_id FROM tenants WHERE status = 'active' AND deleted_at IS NULL"
    );
    
    // Run tenant-specific migrations for each tenant
    for (const tenant of tenants) {
      try {
        await this.migrate(tenant.tenant_id);
        this.logger.info(`Migrations completed for tenant: ${tenant.tenant_id}`);
      } catch (error) {
        this.logger.error(`Migration failed for tenant: ${tenant.tenant_id}`, error);
        throw error;
      }
    }
  }
}

export default MigrationManager;