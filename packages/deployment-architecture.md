# GRC AI Platform - Production Deployment Architecture

## Executive Summary

This document outlines the comprehensive transformation of the GRC AI Platform from a localStorage-based demo to a production-ready, multi-tenant SaaS platform. The architecture ensures proper tenant isolation, security, scalability, and compliance with enterprise requirements.

## Critical Issues Addressed

### 1. **localStorage Dependency Elimination**
- **Problem**: All configurations (agents, LLM configs, MCP servers, tenant settings) stored in browser localStorage
- **Solution**: Complete replacement with secure backend APIs and database persistence
- **Impact**: Enables proper multi-tenant isolation, data persistence, and production deployment

### 2. **Tenant Name vs UUID Migration** 
- **Problem**: Using human-readable tenant names instead of UUIDs
- **Solution**: UUID-based tenant identification with proper foreign key relationships
- **Impact**: Prevents conflicts, improves security, enables horizontal scaling

### 3. **Authentication & Authorization**
- **Problem**: No proper authentication or tenant access controls
- **Solution**: Azure AD B2C integration with role-based access control (RBAC)
- **Impact**: Enterprise-grade security, compliance, and user management

### 4. **Data Persistence & Isolation**
- **Problem**: No persistent storage, no tenant isolation
- **Solution**: Azure SQL/Cosmos DB with tenant partitioning and isolation
- **Impact**: Data durability, compliance, proper multi-tenancy

## Architecture Components

### 1. Database Schema (Multi-Tenant)

```sql
-- Core tenant management with UUID isolation
tenants (tenant_id UUID PRIMARY KEY, ...)
users (user_id UUID, primary_tenant_id UUID, ...)
user_tenant_roles (user_id, tenant_id, role, ...)

-- AI agent management (replaces localStorage)
ai_agents (agent_id UUID, tenant_id UUID, ...)
llm_configurations (config_id UUID, tenant_id UUID, ...)

-- MCP server management
mcp_server_registry (server_id UUID, ...) -- Global registry
tenant_mcp_servers (tenant_id, server_id, ...) -- Per-tenant enablement

-- Chat and session management
chat_sessions (session_id UUID, tenant_id UUID, user_id UUID, ...)
chat_messages (message_id UUID, session_id UUID, tenant_id UUID, ...)

-- Comprehensive audit logging
audit_events (event_id UUID, tenant_id UUID, ...) -- Tamper-evident logs
agent_usage_metrics (tenant_id UUID, agent_id UUID, ...) -- Usage analytics
```

**Key Features:**
- All tables partitioned by `tenant_id` for isolation
- UUID primary keys prevent enumeration attacks
- Foreign key constraints ensure referential integrity
- Comprehensive indexing for performance
- Soft delete support with `deleted_at` timestamps

### 2. REST API Layer

**Authentication Endpoints:**
```http
POST /api/v1/auth/login          # Azure B2C login initiation
POST /api/v1/auth/callback       # Handle B2C callback
GET  /api/v1/auth/me            # Current user info
GET  /api/v1/auth/tenants       # Available tenants
POST /api/v1/auth/switch-tenant # Switch tenant context
```

**Agent Management (replaces localStorage):**
```http
GET    /api/v1/agents                 # List agents
POST   /api/v1/agents                 # Create agent  
GET    /api/v1/agents/{id}           # Get agent with context
PUT    /api/v1/agents/{id}           # Update agent
DELETE /api/v1/agents/{id}           # Delete agent
POST   /api/v1/agents/from-preset    # Create from preset
```

**LLM Configuration (replaces localStorage):**
```http
GET    /api/v1/llm-configs           # List LLM configs
POST   /api/v1/llm-configs           # Create config
PUT    /api/v1/llm-configs/{id}      # Update config
POST   /api/v1/llm-configs/{id}/test # Test connectivity
```

