-- Production-Ready Agent Database Schema
-- Designed for Azure Cosmos DB (SQL API) with proper tenant isolation

-- =====================================================
-- AGENTS TABLE - Core agent definitions
-- =====================================================
CREATE TABLE agents (
    -- Primary identifiers
    id VARCHAR(36) PRIMARY KEY,              -- UUID format: agent-{uuid}
    tenant_id VARCHAR(50) NOT NULL,          -- Partition key for tenant isolation
    
    -- Agent metadata (mutable)
    name VARCHAR(100) NOT NULL,              -- User-friendly name (can change)
    description TEXT,                        -- Agent description (can change)
    persona TEXT NOT NULL,                   -- Agent behavior profile
    system_prompt TEXT NOT NULL,             -- LLM instructions
    
    -- Configuration references
    llm_config_id VARCHAR(36) NOT NULL,      -- Reference to LLM config
    preset_id VARCHAR(50),                   -- Original preset (if created from preset)
    
    -- Agent settings
    capabilities JSON NOT NULL,              -- Array of capability strings
    use_case VARCHAR(50) NOT NULL,           -- Primary use case category
    
    -- Visual/UI settings
    avatar VARCHAR(10),                      -- Emoji or icon
    color VARCHAR(7),                        -- Hex color code
    
    -- Status and lifecycle
    is_enabled BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,        -- Soft delete
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(36) NOT NULL,         -- User ID who created
    last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified_by VARCHAR(36),            -- User ID who last modified
    last_used_at TIMESTAMP,                  -- When agent was last used
    usage_count INTEGER DEFAULT 0,           -- Total usage counter
    
    -- Indexes for performance
    INDEX idx_agents_tenant (tenant_id),
    INDEX idx_agents_enabled (tenant_id, is_enabled),
    INDEX idx_agents_preset (tenant_id, preset_id),
    INDEX idx_agents_use_case (tenant_id, use_case),
    
    -- Constraints
    CONSTRAINT ck_agents_id_format 
        CHECK (id LIKE 'agent-%' AND CHAR_LENGTH(id) >= 10),
    CONSTRAINT ck_agents_tenant_format 
        CHECK (tenant_id LIKE 'tenant-%'),
    CONSTRAINT fk_agents_llm_config 
        FOREIGN KEY (tenant_id, llm_config_id) 
        REFERENCES llm_configurations(tenant_id, id)
);

-- =====================================================
-- AGENT_MCP_SERVERS - Many-to-many relationship
-- =====================================================
CREATE TABLE agent_mcp_servers (
    -- Composite primary key
    agent_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,          -- Denormalized for partition efficiency
    server_id VARCHAR(50) NOT NULL,
    
    -- Configuration overrides
    is_enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,            -- Server priority for routing
    rate_limit_override JSON,                -- Server-specific rate limits
    
    -- Audit fields
    enabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enabled_by VARCHAR(36) NOT NULL,
    last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (agent_id, server_id),
    
    -- Indexes
    INDEX idx_agent_servers_tenant (tenant_id),
    INDEX idx_agent_servers_enabled (tenant_id, is_enabled),
    
    -- Constraints
    CONSTRAINT fk_agent_mcp_agent 
        FOREIGN KEY (agent_id) REFERENCES agents(id),
    CONSTRAINT fk_agent_mcp_server 
        FOREIGN KEY (tenant_id, server_id) 
        REFERENCES tenant_mcp_servers(tenant_id, server_id)
);

