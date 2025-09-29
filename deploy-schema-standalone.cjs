const { Pool } = require('pg');

// Database connection using the same parameters that work in Container App
const dbPool = new Pool({
  host: 'grc-postgres-syd.postgres.database.azure.com',
  port: 5432,
  database: 'grc_platform',
  user: 'grcadmin',
  password: 'GrcAzure2024!',
  ssl: { rejectUnauthorized: false },
  max: 10,
  min: 1,
  idleTimeoutMillis: 30000,
});

async function deploySchema() {
  console.log('🚀 Starting database schema deployment...');

  try {
    // Test connection
    const testResult = await dbPool.query('SELECT 1 as health_check');
    console.log('✅ Database connection successful:', testResult.rows[0]);

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

      // Create indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_llm_configs_tenant_id ON llm_configs(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant_id ON ai_agents(tenant_id)`,

      // Insert default tenant for development
      `INSERT INTO tenants (id, name, display_name, domain) VALUES
        ('00000000-0000-0000-0000-000000000001', 'demo-tenant', 'Demo Tenant', 'demo.example.com')
        ON CONFLICT (name) DO NOTHING`,

      // Insert default admin user
      `INSERT INTO users (id, tenant_id, email, full_name, role) VALUES
        ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin@demo.example.com', 'Admin User', 'owner')
        ON CONFLICT (tenant_id, email) DO NOTHING`
    ];

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    const results = [];
    for (let i = 0; i < statements.length; i++) {
      try {
        await dbPool.query(statements[i]);
        console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        results.push({ statement: i + 1, status: 'success' });
      } catch (error) {
        console.log(`⚠️  Statement ${i + 1}/${statements.length} failed: ${error.message}`);
        results.push({ statement: i + 1, status: 'error', error: error.message });
      }
    }

    // Verify tables were created
    const tables = await dbPool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n🎉 Schema deployment completed successfully!');
    console.log(`📊 Created ${tables.rows.length} tables:`, tables.rows.map(t => t.table_name));

    // Test data queries
    const tenants = await dbPool.query('SELECT * FROM tenants');
    const users = await dbPool.query('SELECT * FROM users');

    console.log(`\n📈 Database populated with ${tenants.rows.length} tenant(s) and ${users.rows.length} user(s)`);

    return {
      success: true,
      tablesCreated: tables.rows.length,
      tables: tables.rows.map(t => t.table_name),
      data: {
        tenants: tenants.rows.length,
        users: users.rows.length
      }
    };

  } catch (error) {
    console.error('❌ Schema deployment failed:', error);
    throw error;
  } finally {
    await dbPool.end();
  }
}

// Run deployment
deploySchema()
  .then(result => {
    console.log('\n✅ Deployment completed successfully!', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Deployment failed:', error.message);
    process.exit(1);
  });