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

async function populateSarahChenTenant() {
  console.log('🚀 Adding Sarah Chen tenant data...');

  try {
    // Test connection
    const testResult = await dbPool.query('SELECT 1 as health_check');
    console.log('✅ Database connection successful');

    // Convert the invalid UUID to a proper UUID format
    const originalTenantId = 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';
    const properTenantId = 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'.replace(/-/g, '').toLowerCase();
    const formattedTenantId = `${properTenantId.slice(0,8)}-${properTenantId.slice(8,12)}-${properTenantId.slice(12,16)}-${properTenantId.slice(16,20)}-${properTenantId.slice(20,32)}`;

    // Use proper UUIDs for Sarah Chen's tenant (hex characters only)
    const sarahTenantId = 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d';
    const sarahUserId = 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c01';

    console.log(`📝 Converting tenant ID from ${originalTenantId} to ${sarahTenantId}`);

    // Add Sarah Chen's tenant
    await dbPool.query(`
      INSERT INTO tenants (id, name, display_name, domain, subscription_plan, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        display_name = EXCLUDED.display_name,
        domain = EXCLUDED.domain
    `, [sarahTenantId, 'acme-corp', 'ACME Corporation', 'acme.example.com', 'enterprise', true]);

    console.log('✅ Added ACME Corporation tenant');

    // Add Sarah Chen as user
    await dbPool.query(`
      INSERT INTO users (id, tenant_id, email, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role
    `, [sarahUserId, sarahTenantId, 'user1@acme.com', 'Sarah Chen', 'owner', true]);

    console.log('✅ Added Sarah Chen user');

    // Add LLM configs for Sarah's tenant
    const llmConfigs = [
      {
        id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5001',
        name: 'ACME Azure OpenAI GPT-4',
        provider: 'azure',
        model: 'gpt-4',
        api_endpoint: 'https://acme-openai.openai.azure.com',
        max_tokens: 4000,
        temperature: 0.7,
        is_default: true
      },
      {
        id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5002',
        name: 'ACME OpenAI GPT-3.5 Turbo',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        api_endpoint: 'https://api.openai.com/v1',
        max_tokens: 3000,
        temperature: 0.5,
        is_default: false
      }
    ];

    console.log('📝 Adding LLM configurations for ACME...');
    for (const config of llmConfigs) {
      await dbPool.query(`
        INSERT INTO llm_configs (id, tenant_id, created_by, name, provider, model,
                                api_endpoint, max_tokens, temperature, is_default, is_enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (tenant_id, name) DO UPDATE SET
          provider = EXCLUDED.provider,
          model = EXCLUDED.model,
          api_endpoint = EXCLUDED.api_endpoint,
          max_tokens = EXCLUDED.max_tokens,
          temperature = EXCLUDED.temperature,
          is_default = EXCLUDED.is_default
      `, [
        config.id,
        sarahTenantId,
        sarahUserId,
        config.name,
        config.provider,
        config.model,
        config.api_endpoint,
        config.max_tokens,
        config.temperature,
        config.is_default,
        true
      ]);
      console.log(`✅ Added LLM config: ${config.name}`);
    }

    // Add AI agents for Sarah's tenant
    const agents = [
      {
        id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5101',
        name: 'ACME Risk Analyst',
        description: 'Specialized in enterprise risk management for ACME Corporation',
        persona: 'Senior risk management professional with expertise in enterprise risk frameworks',
        system_prompt: 'You are an ACME Risk Analyst with deep expertise in enterprise risk management, regulatory compliance, and business continuity planning. Focus on ACME Corporation\'s specific industry and risk profile.',
        llm_config_id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5001',
        avatar: '🏢',
        color: '#1E40AF'
      },
      {
        id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5102',
        name: 'ACME Compliance Manager',
        description: 'Ensures ACME Corporation adheres to all regulatory requirements',
        persona: 'Experienced compliance professional specializing in enterprise regulations',
        system_prompt: 'You are the ACME Compliance Manager responsible for ensuring adherence to all regulatory requirements including SOX, PCI-DSS, and industry-specific regulations. Provide guidance on compliance frameworks and audit procedures.',
        llm_config_id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5001',
        avatar: '📋',
        color: '#DC2626'
      },
      {
        id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5103',
        name: 'ACME Data Privacy Officer',
        description: 'Specializes in data protection and privacy compliance for ACME',
        persona: 'Data privacy expert with focus on enterprise data governance',
        system_prompt: 'You are ACME\'s Data Privacy Officer specializing in data protection regulations, privacy impact assessments, and data governance frameworks. Help ACME maintain privacy compliance across all business operations.',
        llm_config_id: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5002',
        avatar: '🔒',
        color: '#059669'
      }
    ];

    console.log('🤖 Adding AI agents for ACME...');
    for (const agent of agents) {
      await dbPool.query(`
        INSERT INTO ai_agents (id, tenant_id, created_by, name, description, persona,
                              system_prompt, llm_config_id, avatar, color, is_enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (tenant_id, name) DO UPDATE SET
          description = EXCLUDED.description,
          persona = EXCLUDED.persona,
          system_prompt = EXCLUDED.system_prompt,
          llm_config_id = EXCLUDED.llm_config_id,
          avatar = EXCLUDED.avatar,
          color = EXCLUDED.color
      `, [
        agent.id,
        sarahTenantId,
        sarahUserId,
        agent.name,
        agent.description,
        agent.persona,
        agent.system_prompt,
        agent.llm_config_id,
        agent.avatar,
        agent.color,
        true
      ]);
      console.log(`✅ Added AI agent: ${agent.name}`);
    }

    // Verify the data
    const tenants = await dbPool.query('SELECT COUNT(*) as count FROM tenants');
    const users = await dbPool.query('SELECT COUNT(*) as count FROM users');
    const llmConfigsCount = await dbPool.query('SELECT COUNT(*) as count FROM llm_configs');
    const agentsCount = await dbPool.query('SELECT COUNT(*) as count FROM ai_agents');

    console.log('\n🎉 Sarah Chen tenant setup completed!');
    console.log(`📊 Database now contains:`);
    console.log(`   - Tenants: ${tenants.rows[0].count}`);
    console.log(`   - Users: ${users.rows[0].count}`);
    console.log(`   - LLM Configs: ${llmConfigsCount.rows[0].count}`);
    console.log(`   - AI Agents: ${agentsCount.rows[0].count}`);

    console.log(`\n📝 IMPORTANT: Update frontend to use tenant ID: ${sarahTenantId}`);
    console.log(`   Original: A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6`);
    console.log(`   New UUID: ${sarahTenantId}`);

    return {
      success: true,
      originalTenantId: originalTenantId,
      newTenantId: sarahTenantId,
      stats: {
        tenants: parseInt(tenants.rows[0].count),
        users: parseInt(users.rows[0].count),
        llm_configs: parseInt(llmConfigsCount.rows[0].count),
        ai_agents: parseInt(agentsCount.rows[0].count)
      }
    };

  } catch (error) {
    console.error('❌ Sarah Chen tenant setup failed:', error);
    throw error;
  } finally {
    await dbPool.end();
  }
}

// Run population
populateSarahChenTenant()
  .then(result => {
    console.log('\n✅ Sarah Chen tenant setup completed successfully!', result.stats);
    console.log(`\n🔄 Next steps:`);
    console.log(`   1. Update frontend tenant ID from ${result.originalTenantId} to ${result.newTenantId}`);
    console.log(`   2. Frontend should now show 3 agents for Sarah Chen`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  });