-- =====================================================
-- AGENT_EXECUTIONS - Execution history and metrics
-- =====================================================
CREATE TABLE agent_executions (
    -- Primary identifiers
    id VARCHAR(36) PRIMARY KEY,              -- UUID for execution
    agent_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,          -- Partition key
    
    -- Execution details
    user_id VARCHAR(36) NOT NULL,            -- User who triggered execution
    prompt TEXT NOT NULL,                    -- User's input
    response TEXT,                           -- Agent's response
    
    -- Status and timing
    status ENUM('success', 'failure', 'timeout', 'error') NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,                     -- Execution time in milliseconds
    
    -- Tool usage
    mcp_tools_used JSON,                     -- Array of tool names used
    mcp_servers_used JSON,                   -- Array of server IDs used
    
    -- Resource consumption
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    cost_cents INTEGER,                      -- Cost in cents for tracking
    
    -- Error handling
    error_message TEXT,
    error_type VARCHAR(50),
    stack_trace TEXT,
    
    -- Indexes for analytics
    INDEX idx_executions_tenant_agent (tenant_id, agent_id),
    INDEX idx_executions_status (tenant_id, status),
    INDEX idx_executions_time (tenant_id, started_at),
    INDEX idx_executions_user (tenant_id, user_id),
    
    -- Constraints
    CONSTRAINT fk_executions_agent 
        FOREIGN KEY (agent_id) REFERENCES agents(id),
    CONSTRAINT ck_executions_duration 
        CHECK (duration_ms >= 0 OR duration_ms IS NULL),
    CONSTRAINT ck_executions_tokens 
        CHECK (total_tokens >= 0 OR total_tokens IS NULL)
);

-- =====================================================
-- AGENT_METRICS - Aggregated performance metrics
-- =====================================================
CREATE TABLE agent_metrics (
    -- Primary identifiers
    agent_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,
    metric_date DATE NOT NULL,               -- Daily aggregation
    
    -- Performance metrics
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    
    -- Resource metrics
    total_tokens_used INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0,
    
    -- Tool usage metrics
    mcp_tools_usage_json JSON,              -- Tool usage frequency
    unique_users_count INTEGER DEFAULT 0,
    
    -- Timestamps
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (agent_id, metric_date),
    
    -- Indexes
    INDEX idx_metrics_tenant_date (tenant_id, metric_date),
    INDEX idx_metrics_agent_performance (agent_id, total_executions),
    
    -- Constraints
    CONSTRAINT fk_metrics_agent 
        FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- =====================================================
-- PRODUCTION QUERIES FOR COMMON OPERATIONS
-- =====================================================

-- Get agent with tenant validation (replaces name-based validation)
/*
SELECT a.*, 
       GROUP_CONCAT(ams.server_id) as enabled_servers
FROM agents a
LEFT JOIN agent_mcp_servers ams ON a.id = ams.agent_id AND ams.is_enabled = true
WHERE a.id = @agent_id 
  AND a.tenant_id = @tenant_id 
  AND a.is_enabled = true 
  AND a.is_deleted = false
GROUP BY a.id;
*/

-- Get agents for tenant with performance metrics
/*
SELECT a.*,
       am.total_executions,
       am.successful_executions,
       am.avg_response_time_ms,
       (am.successful_executions * 100.0 / NULLIF(am.total_executions, 0)) as success_rate
FROM agents a
LEFT JOIN agent_metrics am ON a.id = am.agent_id AND am.metric_date = CURRENT_DATE
WHERE a.tenant_id = @tenant_id 
  AND a.is_enabled = true 
  AND a.is_deleted = false
ORDER BY a.last_used_at DESC;
*/

-- Record agent execution
/*
INSERT INTO agent_executions (
    id, agent_id, tenant_id, user_id, prompt, status,
    duration_ms, mcp_tools_used, input_tokens, output_tokens, total_tokens
) VALUES (
    @execution_id, @agent_id, @tenant_id, @user_id, @prompt, @status,
    @duration_ms, @tools_json, @input_tokens, @output_tokens, @total_tokens
);
*/

-- Update usage count and last used timestamp
/*
UPDATE agents 
SET usage_count = usage_count + 1,
    last_used_at = CURRENT_TIMESTAMP,
    last_modified_at = CURRENT_TIMESTAMP
WHERE id = @agent_id AND tenant_id = @tenant_id;
*/