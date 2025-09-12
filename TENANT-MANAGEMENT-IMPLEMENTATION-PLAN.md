# Tenant Management System Implementation Plan
## Per-Tenant SSO/SAML Authentication Architecture

### Overview

This document outlines the complete implementation plan for replacing Azure AD B2C with a per-tenant SSO/SAML authentication system. The new architecture enables each enterprise client to use their existing corporate identity provider (Azure AD, Okta, Ping, etc.) for seamless authentication.

---

## 🎯 **Business Benefits**

### For Clients
- **Zero Additional Setup**: Use existing corporate SSO (Azure AD, Okta, etc.)
- **Simplified User Management**: Leverage existing AD groups and roles
- **Enhanced Security**: Single identity governance across all systems
- **Immediate Deployment**: No B2C tenant setup or user migration required

### For Our Platform
- **Faster Client Onboarding**: Minutes instead of days for authentication setup
- **Reduced Support**: Clients manage their own user lifecycle
- **Enterprise Sales**: Standard enterprise authentication patterns
- **Simplified Architecture**: Direct SAML instead of B2C complexity

---

## 🏗️ **Architecture Overview**

### Current vs Proposed Flow

**Current (B2C):**
```
User → Azure AD B2C → Platform → MCP Tools
```

**Proposed (Direct SAML):**
```
User → Corporate SSO → SAML Assertion → Platform → OAuth Token → MCP Tools
```

### Key Components

1. **Tenant SAML Configuration**: Per-tenant IdP settings and certificates
2. **Group-to-Role Mapping**: Corporate groups → Platform permissions
3. **SAML Authentication Service**: Replaces existing B2C service
4. **Tenant Management Interface**: Admin portal for configuration
5. **Automated Provisioning**: Complete tenant setup workflow

---

## 📁 **Files Created/Modified**

### New Database Schema
- `packages/backend/src/config/tenant-saml-schema.sql`
  - **tenant_saml_configs**: Per-tenant SAML IdP configuration
  - **tenant_saml_group_mappings**: Corporate groups → Platform roles
  - **platform_admin_users**: Platform administrators
  - **tenant_onboarding_requests**: Client signup workflow
  - **tenant_provisioning_status**: Automated setup tracking

### TypeScript Interfaces
- `packages/backend/src/types/tenant-management.ts`
  - Complete type definitions for all tenant management operations
  - SAML configuration interfaces
  - Onboarding workflow types
  - Error handling types

### Core Services
- `packages/backend/src/services/tenantManagementService.ts`
  - Tenant creation and provisioning
  - SAML configuration management
  - Group mapping and role assignment
  - Configuration testing and validation

### API Routes
- `packages/backend/src/routes/tenantManagement.ts`
  - Complete REST API for tenant management
  - SAML configuration endpoints
  - Testing and validation endpoints
  - Onboarding workflow APIs

---

## 🚀 **Implementation Phases**

### Phase 1: Database Migration & Core Services (Week 1-2)

#### Tasks:
1. **Database Schema Updates**
   ```bash
   # Apply new schema to existing database
   sqlite3 ./data/grc-platform.db < packages/backend/src/config/tenant-saml-schema.sql
   ```

2. **Update Existing Tables**
   ```sql
   -- Add SAML fields to users table
   ALTER TABLE users ADD COLUMN saml_name_id TEXT UNIQUE;
   ALTER TABLE users ADD COLUMN authentication_method TEXT DEFAULT 'saml';
   
   -- Mark existing users as B2C (during transition)
   UPDATE users SET authentication_method = 'b2c' WHERE azure_b2c_object_id IS NOT NULL;
   ```

3. **Integrate Services**
   - Register tenant management service in main app
   - Add routes to Express router
   - Update dependency injection

#### Validation:
- [ ] Database schema applies successfully
- [ ] API endpoints return proper responses
- [ ] Service layer handles errors gracefully

### Phase 2: SAML Authentication Implementation (Week 3-4)

#### Tasks:
1. **SAML Library Integration**
   ```bash
   npm install --save saml2-js passport-saml xml2js
   npm install --save-dev @types/passport-saml
   ```

2. **Create SAML Authentication Service**
   ```typescript
   // packages/backend/src/services/samlAuthService.ts
   export class SAMLAuthService {
     async processSAMLAssertion(assertion: string, tenantId: string): Promise<UserSession>
     async initiateSAMLLogin(tenantId: string): Promise<string>
     async handleSAMLResponse(response: string, tenantId: string): Promise<AuthResult>
   }
   ```