**MCP Server Management (replaces localStorage):**
```http
GET    /api/v1/mcp-servers                    # Tenant's enabled servers
POST   /api/v1/mcp-servers/enable            # Enable server for tenant
GET    /api/v1/mcp-servers/registry          # Global registry (admin)
POST   /api/v1/mcp-servers/{id}/test         # Test server
```

**All endpoints include:**
- `Authorization: Bearer {jwt_token}` header
- `X-Tenant-ID: {tenant_uuid}` header for isolation
- Comprehensive error responses with proper HTTP status codes
- Rate limiting based on tenant subscription tier

### 3. Authentication & Authorization

**Azure AD B2C Integration:**
```typescript
// JWT token structure from Azure B2C
interface AzureB2CToken {
  oid: string;           // User object ID
  email: string;         // User email
  name: string;          // Display name
  extension_TenantId?: string; // Primary tenant ID
  // ... other B2C claims
}
```

**Role-Based Access Control:**
```typescript
type UserRole = 
  | 'PlatformOwner'     // Cross-tenant admin access
  | 'TenantOwner'       // Full tenant management
  | 'AgentUser'         // Use agents, limited config
  | 'Auditor'           // Read-only audit access
  | 'ComplianceOfficer'; // Compliance-specific access
```

**Middleware Stack:**
1. **Token Authentication**: Verify Azure B2C JWT tokens
2. **Tenant Validation**: Ensure user has access to requested tenant
3. **Role Authorization**: Check user roles for operation
4. **Resource Access Control**: Validate ownership of specific resources
5. **Quota Enforcement**: Check tenant usage limits
6. **Cross-Tenant Prevention**: Block access to other tenant data

### 4. Frontend API Client

**Complete localStorage Replacement:**
```typescript
// Old localStorage approach (BROKEN)
localStorage.getItem(`ai_agents_${tenantId}`)

// New API client approach (PRODUCTION-READY)
const response = await apiClient.getAgents({ enabled: true });
```

**Key Features:**
- Automatic authentication header management
- Tenant context propagation via headers
- Comprehensive error handling and retry logic
- Type-safe request/response interfaces
- Rate limiting and quota awareness

### 5. Security Architecture

**Multi-Layer Security:**

1. **Transport Security**
   - TLS 1.3 for all communications
   - Certificate pinning for mobile clients
   - HSTS headers for web clients

2. **Authentication Security**
   - Azure AD B2C for identity management
   - JWT token validation with JWKS
   - Refresh token rotation
   - MFA enforcement capabilities

3. **Authorization Security**
   - Role-based access control (RBAC)
   - Resource-level permission checks
   - Tenant isolation enforcement
   - Cross-tenant access prevention

4. **Data Security**
   - Tenant partitioning at database level
   - Azure Key Vault for sensitive config storage
   - PII detection and redaction in logs
   - Encryption at rest and in transit

5. **API Security**
   - Rate limiting per tenant tier
   - Input validation and sanitization
   - SQL injection prevention
   - XSS protection headers

**Audit & Compliance:**
```sql
-- Comprehensive audit trail
audit_events (
  event_id UUID,
  tenant_id UUID,
  user_id UUID,
  event_type VARCHAR(100),  -- 'agent_created', 'config_modified'
  event_category VARCHAR(50), -- 'security', 'configuration'
  before_state NVARCHAR(MAX), -- JSON snapshot before
  after_state NVARCHAR(MAX),  -- JSON snapshot after
  client_ip VARCHAR(45),
  user_agent VARCHAR(500),
  event_hash VARCHAR(64),     -- SHA-256 for tamper detection
  compliance_frameworks NVARCHAR(MAX), -- ['ISO27001', 'SOC2']
  event_timestamp DATETIME2 DEFAULT GETUTCDATE()
)
```

## Deployment Architecture

### 1. Azure Infrastructure

