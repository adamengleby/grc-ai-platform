# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this GRC AI Platform repository.

# ⚠️ **CRITICAL MCP ARCHITECTURE - DO NOT MODIFY WITHOUT UNDERSTANDING** ⚠️

## **WORKING MCP COMPONENTS AND FLOW**

### **NEVER CHANGE THESE COMPONENTS WITHOUT DOCUMENTING WHY:**

#### **1. MCP SSE Server (NATIVE MCP TRANSPORT)** ⚡ **NEW**
- **Location**: `/packages/mcp-server/src/mcp-sse-server.ts`
- **Compiled**: `/packages/mcp-server/dist/mcp-sse-server.js`
- **Port**: **3006** (MUST MATCH backend mcpClient configuration)
- **Transport**: Native MCP Server-Sent Events (SSE) with real-time streaming
- **Purpose**: Standards-compliant MCP SSE server with session management and streaming capabilities
- **Start Command**: `cd packages/mcp-server && PORT=3006 node dist/mcp-sse-server.js`
- **Status**: ✅ **ACTIVE** - Provides both backward compatibility and real-time SSE streaming
- **Features**: Session isolation, progress streaming, connection management, health monitoring

#### **2. MCP Core Server Engine**
- **Location**: `/packages/mcp-server/src/server/index.ts` 
- **Compiled**: `/packages/mcp-server/dist/server/index.js`
- **Transport**: Integrated with SSE server (no longer spawned as subprocess)
- **Tools**: 25+ Archer GRC tools dynamically loaded
- **Purpose**: Core MCP server logic that communicates with Archer GRC platform
- **Integration**: Direct instantiation in SSE server for better performance

#### **3. Backend MCP Client (HTTP MODE)**
- **File**: `/packages/backend/src/services/mcpClient.ts`
- **URL**: `http://localhost:3006` (connects to HTTP wrapper)
- **Purpose**: Backend service for connecting to MCP HTTP wrapper
- **Used By**: `/api/v1/mcp-servers/tools` endpoint