3. **SAML Endpoints**
   ```typescript
   // SAML authentication routes
   POST /saml/login/:tenantId        // Initiate SAML login
   POST /saml/acs/:tenantId          // Assertion Consumer Service
   POST /saml/sls/:tenantId          // Single Logout Service
   GET  /saml/metadata/:tenantId     // SAML metadata for IdP
   ```

4. **Replace Auth Service**
   - Update existing `authService.ts` to handle both B2C and SAML
   - Implement tenant detection logic
   - Maintain backward compatibility during transition

#### Validation:
- [ ] SAML metadata generates correctly
- [ ] Test assertions process successfully
- [ ] Group mappings work as expected
- [ ] OAuth tokens generate for MCP access

### Phase 3: Admin Interface & Testing Tools (Week 5-6)

#### Tasks:
1. **Platform Admin Dashboard**
   ```typescript
   // Frontend components for tenant management
   - TenantListView: Browse and filter tenants
   - TenantDetailView: Detailed tenant configuration
   - SAMLConfigurationForm: SAML setup wizard
   - TestSAMLConnection: Validation tools
   ```

2. **SAML Configuration Wizard**
   - Step-by-step SAML setup for common providers
   - Certificate upload and validation
   - Group mapping configuration
   - Test connection functionality

3. **Monitoring & Diagnostics**
   - SAML authentication logs
   - Failed login analysis
   - Group mapping diagnostics
   - Performance monitoring

#### Validation:
- [ ] Admin can create new tenants
- [ ] SAML configuration wizard works
- [ ] Test connections validate properly
- [ ] Monitoring shows accurate data

### Phase 4: Client Onboarding Automation (Week 7-8)

#### Tasks:
1. **Self-Service Onboarding**
   ```typescript
   // Client signup flow
   - OrganizationSignupForm: Initial client information
   - SAMLSetupGuide: Provider-specific instructions
   - TestConnection: Validation before activation
   - GoLiveWorkflow: Final activation steps
   ```

2. **Automated Provisioning**
   - Tenant database initialization
   - Default configuration setup
   - MCP server enablement
   - Admin user creation

3. **Integration Testing**
   - End-to-end authentication flows
   - Multi-tenant isolation testing
   - Performance testing with multiple tenants
   - Security validation

#### Validation:
- [ ] Complete self-service onboarding works
- [ ] Provisioning completes successfully
- [ ] New tenants can authenticate immediately
- [ ] Isolation between tenants maintained

---

## 🔧 **Technical Implementation Details**

### 1. Tenant Isolation Strategy

#### Database Partitioning
```sql
-- All tenant data includes tenant_id for isolation
SELECT * FROM ai_agents WHERE tenant_id = ?
SELECT * FROM users WHERE primary_tenant_id = ?
SELECT * FROM chat_sessions WHERE tenant_id = ?
```

#### MCP Tool Access Control
```typescript
// Existing OAuth MCP service already supports SAML groups
const oauthToken = await oauthMcpService.generateOAuthTokenFromSAML({
  username: samlUser.nameId,
  email: samlUser.email,
  groups: samlUser.groups,
  tenantId: tenantId,
  sessionExpiresAt: new Date(Date.now() + sessionTimeout)
});
```

### 2. SAML Group Mapping Implementation

#### Configuration Example
```typescript
const groupMappings = [
  {
    samlGroup: "GRC_Administrators",
    platformRole: "TenantOwner",
    mcpToolGroups: ["G1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6"], // Full access
    permissions: ["manage_agents", "configure_llm", "view_audit_logs"]
  },
  {
    samlGroup: "Risk_Analysts", 
    platformRole: "AgentUser",
    mcpToolGroups: ["G2A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6"], // Risk tools only
    permissions: ["use_agents", "view_reports"]
  }
];
```

#### Runtime Processing
```typescript
async function mapUserGroups(samlGroups: string[], tenantId: string): Promise<UserRoles> {
  const mappings = await db.query(`
    SELECT platform_role, mcp_tool_groups, permissions 
    FROM tenant_saml_group_mappings 
    WHERE tenant_id = ? AND saml_group_name IN (${samlGroups.map(() => '?').join(',')})
    AND is_enabled = 1
    ORDER BY priority ASC
  `, [tenantId, ...samlGroups]);
  
  return consolidateRoles(mappings);
}
```

### 3. Migration Strategy from B2C

#### Gradual Migration Approach
```typescript
// Support both authentication methods during transition
async function authenticateUser(req: Request): Promise<UserSession> {
  const tenantId = extractTenantFromRequest(req);
  const tenant = await getTenantConfig(tenantId);
  
  if (tenant.saml_config?.is_enabled) {
    return await samlAuthService.authenticate(req, tenantId);
  } else {
    return await b2cAuthService.authenticate(req); // Fallback to B2C
  }
}
```