**Recommended Azure Services:**
```yaml
Core Infrastructure:
  - Azure App Service (Backend API)
  - Azure Static Web Apps (Frontend)
  - Azure SQL Database / Cosmos DB (Primary data)
  - Azure Key Vault (Secrets management)
  - Azure AD B2C (Identity management)

Scaling & Performance:
  - Azure API Management (Rate limiting, caching)
  - Azure CDN (Static asset delivery)
  - Azure Redis Cache (Session/response caching)
  - Azure Load Balancer (High availability)

Security & Compliance:
  - Azure Security Center (Threat detection)
  - Azure Monitor / Log Analytics (Audit logging)
  - Azure Backup (Data protection)
  - Azure Policy (Compliance enforcement)
```

**Multi-Region Deployment:**
```
Primary Region (East US):
├── App Service (Backend API)
├── SQL Database (Primary)
├── Key Vault (Primary)
└── Storage Account (Primary)

Secondary Region (West US):
├── App Service (Disaster recovery)
├── SQL Database (Geo-replica)
├── Key Vault (Replica)
└── Storage Account (Geo-replica)

Global Services:
├── Azure AD B2C (Global)
├── API Management (Multi-region)
├── CDN (Global distribution)
└── Traffic Manager (Failover routing)
```

### 2. Database Design

**Tenant Isolation Strategy:**
```sql
-- Row-Level Security (RLS) for tenant isolation
CREATE SECURITY POLICY tenant_isolation_policy  
ADD FILTER PREDICATE tenant_id = CAST(SESSION_CONTEXT(N'tenant_id') AS UNIQUEIDENTIFIER)
ON ai_agents, llm_configurations, tenant_mcp_servers, chat_sessions, audit_events;
```

**Scaling Approach:**
1. **Vertical Scaling**: Start with single database, scale compute/storage
2. **Read Replicas**: Add read-only replicas for analytics queries
3. **Tenant Sharding**: Large tenants get dedicated database instances
4. **Horizontal Partitioning**: Partition by tenant_id for extreme scale

**Performance Optimization:**
```sql
-- Critical indexes for multi-tenant queries
CREATE INDEX IX_ai_agents_tenant_enabled ON ai_agents (tenant_id, is_enabled);
CREATE INDEX IX_audit_events_tenant_timestamp ON audit_events (tenant_id, event_timestamp DESC);
CREATE INDEX IX_chat_messages_session_sequence ON chat_messages (session_id, sequence_number);
```

### 3. API Gateway Configuration

**Azure API Management Setup:**
```yaml
Policies:
  Rate Limiting:
    - Starter Tier: 100 req/min, 1000/hour
    - Professional: 300 req/min, 5000/hour  
    - Enterprise: 1000 req/min, 20000/hour
  
  Authentication:
    - JWT token validation
    - Azure AD B2C integration
    - Tenant context injection
  
  Security:
    - IP allowlist (optional)
    - DLP policy enforcement
    - Request/response logging
  
  Caching:
    - GET requests: 5-minute cache
    - User info: 1-hour cache
    - Static data: 24-hour cache
```

### 4. Monitoring & Observability

**Azure Monitor Integration:**
```typescript
// Application insights tracking
const telemetryClient = new TelemetryClient();

// Track custom events
telemetryClient.trackEvent({
  name: 'AgentCreated',
  properties: {
    tenantId,
    agentType: 'grc-risk-analyst',
    userId
  },
  measurements: {
    configurationTime: 1247
  }
});

// Track dependencies
telemetryClient.trackDependency({
  dependencyTypeName: 'Azure SQL',
  name: 'GetAgents',
  data: 'SELECT * FROM ai_agents WHERE tenant_id = ?',
  duration: 45,
  success: true
});
```

**Key Metrics to Track:**
- API response times per endpoint
- Error rates by tenant and operation
- Token usage and billing metrics
- Database query performance
- Authentication success/failure rates
- Tenant onboarding funnel metrics

### 5. CI/CD Pipeline

