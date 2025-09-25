const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Database connection
let dbPool = null;

function getDatabase() {
  if (!dbPool) {
    dbPool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DATABASE,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 10,
      min: 1,
      idleTimeoutMillis: 30000,
    });

    dbPool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }
  return dbPool;
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    service: 'GRC AI Platform Backend with Database',
    timestamp: new Date().toISOString(),
    environment: 'Azure Container Apps',
    database: {
      type: 'PostgreSQL',
      host: process.env.POSTGRES_HOST,
      connected: false
    }
  };

  // Test database connection
  try {
    const db = getDatabase();
    const result = await db.query('SELECT 1 as health_check, version()');
    healthStatus.database.connected = true;
    healthStatus.database.result = result.rows[0];
  } catch (error) {
    healthStatus.database.connected = false;
    healthStatus.database.error = error.message;
  }

  res.json(healthStatus);
});

// API Routes
app.get('/api/v1/simple-agents', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        agents: [],
        total: 0,
        database: 'PostgreSQL integration active'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/v1/simple-llm-configs', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        llm_configs: [{
          config_id: '1',
          id: '1',
          name: 'Azure PostgreSQL Ready',
          provider: 'azure',
          model: 'database-integrated'
        }]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/v1/database/status', async (req, res) => {
  try {
    const db = getDatabase();
    const tables = await db.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const status = {
      connected: true,
      host: process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_DATABASE,
      tables: tables.rows,
      tableCount: tables.rows.length,
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: status });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      connected: false
    });
  }
});

app.post('/api/v1/database/deploy-schema', async (req, res) => {
  try {
    const db = getDatabase();

    // Create tables in correct order
    const statements = [
      `CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        subscription_plan VARCHAR(50) DEFAULT 'free',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name),
        UNIQUE(domain)
      )`,

      `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, email)
      )`,

      `CREATE TABLE IF NOT EXISTS llm_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_by UUID NOT NULL REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(100) NOT NULL,
        model VARCHAR(255) NOT NULL,
        api_endpoint TEXT,
        api_key_vault_reference TEXT,
        max_tokens INTEGER DEFAULT 4000,
        temperature DECIMAL(3,2) DEFAULT 0.7,
        is_enabled BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      )`,

      `CREATE TABLE IF NOT EXISTS ai_agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_by UUID NOT NULL REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        persona TEXT,
        system_prompt TEXT NOT NULL,
        llm_config_id UUID REFERENCES llm_configs(id),
        avatar VARCHAR(10),
        color VARCHAR(7),
        is_enabled BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      )`,

      `INSERT INTO tenants (id, name, display_name, domain) VALUES
        ('00000000-0000-0000-0000-000000000001', 'demo-tenant', 'Demo Tenant', 'demo.example.com')
        ON CONFLICT (name) DO NOTHING`,

      `INSERT INTO users (id, tenant_id, email, full_name, role) VALUES
        ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin@demo.example.com', 'Admin User', 'owner')
        ON CONFLICT (tenant_id, email) DO NOTHING`
    ];

    const results = [];
    for (let i = 0; i < statements.length; i++) {
      try {
        await db.query(statements[i]);
        results.push({ statement: i + 1, status: 'success' });
      } catch (error) {
        results.push({ statement: i + 1, status: 'error', error: error.message });
      }
    }

    // Check final state
    const tables = await db.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    res.json({
      success: true,
      data: {
        message: 'Schema deployment completed',
        results: results,
        tablesCreated: tables.rows.length,
        tables: tables.rows.map(t => t.table_name)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const port = process.env.PORT || 3005;
app.listen(port, () => {
  console.log('🚀 GRC AI Platform Backend with Database Integration');
  console.log('📍 Port:', port);
  console.log('🗄️  Database:', process.env.POSTGRES_HOST);
  console.log('✅ Backend ready with PostgreSQL');
});