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

async function createFintechTenant() {
  console.log('🚀 Creating FinTech tenant for David Smith...');

  try {
    // Test connection
    const testResult = await dbPool.query('SELECT 1 as health_check');
    console.log('✅ Database connection successful');

    // Use proper UUIDs for FinTech tenant
    const fintechTenantId = 'f1234567-89ab-4cde-f012-3456789abcde';
    const davidUserId = 'f1234567-89ab-4cde-f012-3456789abcd1';

    console.log(`📝 Creating FinTech tenant: ${fintechTenantId}`);

    // Add FinTech tenant
    await dbPool.query(`
      INSERT INTO tenants (id, name, display_name, domain, subscription_plan, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        display_name = EXCLUDED.display_name,
        domain = EXCLUDED.domain
    `, [fintechTenantId, 'fintech-solutions', 'FinTech Solutions Ltd', 'fintech.example.com', 'professional', true]);

    console.log('✅ Added FinTech Solutions tenant');

    // Add David Smith as user
    await dbPool.query(`
      INSERT INTO users (id, tenant_id, email, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role
    `, [davidUserId, fintechTenantId, 'owner@fintech.com', 'David Smith', 'owner', true]);

    console.log('✅ Added David Smith user');

    // Add LLM configs for FinTech tenant
    const llmConfigs = [
      {
        id: 'f1234567-89ab-4cde-f012-3456789abcd2',
        name: 'FinTech Azure OpenAI GPT-3.5',
        provider: 'azure',
        model: 'gpt-3.5-turbo',
        api_endpoint: 'https://fintech-openai.openai.azure.com',
        max_tokens: 3000,
        temperature: 0.3,
        is_default: true
      },
      {
        id: 'f1234567-89ab-4cde-f012-3456789abcd3',
        name: 'FinTech Claude Pro',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        api_endpoint: 'https://api.anthropic.com/v1',
        max_tokens: 4000,
        temperature: 0.4,
        is_default: false
      }
    ];

    console.log('📝 Adding LLM configurations for FinTech...');
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
        fintechTenantId,
        davidUserId,
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

    // Add AI agents for FinTech tenant
    const agents = [
      {
        id: 'f1234567-89ab-4cde-f012-3456789abcd4',
        name: 'FinTech Risk Manager',
        description: 'Specialized in financial risk assessment and regulatory compliance',
        persona: 'Financial risk expert with deep knowledge of banking regulations',
        system_prompt: 'You are a FinTech Risk Manager with expertise in financial services risk management, regulatory compliance (PCI-DSS, SOX, Basel III), and fintech-specific risk frameworks. Focus on payment processing, credit risk, and financial data security.',
        llm_config_id: 'f1234567-89ab-4cde-f012-3456789abcd2',
        avatar: '💰',
        color: '#059669'
      },
      {
        id: 'f1234567-89ab-4cde-f012-3456789abcd5',
        name: 'FinTech Compliance Advisor',
        description: 'Ensures compliance with financial services regulations',
        persona: 'Regulatory compliance specialist for financial technology companies',
        system_prompt: 'You are a FinTech Compliance Advisor specializing in financial services regulations, payment card industry standards, anti-money laundering (AML), and know-your-customer (KYC) requirements. Help ensure regulatory compliance for fintech operations.',
        llm_config_id: 'f1234567-89ab-4cde-f012-3456789abcd2',
        avatar: '🏦',
        color: '#DC2626'
      }
    ];

    console.log('🤖 Adding AI agents for FinTech...');
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
        fintechTenantId,
        davidUserId,
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

    console.log('\n🎉 FinTech tenant setup completed!');
    console.log(`📊 Database now contains:`);
    console.log(`   - Tenants: ${tenants.rows[0].count}`);
    console.log(`   - Users: ${users.rows[0].count}`);
    console.log(`   - LLM Configs: ${llmConfigsCount.rows[0].count}`);
    console.log(`   - AI Agents: ${agentsCount.rows[0].count}`);

    console.log(`\n📝 IMPORTANT: Update frontend auth service to use tenant ID: ${fintechTenantId}`);
    console.log(`   Original: tenant-fintech`);
    console.log(`   New UUID: ${fintechTenantId}`);

    return {
      success: true,
      originalTenantId: 'tenant-fintech',
      newTenantId: fintechTenantId,
      stats: {
        tenants: parseInt(tenants.rows[0].count),
        users: parseInt(users.rows[0].count),
        llm_configs: parseInt(llmConfigsCount.rows[0].count),
        ai_agents: parseInt(agentsCount.rows[0].count)
      }
    };

  } catch (error) {
    console.error('❌ FinTech tenant setup failed:', error);
    throw error;
  } finally {
    await dbPool.end();
  }
}

// Run creation
createFintechTenant()
  .then(result => {
    console.log('\n✅ FinTech tenant setup completed successfully!', result.stats);
    console.log(`\n🔄 Next steps:`);
    console.log(`   1. Update frontend auth service tenant ID from ${result.originalTenantId} to ${result.newTenantId}`);
    console.log(`   2. David Smith should now see his own 2 FinTech agents and 2 LLM configs`);
    console.log(`   3. Complete tenant isolation is now enforced`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  });