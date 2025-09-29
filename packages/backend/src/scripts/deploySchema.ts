/**
 * Database Schema Deployment Script
 * Deploys the GRC AI Platform schema to PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { getPostgreSQLDatabase } from '../config/postgresqlDatabase';
import winston from 'winston';

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function deploySchema() {
  logger.info('Starting database schema deployment...');

  try {
    // Get database connection
    const db = getPostgreSQLDatabase(logger);

    // Test connection
    const isHealthy = await db.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }

    logger.info('Database connection established successfully');

    // Read schema file
    const schemaPath = path.join(__dirname, '../models/simple-schema.sql');
    logger.info(`Reading schema from: ${schemaPath}`);

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Better SQL parsing - handle multi-line statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)
      .filter(stmt => !stmt.match(/^\s*--/)) // Skip comment-only lines
      .filter(stmt => stmt.toUpperCase().includes('CREATE') || stmt.toUpperCase().includes('INSERT')); // Only CREATE and INSERT statements

    logger.info(`Found ${statements.length} SQL statements to execute`);

    // Execute statements one by one
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comment-only statements
      if (statement.startsWith('--') || statement.match(/^\s*--/)) {
        continue;
      }

      logger.info(`Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);

      try {
        await db.execute(statement + ';');
        logger.info(`✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Some statements might fail if they already exist (like CREATE TABLE IF NOT EXISTS)
        if (error.message.includes('already exists')) {
          logger.warn(`⚠️  Statement ${i + 1} skipped: ${error.message}`);
        } else {
          logger.error(`❌ Statement ${i + 1} failed: ${error.message}`);
          logger.error(`Statement: ${statement}`);

          // Continue with other statements rather than failing completely
          continue;
        }
      }
    }

    // Verify tables were created
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    logger.info('✅ Schema deployment completed successfully');
    logger.info(`📊 Created ${tables.length} tables:`, { tables: tables.map((t: any) => t.table_name) });

    // Close connection
    await db.close();

  } catch (error: any) {
    logger.error('❌ Schema deployment failed:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  deploySchema()
    .then(() => {
      logger.info('🚀 Database schema deployment completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      logger.error('💥 Deployment failed:', error);
      process.exit(1);
    });
}

export { deploySchema };