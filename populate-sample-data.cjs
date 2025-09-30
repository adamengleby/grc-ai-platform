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

async function populateSampleData() {
  console.log('🚀 Adding sample data to the database...');

  try {
    // Test connection
    const testResult = await dbPool.query('SELECT 1 as health_check');
    console.log('✅ Database connection successful');

    // Add sample LLM configurations
    const llmConfigs = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Azure OpenAI GPT-4',
        provider: 'azure',
        model: 'gpt-4',
        api_endpoint: 'https://your-azure-openai.openai.azure.com',
        max_tokens: 4000,
        temperature: 0.7,
        is_default: true
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'OpenAI GPT-3.5 Turbo',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        api_endpoint: 'https://api.openai.com/v1',
        max_tokens: 3000,
        temperature: 0.5,
        is_default: false
      }
    ];

    console.log('📝 Adding sample LLM configurations...');
    for (const config of llmConfigs) {
      await dbPool.query(`
        INSERT INTO llm_configs (id, tenant_id, created_by, name, provider, model,
                                api_endpoint, max_tokens, temperature, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (tenant_id, name) DO UPDATE SET
          provider = EXCLUDED.provider,
          model = EXCLUDED.model,
          api_endpoint = EXCLUDED.api_endpoint,
          max_tokens = EXCLUDED.max_tokens,
          temperature = EXCLUDED.temperature,
          is_default = EXCLUDED.is_default
      `, [
        config.id,
        '00000000-0000-0000-0000-000000000001', // demo tenant
        '00000000-0000-0000-0000-000000000002', // admin user
        config.name,
        config.provider,
        config.model,
        config.api_endpoint,
        config.max_tokens,
        config.temperature,
        config.is_default
      ]);
      console.log(`✅ Added LLM config: ${config.name}`);
    }

    // Add sample AI agents
    const agents = [
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'GRC Risk Analyst',
        description: 'Specialized in risk assessment and compliance analysis',
        persona: 'Expert risk management professional with 10+ years experience',
        system_prompt: 'You are a GRC Risk Analyst with expertise in enterprise risk management, compliance frameworks, and business continuity. Analyze risks and provide actionable recommendations.',
        llm_config_id: '11111111-1111-1111-1111-111111111111',
        avatar: '⚖️',
        color: '#DC2626'
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        name: 'Compliance Officer',
        description: 'Ensures adherence to regulatory requirements and standards',
        persona: 'Detail-oriented compliance expert specializing in regulatory frameworks',
        system_prompt: 'You are a Compliance Officer with deep knowledge of regulatory requirements, audit procedures, and compliance frameworks like SOX, PCI-DSS, GDPR, and ISO 27001.',
        llm_config_id: '11111111-1111-1111-1111-111111111111',
        avatar: '🛡️',
        color: '#2563EB'
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        name: 'Data Privacy Expert',
        description: 'Specializes in data protection and privacy compliance',
        persona: 'Privacy professional with expertise in GDPR, CCPA, and data governance',
        system_prompt: 'You are a Data Privacy Expert specializing in data protection regulations, privacy impact assessments, and data governance frameworks. Help organizations achieve privacy compliance.',
        llm_config_id: '22222222-2222-2222-2222-222222222222',
        avatar: '🔐',
        color: '#059669'
      }
    ];

    console.log('🤖 Adding sample AI agents...');
    for (const agent of agents) {
      await dbPool.query(`
        INSERT INTO ai_agents (id, tenant_id, created_by, name, description, persona,
                              system_prompt, llm_config_id, avatar, color)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (tenant_id, name) DO UPDATE SET
          description = EXCLUDED.description,
          persona = EXCLUDED.persona,
          system_prompt = EXCLUDED.system_prompt,
          llm_config_id = EXCLUDED.llm_config_id,
          avatar = EXCLUDED.avatar,
          color = EXCLUDED.color
      `, [
        agent.id,
        '00000000-0000-0000-0000-000000000001', // demo tenant
        '00000000-0000-0000-0000-000000000002', // admin user
        agent.name,
        agent.description,
        agent.persona,
        agent.system_prompt,
        agent.llm_config_id,
        agent.avatar,
        agent.color
      ]);
      console.log(`✅ Added AI agent: ${agent.name}`);
    }

    // Verify the data
    const tenants = await dbPool.query('SELECT COUNT(*) as count FROM tenants');
    const users = await dbPool.query('SELECT COUNT(*) as count FROM users');
    const llmConfigsCount = await dbPool.query('SELECT COUNT(*) as count FROM llm_configs');
    const agentsCount = await dbPool.query('SELECT COUNT(*) as count FROM ai_agents');

    console.log('\n🎉 Sample data population completed!');
    console.log(`📊 Database now contains:`);
    console.log(`   - Tenants: ${tenants.rows[0].count}`);
    console.log(`   - Users: ${users.rows[0].count}`);
    console.log(`   - LLM Configs: ${llmConfigsCount.rows[0].count}`);
    console.log(`   - AI Agents: ${agentsCount.rows[0].count}`);

    return {
      success: true,
      stats: {
        tenants: parseInt(tenants.rows[0].count),
        users: parseInt(users.rows[0].count),
        llm_configs: parseInt(llmConfigsCount.rows[0].count),
        ai_agents: parseInt(agentsCount.rows[0].count)
      }
    };

  } catch (error) {
    console.error('❌ Sample data population failed:', error);
    throw error;
  } finally {
    await dbPool.end();
  }
}

// Run population
populateSampleData()
  .then(result => {
    console.log('\n✅ Sample data population completed successfully!', result.stats);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Population failed:', error.message);
    process.exit(1);
  });