**Azure DevOps Pipeline:**
```yaml
stages:
  - stage: Build
    jobs:
      - job: BuildBackend
        steps:
          - task: DotNetCoreCLI@2
            inputs:
              command: 'build'
              projects: 'packages/backend/*.csproj'
      
      - job: BuildFrontend  
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
          - task: Npm@1
            inputs:
              command: 'ci'
              workingDir: 'packages/frontend'
          - task: Npm@1
            inputs:
              command: 'run build'
              workingDir: 'packages/frontend'

  - stage: Test
    jobs:
      - job: UnitTests
        steps:
          - task: DotNetCoreCLI@2
            inputs:
              command: 'test'
              projects: '**/*Tests.csproj'
      
      - job: IntegrationTests
        steps:
          - task: AzureCLI@2
            inputs:
              azureSubscription: 'Azure-Subscription'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                # Run integration tests against staging environment
                npm run test:integration

  - stage: Deploy
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployToStaging
        environment: 'Staging'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: 'Azure-Subscription'
                    appName: 'grc-ai-platform-staging'
                    package: '$(Pipeline.Workspace)/backend-package.zip'
                
                - task: AzureStaticWebApp@0
                  inputs:
                    app_location: 'packages/frontend/dist'
                    api_location: ''
                    output_location: ''
                    azure_static_web_apps_api_token: '$(STATIC_WEB_APP_TOKEN)'

      - deployment: DeployToProduction
        dependsOn: DeployToStaging
        condition: succeeded()
        environment: 'Production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: 'Azure-Subscription'
                    appName: 'grc-ai-platform-prod'
                    package: '$(Pipeline.Workspace)/backend-package.zip'
                    deploymentMethod: 'zipDeploy'
                    slotName: 'staging'
                
                - task: AzureAppServiceManage@0
                  inputs:
                    azureSubscription: 'Azure-Subscription'
                    Action: 'Swap Slots'
                    WebAppName: 'grc-ai-platform-prod'
                    SourceSlot: 'staging'
                    TargetSlot: 'production'
```

## Migration Strategy

### Phase 1: Infrastructure Setup (Week 1-2)
1. **Azure Resources Provisioning**
   - App Service, SQL Database, Key Vault setup
   - Azure AD B2C tenant configuration
   - API Management instance deployment

2. **Database Schema Deployment**
   - Execute schema creation scripts
   - Set up tenant isolation policies
   - Create initial admin tenant and user

3. **CI/CD Pipeline Setup**
   - Azure DevOps pipeline configuration
   - Automated testing framework
   - Environment promotion workflows

### Phase 2: Backend API Development (Week 3-4)
1. **Authentication Service**
   - Azure B2C integration
   - JWT token validation middleware
   - Role-based authorization

2. **Core API Endpoints**
   - Agent management APIs
   - LLM configuration APIs
   - MCP server management APIs

3. **Security & Audit**
   - Comprehensive audit logging
   - Cross-tenant access prevention
   - Rate limiting implementation

### Phase 3: Frontend Migration (Week 5)
1. **API Client Implementation**
   - Replace localStorage with API calls
   - Error handling and retry logic
   - Authentication state management

2. **Component Updates**
   - Update all React components
   - Handle loading states properly
   - Implement proper error boundaries

3. **Testing & Validation**
   - End-to-end testing
   - Multi-tenant validation
   - Performance testing

### Phase 4: Production Deployment (Week 6)
1. **Staging Environment Testing**
   - Full integration testing
   - Security penetration testing
   - Performance load testing

2. **Production Cutover**
   - Blue-green deployment
   - Database migration scripts
   - DNS cutover and monitoring

3. **Post-Deployment Monitoring**
   - Real-time monitoring setup
   - Alert configuration
   - Performance baseline establishment

## Cost Optimization

### Initial Deployment Cost Estimates

**Azure Services (Monthly):**
```
App Service (Standard S1):              $73
Azure SQL Database (S2):               $75  
Azure Key Vault:                       $5
Azure AD B2C (50K MAU):                $0 (free tier)
API Management (Developer):            $50
Azure Monitor/Log Analytics (5GB):     $15
Static Web Apps:                       $9
Total Estimated Monthly Cost:          ~$227
```

