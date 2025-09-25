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

// Schema deployment via GET (for testing)
app.get('/api/v1/database/deploy', async (req, res) => {
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
        message: 'Schema deployment completed via GET',
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

// Tenant Management APIs
app.get('/api/v1/tenants', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(`
      SELECT id, name, display_name, domain, subscription_plan,
             is_active, created_at, updated_at
      FROM tenants
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: {
        tenants: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/v1/tenants/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(`
      SELECT id, name, display_name, domain, subscription_plan,
             is_active, created_at, updated_at
      FROM tenants WHERE id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// AI Agents API - Database-backed
app.get('/api/v1/simple-agents', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(`
      SELECT a.id, a.name, a.description, a.persona, a.system_prompt,
             a.avatar, a.color, a.is_enabled, a.usage_count,
             a.created_at, a.updated_at,
             t.name as tenant_name,
             l.name as llm_config_name, l.provider, l.model
      FROM ai_agents a
      LEFT JOIN tenants t ON a.tenant_id = t.id
      LEFT JOIN llm_configs l ON a.llm_config_id = l.id
      WHERE a.is_enabled = true
      ORDER BY a.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        agents: result.rows,
        total: result.rows.length,
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

app.post('/api/v1/simple-agents', async (req, res) => {
  try {
    const db = getDatabase();
    const {
      tenant_id = '00000000-0000-0000-0000-000000000001', // Default to demo tenant
      created_by = '00000000-0000-0000-0000-000000000002', // Default to admin user
      name,
      description,
      persona,
      system_prompt,
      llm_config_id,
      avatar = '🤖',
      color = '#3B82F6'
    } = req.body;

    if (!name || !system_prompt) {
      return res.status(400).json({
        success: false,
        error: 'Name and system_prompt are required'
      });
    }

    const result = await db.query(`
      INSERT INTO ai_agents (tenant_id, created_by, name, description, persona,
                           system_prompt, llm_config_id, avatar, color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [tenant_id, created_by, name, description, persona, system_prompt,
        llm_config_id, avatar, color]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      res.status(409).json({
        success: false,
        error: 'Agent with this name already exists for this tenant'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// LLM Configuration APIs
app.get('/api/v1/simple-llm-configs', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(`
      SELECT l.id, l.name, l.provider, l.model, l.api_endpoint,
             l.max_tokens, l.temperature, l.is_enabled, l.is_default,
             l.created_at, l.updated_at,
             t.name as tenant_name, t.display_name as tenant_display_name,
             u.full_name as created_by_name
      FROM llm_configs l
      LEFT JOIN tenants t ON l.tenant_id = t.id
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.is_enabled = true
      ORDER BY l.is_default DESC, l.created_at DESC
    `);

    // Map to frontend expected format
    const llm_configs = result.rows.map(row => ({
      config_id: row.id,
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      api_endpoint: row.api_endpoint,
      max_tokens: row.max_tokens,
      temperature: row.temperature,
      is_default: row.is_default,
      tenant_name: row.tenant_name,
      created_by: row.created_by_name
    }));

    res.json({
      success: true,
      data: {
        llm_configs: llm_configs,
        total: llm_configs.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/v1/simple-llm-configs', async (req, res) => {
  try {
    const db = getDatabase();
    const {
      tenant_id = '00000000-0000-0000-0000-000000000001',
      created_by = '00000000-0000-0000-0000-000000000002',
      name,
      provider,
      model,
      api_endpoint,
      api_key_vault_reference,
      max_tokens = 4000,
      temperature = 0.7,
      is_default = false
    } = req.body;

    if (!name || !provider || !model) {
      return res.status(400).json({
        success: false,
        error: 'Name, provider, and model are required'
      });
    }

    // If this is being set as default, unset other defaults for this tenant
    if (is_default) {
      await db.query(`
        UPDATE llm_configs
        SET is_default = false
        WHERE tenant_id = $1
      `, [tenant_id]);
    }

    const result = await db.query(`
      INSERT INTO llm_configs (tenant_id, created_by, name, provider, model,
                              api_endpoint, api_key_vault_reference, max_tokens,
                              temperature, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [tenant_id, created_by, name, provider, model, api_endpoint,
        api_key_vault_reference, max_tokens, temperature, is_default]);

    // Format response to match frontend expectations
    const config = result.rows[0];
    const formattedConfig = {
      config_id: config.id,
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      api_endpoint: config.api_endpoint,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      is_default: config.is_default,
      tenant_id: config.tenant_id,
      created_by: config.created_by,
      created_at: config.created_at,
      updated_at: config.updated_at
    };

    res.status(201).json({
      success: true,
      data: formattedConfig
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      res.status(409).json({
        success: false,
        error: 'LLM configuration with this name already exists for this tenant'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// Users API
app.get('/api/v1/users', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(`
      SELECT u.id, u.email, u.full_name, u.role, u.is_active,
             u.last_login, u.created_at, u.updated_at,
             t.name as tenant_name, t.display_name as tenant_display_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.is_active = true
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        users: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analytics/Dashboard API
app.get('/api/v1/dashboard/stats', async (req, res) => {
  try {
    const db = getDatabase();

    // Get counts from each table
    const [tenantResult, userResult, agentResult, llmResult] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM tenants WHERE is_active = true'),
      db.query('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
      db.query('SELECT COUNT(*) as count FROM ai_agents WHERE is_enabled = true'),
      db.query('SELECT COUNT(*) as count FROM llm_configs WHERE is_enabled = true')
    ]);

    // Get recent activity
    const recentActivity = await db.query(`
      SELECT 'agent' as type, name, created_at, updated_at
      FROM ai_agents
      WHERE created_at > NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT 'llm_config' as type, name, created_at, updated_at
      FROM llm_configs
      WHERE created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        stats: {
          active_tenants: parseInt(tenantResult.rows[0].count),
          active_users: parseInt(userResult.rows[0].count),
          active_agents: parseInt(agentResult.rows[0].count),
          active_llm_configs: parseInt(llmResult.rows[0].count)
        },
        recent_activity: recentActivity.rows,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Agent Update endpoint
app.put('/api/v1/simple-agents/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const {
      name,
      description,
      persona,
      system_prompt,
      llm_config_id,
      avatar,
      color,
      is_enabled
    } = req.body;

    const result = await db.query(`
      UPDATE ai_agents
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          persona = COALESCE($3, persona),
          system_prompt = COALESCE($4, system_prompt),
          llm_config_id = COALESCE($5, llm_config_id),
          avatar = COALESCE($6, avatar),
          color = COALESCE($7, color),
          is_enabled = COALESCE($8, is_enabled),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [name, description, persona, system_prompt, llm_config_id,
        avatar, color, is_enabled, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete agent endpoint
app.delete('/api/v1/simple-agents/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM ai_agents WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      message: 'Agent deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// LLM Configuration Update endpoint
app.put('/api/v1/simple-llm-configs/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const {
      name,
      provider,
      model,
      api_endpoint,
      api_key_vault_reference,
      max_tokens,
      temperature,
      is_default,
      is_enabled
    } = req.body;

    // If this is being set as default, unset other defaults for this tenant
    if (is_default) {
      const currentConfig = await db.query('SELECT tenant_id FROM llm_configs WHERE id = $1', [id]);
      if (currentConfig.rows.length > 0) {
        await db.query(`
          UPDATE llm_configs
          SET is_default = false
          WHERE tenant_id = $1 AND id != $2
        `, [currentConfig.rows[0].tenant_id, id]);
      }
    }

    const result = await db.query(`
      UPDATE llm_configs
      SET name = COALESCE($1, name),
          provider = COALESCE($2, provider),
          model = COALESCE($3, model),
          api_endpoint = COALESCE($4, api_endpoint),
          api_key_vault_reference = COALESCE($5, api_key_vault_reference),
          max_tokens = COALESCE($6, max_tokens),
          temperature = COALESCE($7, temperature),
          is_default = COALESCE($8, is_default),
          is_enabled = COALESCE($9, is_enabled),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [name, provider, model, api_endpoint, api_key_vault_reference,
        max_tokens, temperature, is_default, is_enabled, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'LLM configuration not found'
      });
    }

    // Format response to match frontend expectations
    const config = result.rows[0];
    const formattedConfig = {
      config_id: config.id,
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      api_endpoint: config.api_endpoint,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      is_default: config.is_default,
      tenant_id: config.tenant_id,
      created_by: config.created_by,
      created_at: config.created_at,
      updated_at: config.updated_at
    };

    res.json({
      success: true,
      data: formattedConfig
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// LLM Configuration Delete endpoint
app.delete('/api/v1/simple-llm-configs/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Check if this config is being used by any agents
    const agentsUsingConfig = await db.query(`
      SELECT COUNT(*) as count FROM ai_agents WHERE llm_config_id = $1
    `, [id]);

    if (parseInt(agentsUsingConfig.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete LLM configuration: ${agentsUsingConfig.rows[0].count} agent(s) are using this configuration`
      });
    }

    const result = await db.query(`
      DELETE FROM llm_configs WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'LLM configuration not found'
      });
    }

    res.json({
      success: true,
      message: 'LLM configuration deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Legacy/Direct endpoints for frontend compatibility
app.get('/api/agents', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(`
      SELECT a.id, a.name, a.description, a.persona, a.system_prompt,
             a.avatar, a.color, a.is_enabled, a.usage_count,
             a.created_at, a.updated_at,
             t.name as tenant_name,
             l.name as llm_config_name, l.provider, l.model
      FROM ai_agents a
      LEFT JOIN tenants t ON a.tenant_id = t.id
      LEFT JOIN llm_configs l ON a.llm_config_id = l.id
      WHERE a.is_enabled = true
      ORDER BY a.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        agents: result.rows,
        total: result.rows.length,
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

app.get('/agents', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(`
      SELECT a.id, a.name, a.description, a.persona, a.system_prompt,
             a.avatar, a.color, a.is_enabled, a.usage_count,
             a.created_at, a.updated_at,
             t.name as tenant_name,
             l.name as llm_config_name, l.provider, l.model
      FROM ai_agents a
      LEFT JOIN tenants t ON a.tenant_id = t.id
      LEFT JOIN llm_configs l ON a.llm_config_id = l.id
      WHERE a.is_enabled = true
      ORDER BY a.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        agents: result.rows,
        total: result.rows.length,
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

// More endpoint variations for frontend compatibility
app.get('/api/v1/agents', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(`
      SELECT a.id, a.name, a.description, a.persona, a.system_prompt,
             a.avatar, a.color, a.is_enabled, a.usage_count,
             a.created_at, a.updated_at,
             t.name as tenant_name,
             l.name as llm_config_name, l.provider, l.model
      FROM ai_agents a
      LEFT JOIN tenants t ON a.tenant_id = t.id
      LEFT JOIN llm_configs l ON a.llm_config_id = l.id
      WHERE a.is_enabled = true
      ORDER BY a.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        agents: result.rows,
        total: result.rows.length,
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

// Debug endpoint to help understand frontend calls
app.use('/api/*', (req, res, next) => {
  console.log(`Frontend API call: ${req.method} ${req.originalUrl}`);
  next();
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