#### Data Migration
```typescript
// Migrate existing B2C users to SAML when tenant switches
async function migrateTenantToSAML(tenantId: string): Promise<MigrationResult> {
  const b2cUsers = await getUsersByTenant(tenantId);
  
  for (const user of b2cUsers) {
    // Map B2C user to SAML name ID (usually email)
    await updateUser(user.user_id, {
      saml_name_id: user.email,
      authentication_method: 'saml',
      azure_b2c_object_id: null // Remove B2C dependency
    });
  }
}
```

---

## 🚦 **Validation & Testing Plan**

### Unit Tests
```typescript
// Test SAML configuration validation
describe('TenantManagementService', () => {
  test('validates SAML configuration correctly', async () => {
    const config = { /* valid SAML config */ };
    const result = await tenantService.validateSAMLConfig(config);
    expect(result.valid).toBe(true);
  });
  
  test('maps SAML groups to platform roles', async () => {
    const groups = ['GRC_Administrators', 'Risk_Analysts'];
    const roles = await tenantService.mapGroupsToRoles(groups, tenantId);
    expect(roles).toContain('TenantOwner');
  });
});
```

### Integration Tests
```typescript
// Test complete authentication flow
describe('SAML Authentication Flow', () => {
  test('processes SAML assertion and creates session', async () => {
    const assertion = createTestSAMLAssertion();
    const result = await samlAuthService.processSAMLAssertion(assertion, tenantId);
    expect(result.user).toBeDefined();
    expect(result.session).toBeDefined();
  });
});
```

### End-to-End Tests
```bash
# Test tenant creation and configuration
npm run test:e2e -- --testNamePattern="Tenant Management"

# Test SAML authentication with different providers
npm run test:e2e -- --testNamePattern="SAML Authentication"

# Test MCP tool access with SAML users
npm run test:e2e -- --testNamePattern="MCP Tool Access"
```

---

## 📊 **Monitoring & Analytics**

### Key Metrics to Track
```typescript
interface TenantMetrics {
  authentication_success_rate: number;
  average_login_time_ms: number;
  failed_login_attempts: number;
  group_mapping_failures: number;
  mcp_tool_usage_by_role: Record<string, number>;
  tenant_onboarding_time_hours: number;
}
```

### Dashboard Components
1. **Tenant Health Overview**: Authentication success rates per tenant
2. **SAML Configuration Status**: Which tenants have SAML properly configured
3. **User Activity**: Login patterns and role usage
4. **Error Analysis**: Failed authentications and group mapping issues
5. **Onboarding Pipeline**: New tenant signup and activation status

---

## 🔒 **Security Considerations**

### SAML Security Best Practices
1. **Certificate Validation**: Verify IdP certificates before processing assertions
2. **Assertion Encryption**: Support encrypted SAML assertions where required
3. **Replay Attack Prevention**: Track assertion IDs and timestamps
4. **Signature Validation**: Verify all SAML responses and assertions are signed
5. **Audience Restriction**: Validate audience matches expected SP entity ID

### Tenant Isolation
1. **Database Queries**: All queries include tenant_id for data isolation
2. **API Authorization**: Verify user can access requested tenant resources
3. **Session Management**: Tenant-scoped sessions with proper invalidation
4. **Audit Logging**: All tenant actions logged with proper attribution

---

## 📈 **Performance Optimization**

### Caching Strategy
```typescript
// Cache SAML configurations to avoid database queries
const samlConfigCache = new Map<string, TenantSAMLConfig>();

// Cache group mappings for faster role resolution
const groupMappingCache = new Map<string, TenantSAMLGroupMapping[]>();

// Cache user sessions to minimize database lookups
const sessionCache = new Redis({
  host: process.env.REDIS_HOST,
  ttl: 8 * 60 * 60 // 8 hours
});
```

### Database Optimization
```sql
-- Index tenant_id in all tenant-scoped tables
CREATE INDEX idx_tenant_id ON ai_agents(tenant_id);
CREATE INDEX idx_tenant_id ON chat_sessions(tenant_id);
CREATE INDEX idx_tenant_id ON audit_events(tenant_id);

-- Index SAML name IDs for fast user lookup
CREATE INDEX idx_saml_name_id ON users(saml_name_id);

-- Index group mappings for role resolution
CREATE INDEX idx_tenant_group ON tenant_saml_group_mappings(tenant_id, saml_group_name);
```

---