**Scaling Costs by Tenant Count:**
- 1-100 tenants: $227/month (base infrastructure)
- 100-1000 tenants: $500/month (scale up database, add read replicas)
- 1000-10000 tenants: $1500/month (premium app service, database sharding)
- 10000+ tenants: $5000+/month (multi-region, dedicated instances)

### Cost Optimization Strategies

1. **Right-Sizing Resources**
   - Start with minimum viable infrastructure
   - Use Azure Cost Management for monitoring
   - Implement auto-scaling based on usage

2. **Reserved Instances**
   - 1-year reserved instances for predictable workloads
   - 3-year reserved instances for long-term commitments
   - Can reduce costs by 30-70%

3. **Storage Optimization**
   - Archive old audit logs to cool storage
   - Compress large JSON fields
   - Implement data retention policies

4. **Performance Optimization**
   - Redis caching for frequently accessed data
   - CDN for static assets
   - Database query optimization

## Compliance & Security

### Regulatory Compliance

**ISO 27001 Requirements:**
- ✅ Asset management (all resources tagged and tracked)
- ✅ Access control (RBAC with Azure AD B2C)
- ✅ Audit logging (comprehensive event tracking)
- ✅ Risk management (automated threat detection)
- ✅ Incident response (Azure Security Center integration)

**SOC 2 Type II Requirements:**
- ✅ Security (multi-layer security controls)
- ✅ Availability (99.9% SLA with Azure App Service)
- ✅ Processing Integrity (input validation, error handling)
- ✅ Confidentiality (encryption at rest and in transit)
- ✅ Privacy (PII detection and redaction)

**CPS 230 (APRA) Requirements:**
- ✅ Operational resilience (multi-region deployment)
- ✅ Business continuity (automated backups and disaster recovery)
- ✅ Third-party risk management (Azure compliance certifications)
- ✅ Incident management (automated alerting and response)

### Security Best Practices

1. **Defense in Depth**
   - Network security (VNets, NSGs, firewalls)
   - Application security (authentication, authorization)
   - Data security (encryption, key management)
   - Infrastructure security (monitoring, patching)

2. **Zero Trust Architecture**
   - Verify every user and device
   - Least privilege access principle
   - Assume breach mentality
   - Continuous monitoring and validation

3. **Regular Security Assessments**
   - Monthly vulnerability scans
   - Quarterly penetration testing
   - Annual security audits
   - Continuous threat modeling

## Success Metrics

### Technical Metrics
- **API Response Time**: < 500ms (95th percentile)
- **Database Query Performance**: < 100ms (95th percentile)
- **System Availability**: > 99.9% uptime
- **Error Rate**: < 0.1% of all requests
- **Security Incidents**: 0 data breaches

### Business Metrics
- **Tenant Onboarding Time**: < 5 minutes
- **User Satisfaction**: > 4.5/5 rating
- **Feature Adoption**: > 80% of tenants using AI agents
- **Support Ticket Volume**: < 5% increase during migration
- **Customer Churn**: < 2% during transition

## Conclusion

This comprehensive architecture transformation addresses all critical issues with the current localStorage-based implementation:

1. **Production Readiness**: Complete elimination of localStorage dependencies
2. **Multi-Tenant Isolation**: Proper UUID-based tenant separation
3. **Enterprise Security**: Azure AD B2C integration with RBAC
4. **Scalability**: Horizontal scaling with tenant partitioning
5. **Compliance**: Comprehensive audit logging and security controls

The solution provides a clear migration path from the current demo state to a production-ready, enterprise-grade multi-tenant SaaS platform that can scale to thousands of tenants while maintaining security, performance, and compliance requirements.

**Next Steps:**
1. Review and approve architecture design
2. Provision Azure infrastructure
3. Begin Phase 1 implementation
4. Execute migration plan over 6-week timeline
5. Monitor and optimize post-deployment