#### **4. Backend Multi MCP Client (UNUSED FOR NOW)**
- **File**: `/packages/backend/src/services/multiMcpClient.ts` 
- **Status**: NOT CURRENTLY USED (tried to use HTTP endpoints that don't exist)
- **Purpose**: Multi-server orchestration (future use)

#### **5. Frontend API Client**
- **File**: `/packages/frontend/src/services/apiClient.ts:756`
- **Calls**: `GET /mcp-servers/tools` (NOT `/mcp/tools`)
- **Method**: `getMcpTools()`

#### **6. Backend API Endpoints**
- **Router**: `/packages/backend/src/routes/mcpServers.ts` ✅ **WORKING**
- **Endpoint**: `/api/v1/mcp-servers/tools` ✅ **WORKING**
- **Legacy Router**: `/packages/backend/src/routes/mcp.ts` 
- **Legacy Endpoints**: `/api/v1/mcp/tools` (stdio version - has spawn issues)

### **COMPLETE DATA FLOW (SSE TRANSPORT):**
```
🆕 SSE-Enabled Frontend
    ↓
Frontend useMCPSSE() hook
    ↓
Direct SSE connection to http://localhost:3006/sse (mcp-sse-server.js)
    ↓
Real-time MCP tool execution with progress streaming
    ↓
25+ Archer GRC tools with session isolation
    ↓
Progress updates via SSE events
    ↓
Frontend shows live tool execution progress

🔄 Backward Compatible HTTP
    ↓
Frontend apiClient.getMcpTools()
    ↓
GET /api/v1/mcp/tools (mcp.ts)
    ↓
HTTP GET http://localhost:3006/tools (mcp-sse-server.js)
    ↓
Direct MCP server integration (no subprocess)
    ↓
25+ Archer GRC tools returned
    ↓
Tools formatted for frontend
```

### **DATABASE CONFIGURATION (WORKING):**
- **MCP Server ID**: `M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6`
- **Server Type**: `stdio` (in mcp_server_registry table)
- **Agent Config**: `enabled_mcp_servers: ["M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6"]`
- **Tenant Enabled**: `is_enabled = 1` (in tenant_mcp_servers table)

### **PORT CONFIGURATION (CRITICAL):**
- **3005**: Backend API server
- **3006**: MCP HTTP Wrapper (MUST BE RUNNING)
- **5173**: Frontend development server

### **KEY FILES TO NEVER MODIFY WITHOUT BACKUP:**
1. `/packages/backend/src/routes/mcpServers.ts` - **WORKING ENDPOINT**
2. `/packages/backend/src/services/mcpClient.ts` - **WORKING CLIENT**  
3. `/packages/mcp-server/dist/http-wrapper.js` - **CRITICAL BRIDGE**
4. `/packages/mcp-server/dist/index.js` - **CORE MCP SERVER**

### **STARTUP SEQUENCE (REQUIRED):**
1. Start Backend: `cd packages/backend && npm run dev` (port 3005)
2. Start MCP SSE Server: `cd packages/mcp-server && PORT=3006 node dist/mcp-sse-server.js` (port 3006) ⚡ **NEW**
3. Start Frontend: `cd packages/frontend && npm run dev` (port 5173)

### **FRONTEND SSE FEATURES:**
- **Real-time progress**: Live tool execution progress with visual indicators
- **Session management**: Isolated sessions with connection status monitoring
- **Progress streaming**: Real-time updates during long Archer GRC operations
- **Enhanced UX**: SSE demo tab in MCP Test Interface with live tool execution
- **Chat integration**: AgentChatModal now shows active tool progress in real-time

### **TROUBLESHOOTING:**
- **If "0 tools available"**: Check if MCP SSE server is running on port 3006 ⚡
- **If ECONNREFUSED**: Restart SSE server: `PORT=3006 node dist/mcp-sse-server.js` ⚡
- **If SSE connection fails**: Check browser console and server logs for connection errors
- **If no progress updates**: Verify SSE client is properly integrated and connection is established
- **If spawn errors**: Legacy issue - now resolved with direct SSE server integration ✅
- **If frontend fails**: Ensure it calls `/mcp-servers/tools` not `/mcp/tools`
- **If "No AI Agents Available"**: Check that backendApiClient.ts uses `http://localhost:3005/api/v1` not `/api/v1`

---

## Project Overview

This is an **AI-Powered GRC Analytics Platform** built for local development with production-ready architecture. The platform provides two primary AI-powered features for Governance, Risk, and Compliance (GRC) professionals.

### Current Implementation Status

We have successfully implemented:
- ✅ Backend API with proper domain-specific endpoints
- ✅ Two AI-powered GRC features with rule-based fallbacks
- ✅ Comprehensive business and domain expert analysis
- 🚧 Implementing realistic GRC metrics and dashboard data
- ⏳ Building specialized dashboard UI components

## Architecture Summary

### Current Tech Stack
- **Backend**: Node.js/Express with TypeScript, SQLite for local dev (Cosmos DB for production)
- **Frontend**: React/Vite with TypeScript, Tailwind CSS
- **AI Integration**: OpenAI GPT-4 with intelligent fallbacks, multi-agent orchestration
- **Configuration**: Tenant-isolated LLM configs, MCP server management, credential storage
- **Local Development**: Designed for immediate local testing with production Azure deployment path

### Complete API Structure
```
/api/v1/
├── analytics/          # Generic analytics (legacy, being phased out)
├── data-quality/       # Smart Data Quality Checker (AI-powered GRC)
│   ├── health         # Service health check
│   ├── process        # Process records for AI classification
│   └── dashboard      # Quality metrics dashboard
├── insights/           # Risk & Control Insights Generator (AI agent orchestration)
│   ├── health         # Service health check
│   ├── generate       # Generate strategic insights
│   ├── dashboard      # Risk insights dashboard
│   └── demo           # Demo endpoint
├── credentials/        # Multi-tenant credential management
│   ├── /              # List/create/update credentials
│   └── /test          # Test credential connectivity
├── mcp/               # MCP Server management & orchestration
│   ├── /servers       # Available MCP servers registry
│   ├── /configs       # Tenant MCP configurations
│   └── /tools         # MCP tool discovery and testing
├── connections/       # Connection testing for external systems
│   └── /test         # Test various system connections
├── simple-agents/     # Simplified agent management (LocalStorage replacement)
├── simple-llm-configs/# Simplified LLM configuration management
├── simple-mcp-configs/# Simplified MCP server configuration
└── simple-credentials/# Simplified credential management
```

### AI Agent Architecture

#### Multi-Agent System
The platform implements a sophisticated AI agent orchestration system:

**1. Agent Types**:
- **Data Quality Agent**: Incident/risk/control classification specialist
- **Risk Analysis Agent**: Strategic risk assessment and correlation
- **Compliance Agent**: Framework mapping and gap analysis
- **Insights Generator Agent**: Executive reporting and recommendations

**2. Agent Orchestration**:
- **Parallel Processing**: Multiple agents analyze data simultaneously
- **Consensus Building**: Cross-agent validation and confidence scoring
- **Conflict Resolution**: Automated resolution of conflicting analyses
- **Human Escalation**: Intelligent escalation based on confidence thresholds

**3. LLM Service Integration**:
- **Primary**: OpenAI GPT-4 for complex reasoning
- **Fallback**: Rule-based classification for local development
- **Tenant Configuration**: Per-tenant LLM endpoint configuration
- **Rate Limiting**: Intelligent request management and queuing

### MCP Server Integration

#### Model Context Protocol (MCP) Architecture
The platform uses MCP servers for tool orchestration and external system integration:

**1. MCP Server Registry**:
- **Global Registry**: Curated list of approved MCP servers
- **Tenant Enablement**: Per-tenant server activation and configuration
- **Health Monitoring**: Continuous health checks and failover
- **Security Validation**: Server validation and sandboxing

**2. Available MCP Servers**:
- **Archer GRC MCP**: Direct integration with RSA Archer platform
- **File System MCP**: Local file and document processing
- **Database MCP**: Database query and analysis capabilities
- **Analytics MCP**: Advanced statistical analysis tools

**3. MCP Tool Orchestration**:
- **Dynamic Discovery**: Runtime tool discovery and registration
- **Permission Management**: Tenant-scoped tool access control
- **Usage Analytics**: Tool usage tracking and optimization
- **Error Handling**: Graceful degradation and error recovery

#### **CRITICAL MCP ARCHITECTURE FLOW** ⚠️
**This is the key architecture that must be maintained when working with MCP servers:**

```
Frontend ↔ MCP HTTP Wrapper (port 3006) ↔ Stdio MCP Server ↔ Archer GRC Platform
```

**Configuration Requirements**:
- **Frontend MCP Config**: `http://localhost:3006` (HTTP wrapper endpoint)
- **Backend MCP Client**: Connects to `http://localhost:3006` (same HTTP wrapper)
- **HTTP Wrapper**: Bridges HTTP requests to stdio MCP server subprocess
- **MCP Server**: Runs as stdio subprocess, communicates with Archer GRC via APIs

**Port Configuration**:
- **3006**: MCP HTTP Wrapper (critical - must match backend MCP client)
- **3005**: Backend API server
- **5173**: Frontend development server

**Agent Tool Access**:
- Agents must have correct server ID: `M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6`
- Database: 1 MCP server providing 17 Archer GRC tools
- LLM gets tools via: Agent Config → MCP Server → HTTP Wrapper → Stdio Server

### Configuration Management System

#### Multi-Tenant Configuration Architecture
**1. LLM Configuration**:
```typescript
interface LLMConfig {
  id: string;
  tenantId: string;
  name: string;
  provider: 'openai' | 'azure' | 'anthropic' | 'local';
  endpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
  credentials: CredentialReference;
}
```

**2. Agent Configuration**:
```typescript
interface AgentConfig {
  id: string;
  tenantId: string;
  name: string;
  type: 'data_quality' | 'risk_analysis' | 'compliance' | 'insights';
  llmConfig: string;          // LLM config ID
  mcpServers: string[];       // Enabled MCP server IDs
  confidenceThresholds: {
    auto: number;             // Auto-process threshold
    review: number;           // Human review threshold
    escalate: number;         // Escalation threshold
  };
  settings: Record<string, any>;
}
```

**3. Credential Management**:
```typescript
interface CredentialConfig {
  id: string;
  tenantId: string;
  name: string;
  type: 'api_key' | 'oauth' | 'basic_auth' | 'certificate';
  encrypted: boolean;
  lastUsed: Date;
  expiresAt?: Date;
}
```

## Two Primary AI Features

### 1. Smart Data Quality Checker (`/api/v1/data-quality/`)
**Purpose**: AI classification of incidents, risks, and controls with confidence scoring and human review workflows.

**Key Capabilities**:
- AI-powered classification of GRC records (incidents, risks, controls)
- Confidence scoring with customizable thresholds
- Human review workflow for low-confidence items
- Quality improvement suggestions and recommendations
- ROI tracking and efficiency metrics

**Business Value**: 70% reduction in manual processing time, $30-60K annual savings per GRC professional.

### 2. Risk & Control Insights Generator (`/api/v1/insights/`)
**Purpose**: AI agent orchestration for strategic GRC analysis and executive reporting.

**Key Capabilities**:
- Natural language queries for strategic risk questions
- AI agent orchestration for complex analysis
- Predictive risk modeling and scenario planning
- Executive-level reporting and recommendations
- Cross-framework compliance analysis

**Business Value**: Strategic decision support, early risk detection, comprehensive compliance oversight.

## Domain Expertise Integration

We have comprehensive specialist recommendations:

### Business Analyst Findings
- **ROI Metrics**: 70% efficiency gains, $30-60K savings per professional
- **Processing Improvement**: 30-60 minutes → 5-10 minutes per incident
- **Target Audiences**: GRC Managers, CROs, Executives, Audit Teams

### Risk Management Specialist Recommendations
- **Risk Scoring**: 1-25 scale (Likelihood × Impact)
- **Control Effectiveness**: Design (40%) + Operational (60%)
- **AI Confidence Thresholds**:
  - Critical risks: 95%+ confidence required
  - High risks: 90%+ confidence required
  - Medium risks: 85%+ confidence required
  - Low risks: 80%+ confidence acceptable
- **Realistic Processing Volumes**: 15-20 privacy incidents/month, 8-12 system outages, 5-8 compliance violations
- **Framework Integration**: ISO 31000, COSO ERM, ISO 27001, NIST

### UI/UX Designer Specifications
- **Trust-Building Components**: AI explanation interfaces, confidence visualizations
- **Executive Dashboards**: Board-ready visualizations with clear ROI demonstration
- **Mobile-Responsive**: Field access capabilities for GRC professionals
- **Human-in-the-Loop**: Intuitive review and override workflows

## Current Development Tasks

### In Progress
1. **Implementing Realistic GRC Data Models**: Replacing generic mock data with industry-standard GRC metrics
2. **Backend Service Enhancement**: Adding proper risk scoring, control effectiveness calculations

### Upcoming
1. **Dashboard UI Components**: Building specialized interfaces for each AI feature
2. **Data Visualization**: Risk heatmaps, confidence distributions, trend analysis
3. **Executive Reporting**: Board-level summaries and strategic insights
4. **Interactive Chat Buttons**: Convert AI-suggested "Next Steps" from text lists to clickable buttons in chat responses, enabling one-click follow-up actions and guided workflows

## Local Development Workflow

### Starting the Platform
```bash
# Backend (port 3005)
cd packages/backend
npm run dev

# Frontend (port 3000) 
cd packages/frontend
npm run dev
```

### Testing AI Features
```bash
# Test Smart Data Quality Checker
curl -X POST "http://localhost:3005/api/v1/data-quality/process" \
  -H "Content-Type: application/json" \
  -d '{"recordType": "incident", "data": {"id": "TEST-001", "title": "System access denied", "description": "Users unable to access database"}}'

# Test Risk Insights Generator
curl -X POST "http://localhost:3005/api/v1/insights/generate" \
  -H "Content-Type: application/json" \
  -d '{"question": "What are our top cybersecurity vulnerabilities?", "context": {"timeframe": "90 days"}}'
```

## Key Business Value Propositions

### For GRC Professionals
- **Efficiency**: 70% reduction in manual incident processing
- **Accuracy**: 85-95% AI classification accuracy with confidence scoring
- **Workflow**: Seamless human-in-the-loop review processes
- **ROI**: Clear time savings and cost reduction metrics

### For Executives
- **Strategic Insights**: AI-powered risk analysis and recommendations
- **Compliance Assurance**: Comprehensive framework coverage and gap analysis
- **Business Impact**: Quantified risk reduction and control effectiveness
- **Board Reporting**: Executive-ready dashboards and summaries

## Important Implementation Notes

### Data Realism Focus
We are implementing realistic GRC metrics based on industry standards rather than generic analytics. This includes:
- Actual incident types and volumes from real GRC environments
- Industry-standard risk scoring methodologies
- Proper control effectiveness calculations
- Framework-specific compliance mappings

### AI Transparency
All AI decisions include:
- Confidence scores with clear thresholds
- Explanation of decision factors
- Human review workflows for edge cases
- Audit trails for compliance requirements

### Local Development Priority
The platform is designed for immediate local testing and demonstration:
- SQLite database for zero-setup development
- Mock data generators for realistic scenarios
- Rule-based fallbacks when OpenAI is not available
- Comprehensive API testing capabilities

## Production Deployment Strategy

### Azure Production Architecture
**Target Platform**: Microsoft Azure with multi-tenant SaaS architecture

#### Core Azure Services
**1. Compute & Hosting**:
- **Azure App Service**: Web app hosting with auto-scaling
- **Azure Functions**: Serverless AI agent processing
- **Azure Container Instances**: MCP server hosting
- **Azure API Management**: API gateway with throttling and security

**2. Data & Storage**:
- **Azure Cosmos DB**: Multi-tenant document database with partition isolation
- **Azure Key Vault**: Per-tenant secrets and credential management
- **Azure Blob Storage**: Document and file storage for MCP servers
- **Azure SQL Database**: Structured data and configuration storage

**3. Security & Identity**:
- **Azure AD B2C**: Multi-tenant authentication and identity management
- **Azure RBAC**: Role-based access control for tenant isolation
- **Azure Monitor**: Comprehensive audit logging with WORM storage
- **Azure Security Center**: Security posture management and threat detection

**4. AI & ML Services**:
- **Azure OpenAI**: Primary LLM service for AI agents
- **Azure Cognitive Services**: Additional AI capabilities (text analysis, etc.)
- **Azure Machine Learning**: Custom model training and deployment
- **Azure Event Grid**: Event-driven AI agent orchestration

#### Multi-Tenant Isolation Strategy
**1. Data Isolation**:
- **Cosmos DB Partitioning**: Tenant ID-based partition keys
- **Dedicated Key Vaults**: Per-tenant Key Vault instances
- **Blob Container Isolation**: Tenant-scoped storage containers
- **Network Isolation**: Virtual network segregation for sensitive tenants

**2. Compute Isolation**:
- **Function App Isolation**: Per-tenant Function Apps for high-security requirements
- **Container Isolation**: Dedicated container groups for MCP servers
- **API Management**: Tenant-scoped API keys and rate limiting
- **Service Bus Queues**: Tenant-isolated message processing

**3. Configuration Isolation**:
- **Tenant-Scoped Configs**: All LLM, agent, and MCP configurations partitioned by tenant
- **Credential Encryption**: Per-tenant encryption keys stored in dedicated Key Vaults
- **Audit Logging**: Tenant-isolated audit trails with tamper-evident storage
- **Backup & Recovery**: Tenant-scoped backup and disaster recovery procedures

#### Deployment Pipeline
**1. CI/CD Strategy**:
- **Azure DevOps**: Source control, build, and deployment pipelines
- **Infrastructure as Code**: Terraform for Azure resource provisioning
- **Environment Promotion**: Dev → Staging → Production with automated testing
- **Blue-Green Deployment**: Zero-downtime production deployments

**2. Monitoring & Observability**:
- **Azure Monitor**: Comprehensive application and infrastructure monitoring
- **Application Insights**: Performance monitoring and user analytics
- **Log Analytics**: Centralized logging with KQL queries
- **Azure Sentinel**: Security information and event management (SIEM)

**3. Cost Optimization**:
- **Consumption-Based Pricing**: Function Apps and Cosmos DB autoscaling
- **Reserved Instances**: Cost savings for predictable workloads
- **Resource Tagging**: Cost allocation and chargeback to tenants
- **Performance Monitoring**: Right-sizing resources based on actual usage

#### Security & Compliance
**1. Data Protection**:
- **Encryption at Rest**: Azure Storage Service Encryption (SSE)
- **Encryption in Transit**: TLS 1.3 for all communications
- **Key Management**: Azure Key Vault with HSM backing
- **Data Residency**: Configurable data location for compliance requirements

**2. Access Control**:
- **Zero Trust Architecture**: Assume breach, verify everything
- **Conditional Access**: Location, device, and risk-based access policies
- **Privileged Identity Management**: Just-in-time admin access
- **API Security**: OAuth 2.0, JWT tokens, and API key rotation

**3. Compliance Frameworks**:
- **SOC 2 Type II**: Security, availability, and confidentiality controls
- **ISO 27001**: Information security management system
- **GDPR**: Data protection and privacy compliance
- **HIPAA**: Healthcare data protection (for healthcare GRC tenants)

#### Scalability & Performance
**1. Horizontal Scaling**:
- **Auto-scaling**: Automatic scaling based on demand
- **Load Balancing**: Multi-region load distribution
- **CDN Integration**: Azure CDN for global content delivery
- **Database Scaling**: Cosmos DB automatic partitioning and scaling

**2. Performance Optimization**:
- **Caching Strategy**: Redis Cache for frequently accessed data
- **Query Optimization**: Optimized Cosmos DB queries with proper indexing
- **AI Model Optimization**: Model quantization and inference optimization
- **Network Optimization**: Azure Traffic Manager for optimal routing

#### Migration Strategy
**1. Data Migration**:
- **SQLite to Cosmos DB**: Automated data migration scripts
- **Configuration Migration**: Tenant configuration porting tools
- **Credential Migration**: Secure credential transfer to Azure Key Vault
- **Validation Testing**: Comprehensive data integrity verification

**2. Application Migration**:
- **Containerization**: Docker containers for consistent deployment
- **Configuration Updates**: Environment-specific configuration management
- **Database Connection Updates**: Cosmos DB connection string management
- **Testing Strategy**: Automated testing in staging environment before production

**3. Rollback Strategy**:
- **Blue-Green Deployment**: Instant rollback capability
- **Database Snapshots**: Point-in-time recovery for data issues
- **Configuration Rollback**: Version-controlled configuration management
- **Monitoring Alerts**: Automated rollback triggers based on error rates

### Development to Production Path
**1. Local Development** (Current):
- SQLite database for immediate development
- Local file system for MCP servers
- Environment variables for configuration
- Mock data for testing and demonstration

**2. Staging Environment**:
- Azure Cosmos DB (development tier)
- Limited Azure Function Apps
- Azure Key Vault (development tier)
- Production-like configuration testing

**3. Production Environment**:
- Full Azure multi-tenant architecture
- Enterprise-grade security and monitoring
- Automated scaling and disaster recovery
- Comprehensive audit logging and compliance

### Extensibility
The platform is designed to support:
- Additional GRC frameworks and standards
- Custom AI models and classification rules
- Third-party GRC platform integrations
- Advanced analytics and reporting capabilities

## Development Standards & Guidelines

### Enterprise Application Standards
This project follows comprehensive enterprise development standards for consistency, maintainability, and security.

#### Naming Conventions
**Files & Folders**:
- `/data-quality-service/` - Kebab-case for folders
- `DataQualityService.ts` - PascalCase for classes
- `dataQualityService.ts` - camelCase for instances  
- `data-quality.interface.ts` - lowercase for interfaces/types
- `data-quality.constants.ts` - lowercase for constants

**Variables & Functions**:
```typescript
// Variables
const tenantId = '123';                     // camelCase
const MAX_CONFIDENCE_THRESHOLD = 0.95;     // UPPER_SNAKE_CASE for constants
const isActiveAgent = true;                 // Boolean prefix: is, has, can

// Functions  
function processGRCRecord() {}              // camelCase, verb prefix
function getAgentById(id) {}                // get, set, update, delete prefixes
function validateRiskScore() {}             // validate, check, verify for validation

// Classes
class AgentOrchestrator {}                  // PascalCase, noun
class DataQualityService {}                 // Service suffix for services
class AuthenticationMiddleware {}           // Descriptive type suffix

// Interfaces
interface AgentConfig {}                    // Without I prefix (modern approach)
interface LLMConfiguration {}               // Descriptive interface names
```

#### API Design Standards
**RESTful Endpoints**: Follow established patterns with domain-specific resources
```
GET    /api/v1/data-quality/dashboard      # Get data quality metrics
POST   /api/v1/data-quality/process        # Process GRC records
POST   /api/v1/insights/generate           # Generate AI insights
GET    /api/v1/agents/{id}/configurations  # Nested resources
POST   /api/v1/agents/{id}/activate        # Action verbs for non-CRUD
```

**Request/Response Format**: Consistent JSON structure
```json
// Successful response
{
    "success": true,
    "data": {
        "recordId": "INC-2024-001",
        "suggestedClassification": {
            "category": "Privacy Breach",
            "confidence": 0.94,
            "reasoning": "GDPR-related indicators detected"
        }
    },
    "meta": {
        "timestamp": "2024-01-15T10:30:00Z",
        "processingTime": "245ms",
        "version": "1.0"
    }
}

// Error response
{
    "success": false,
    "error": {
        "code": "AI_CONFIDENCE_TOO_LOW",
        "message": "AI confidence below threshold for auto-classification",
        "details": {
            "confidence": 0.73,
            "threshold": 0.85,
            "requiresHumanReview": true
        }
    },
    "meta": {
        "timestamp": "2024-01-15T10:30:00Z",
        "requestId": "req_abc123"
    }
}
```

#### Database Standards
**Table Naming**: Plural, snake_case
```sql
CREATE TABLE grc_incidents (...)
CREATE TABLE risk_assessments (...)
CREATE TABLE control_evaluations (...)
CREATE TABLE agent_configurations (...)
```

**Column Naming**: Descriptive with proper prefixes/suffixes
```sql
CREATE TABLE grc_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Regular columns: snake_case
    incident_title VARCHAR(255) NOT NULL,
    risk_category VARCHAR(100) NOT NULL,
    
    -- Boolean: is_, has_, can_ prefix
    is_auto_classified BOOLEAN DEFAULT false,
    has_human_review BOOLEAN DEFAULT false,
    
    -- AI-specific columns
    ai_confidence_score DECIMAL(3,2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1),
    classification_model VARCHAR(100),
    
    -- Foreign keys: referenced_table_id
    tenant_id UUID REFERENCES tenants(id),
    assigned_agent_id UUID REFERENCES agents(id),
    
    -- Timestamps: _at suffix
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    classified_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE
);
```

#### Code Organization - Service Layer Pattern
```typescript
// dataQualityService.ts
export class DataQualityService {
    constructor(
        private grcRepository: IGRCRepository,
        private aiClassifier: IAIClassifier,
        private auditLogger: IAuditLogger
    ) {}

    async processGRCRecord(request: DataQualityRequest): Promise<DataQualityResult> {
        // Validate business rules
        this.validateGRCRecord(request);
        
        // Begin transaction for consistency
        const transaction = await this.db.beginTransaction();
        
        try {
            // AI classification with confidence scoring
            const classification = await this.aiClassifier.classify(request.data);
            
            // Apply confidence threshold rules
            const requiresReview = classification.confidence < this.confidenceThreshold;
            
            // Store results with audit trail
            const result = await this.grcRepository.saveClassification({
                ...classification,
                requiresReview,
                processedAt: new Date()
            }, transaction);
            
            // Log for compliance and audit
            await this.auditLogger.logClassification(result);
            
            await transaction.commit();
            return result;
            
        } catch (error) {
            await transaction.rollback();
            this.logger.error('GRC classification failed', { 
                requestId: request.id, 
                error: error.message 
            });
            throw error;
        }
    }
}
```

#### Security Standards
**Environment Configuration**:
```env
# Never commit .env files - use .env.example as template
DATABASE_URL=postgresql://user:pass@localhost:5432/grc_platform
OPENAI_API_KEY=your-openai-key
TENANT_ENCRYPTION_KEY=your-256-bit-key
JWT_SECRET=your-jwt-secret

# AI Service Configuration
AI_CONFIDENCE_THRESHOLD=0.85
MAX_PROCESSING_TIME_MS=30000
RATE_LIMIT_PER_MINUTE=100
```

**Input Validation for GRC Data**:
```typescript
export class ProcessGRCRecordDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(500)
    title: string;
    
    @IsNotEmpty()
    @IsString()
    @MaxLength(2000)
    description: string;
    
    @IsEnum(['incident', 'risk', 'control'])
    recordType: GRCRecordType;
    
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    expectedConfidence?: number;
}
```

#### Documentation Requirements
**Function Documentation**:
```typescript
/**
 * Processes a GRC record using AI classification with confidence scoring
 * @param {DataQualityRequest} request - The GRC record to process
 * @param {ProcessingOptions} options - Classification options and thresholds
 * @returns {Promise<DataQualityResult>} The classification result with confidence score
 * @throws {AIClassificationError} If AI service is unavailable
 * @throws {ConfidenceThresholdError} If confidence below minimum threshold
 * @example
 * const result = await processGRCRecord({
 *   recordType: 'incident',
 *   data: { title: 'Data breach', description: '...' }
 * });
 * // Returns: { confidence: 0.94, category: 'Privacy Breach', requiresReview: false }
 */
async processGRCRecord(
    request: DataQualityRequest,
    options: ProcessingOptions = {}
): Promise<DataQualityResult>
```

#### Logging Standards for AI Operations
**Structured Logging**:
```json
{
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "INFO",
    "service": "data-quality-service",
    "tenantId": "tenant_123",
    "traceId": "ai-classification-abc123",
    "message": "GRC record successfully classified",
    "aiMetrics": {
        "confidence": 0.94,
        "processingTimeMs": 245,
        "model": "gpt-4",
        "fallbackUsed": false
    },
    "businessMetrics": {
        "category": "Privacy Breach",
        "requiresHumanReview": false,
        "riskLevel": "high",
        "complianceFramework": "GDPR"
    },
    "metadata": {
        "recordId": "INC-2024-001",
        "agentId": "agent_456"
    }
}
```

#### Version Control Standards
**Branch Naming for GRC Features**:
```
main                           # Production-ready code
develop                        # Development branch
feature/ai-confidence-tuning   # AI feature improvements
feature/risk-scoring-model     # New GRC functionality
bugfix/classification-accuracy # AI model fixes
hotfix/compliance-audit-fix    # Emergency compliance fixes
```

**Commit Messages for AI/GRC Work**:
```
feat(ai): Add confidence threshold configuration for risk classification
fix(grc): Resolve incident category mapping for ISO 27001 framework
docs(api): Update data-quality endpoint documentation
test(ai): Add unit tests for AI classification confidence scoring
perf(insights): Optimize agent orchestration for large risk assessments
```

## Working with This Codebase

When continuing development:

### Technical Standards
1. **Follow Enterprise Conventions**: Use established naming patterns and code organization
2. **Maintain Database Consistency**: Follow snake_case for database, camelCase for application layer
3. **Implement Proper Error Handling**: Use structured errors with business context
4. **Include Comprehensive Logging**: Log all AI decisions with confidence scores and business metrics

### GRC Domain Focus  
5. **Maintain Realism**: Ensure all data and metrics reflect actual GRC practices
6. **Prioritize Business Value**: Focus on features that demonstrate clear ROI
7. **Build Trust**: Include transparency features for AI decisions
8. **User-Centered Design**: Design for practicing GRC professionals, not generic users

### Development Workflow
9. **Local Development**: Keep the platform runnable locally for immediate testing
10. **Azure Production Path**: Maintain compatibility with Azure deployment architecture
11. **Multi-Tenant Considerations**: Always consider tenant isolation and security
12. **AI Transparency**: Include explainable AI features and confidence scoring

The platform represents a significant evolution from generic analytics to specialized, AI-powered GRC tools that provide real business value to risk and compliance professionals while following enterprise-grade development standards.