## 📝 **Client Onboarding Process**

### Step-by-Step Workflow

#### 1. Initial Contact & Requirements Gathering
```typescript
interface OnboardingRequest {
  organization_name: string;
  organization_domain: string;
  primary_contact: ContactInfo;
  estimated_users: number;
  existing_sso_provider: 'azure-ad' | 'okta' | 'ping' | 'other';
  compliance_requirements: string[];
}
```

#### 2. Technical Discovery Call
- **Duration**: 30-45 minutes
- **Attendees**: Technical contact, our implementation engineer
- **Outcome**: SAML configuration template and setup instructions

#### 3. SAML Configuration Setup
```typescript
// Provide tenant-specific SAML metadata
const metadata = await generateSAMLMetadata(tenantId);

// Client configures their IdP with:
// - SP Entity ID: https://platform.com/saml/metadata/{tenantId}
// - ACS URL: https://platform.com/saml/acs/{tenantId}
// - Certificate: Our platform's X.509 certificate
```

#### 4. Group Mapping Configuration
```typescript
// Client provides their AD/LDAP groups
const clientGroups = [
  "CN=GRC Administrators,OU=Security,DC=company,DC=com",
  "CN=Risk Analysts,OU=Risk,DC=company,DC=com",
  "CN=Compliance Officers,OU=Compliance,DC=company,DC=com"
];

// We map to platform roles
const mappings = createGroupMappings(clientGroups, tenantId);
```

#### 5. Testing & Validation
```typescript
// Test SAML configuration
const testResult = await testSAMLConfiguration({
  tenant_id: tenantId,
  test_assertion: clientProvidedTestAssertion
});

if (testResult.success) {
  await activateTenant(tenantId);
} else {
  await provideTroubleshootingGuidance(testResult.errors);
}
```

#### 6. Go-Live & Support
- **User Training**: 1-hour session on platform usage
- **Support Handoff**: Direct contact for technical issues
- **Success Metrics**: Track authentication success rate for first 30 days

---

## 🔄 **Migration Timeline**

### Development Phase (Weeks 1-8)
- ✅ **Week 1-2**: Database schema and core services
- ⏳ **Week 3-4**: SAML authentication implementation  
- ⏳ **Week 5-6**: Admin interface and testing tools
- ⏳ **Week 7-8**: Client onboarding automation

### Testing Phase (Weeks 9-10)
- **Week 9**: Internal testing with multiple mock tenants
- **Week 10**: Beta testing with 2-3 pilot clients

### Production Rollout (Weeks 11-12)
- **Week 11**: Deploy to staging with existing clients (dual mode)
- **Week 12**: Full production deployment and B2C deprecation

### Post-Launch (Weeks 13-16)
- **Week 13-14**: Monitor and optimize performance
- **Week 15-16**: Enhanced features and client feedback integration

---

## 🎉 **Success Criteria**

### Technical Metrics
- [ ] **Authentication Success Rate**: >99.5% for SAML logins
- [ ] **Response Time**: <500ms average for authentication flow
- [ ] **Uptime**: 99.9% availability for tenant management APIs
- [ ] **Security**: Zero security incidents related to tenant isolation

### Business Metrics  
- [ ] **Onboarding Time**: <4 hours from signup to go-live
- [ ] **Client Satisfaction**: >4.5/5 rating on onboarding experience
- [ ] **Support Tickets**: <10% authentication-related tickets
- [ ] **Sales Velocity**: 50% faster enterprise sales cycle

### Operational Metrics
- [ ] **Automated Provisioning**: 95% of tenants provision without manual intervention
- [ ] **Configuration Accuracy**: <5% SAML configuration errors
- [ ] **Migration Success**: 100% of existing clients migrate successfully
- [ ] **Documentation Quality**: All clients can self-configure with provided guides

---

## 📞 **Next Steps**

### Immediate Actions (This Week)
1. **Review and approve** this implementation plan
2. **Apply database schema** to development environment
3. **Install SAML dependencies** and begin service development
4. **Create project timeline** with specific milestones and assignments

### Development Priorities
1. **Core SAML service**: Authentication and group mapping
2. **Tenant management APIs**: CRUD operations for tenant configuration  
3. **Admin interface**: UI for platform administrators
4. **Client onboarding**: Self-service signup and configuration

### Validation Strategy
1. **Weekly demos** of new functionality
2. **Continuous integration** with automated testing
3. **Security reviews** for all authentication flows
4. **Performance testing** with simulated tenant load

---

**Ready to proceed with this architecture?** This approach will significantly simplify client onboarding while providing enterprise-grade authentication that scales with our business growth.