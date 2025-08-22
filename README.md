# GRC Multi-Tenant Dashboard

A comprehensive React dashboard for a multi-tenant SaaS platform that integrates AI-powered Governance, Risk & Compliance (GRC) tools with MCP (Model Context Protocol) server capabilities.

## Architecture Overview

This dashboard demonstrates proper integration with the multi-tenant platform architecture described in the documentation, featuring:

- **Azure AD B2C Authentication**: Tenant-aware authentication with role-based access control
- **Multi-Tenant Isolation**: Complete data isolation between tenants with tenant-scoped functionality
- **MCP Server Integration**: Natural language interface for GRC queries using tenant-approved MCP tools
- **Role-Based Dashboards**: Different views for Tenant Owners, Agent Users, and Auditors
- **Platform Compliance**: Integrated audit logging, compliance reporting, and regulatory frameworks

## Key Features

### 🔐 Authentication & Authorization
- Azure AD B2C integration (mocked for demo)
- Multi-tenant authentication with tenant context
- Role-based access control (Tenant Owner, Agent User, Auditor, Compliance Officer)
- Tenant switching capabilities for multi-tenant users

### 🎛️ Dashboard Views
- **Executive Dashboard**: Strategic overview with risk scores, compliance metrics, and cost analysis
- **Operational Dashboard**: Agent management, query monitoring, and resource usage
- **Audit Dashboard**: Compliance status, audit trails, and regulatory reporting

### 🤖 MCP Integration
- Tenant-scoped AI agents with configurable MCP tools
- Natural language query interface for GRC questions
- Real-time confidence scoring and evidence tracking
- Compliance flag detection and regulatory alerts

### 📊 Data Visualization
- Interactive charts for risk trends and compliance metrics
- Real-time widgets showing tenant-specific data
- Health monitoring for MCP server connections
- Usage analytics and cost tracking

### 🛡️ Compliance & Audit
- Support for ISO 27001, CPS 230, SOC 2, and GDPR frameworks
- Detailed audit trail with platform-integrated logging
- Compliance finding management and remediation tracking
- Automated compliance scoring and reporting

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **State Management**: Zustand for authentication and dashboard state
- **Styling**: Tailwind CSS with custom design system
- **Charts**: Recharts for data visualization
- **Routing**: React Router for navigation
- **Build Tool**: Vite for fast development and building

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd grc-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** to `http://localhost:3000`

### Demo Users

The application includes several demo users to showcase different roles and tenant access:

| Email | Name | Role | Tenant | Description |
|-------|------|------|--------|-------------|
| `user1@acme.com` | Sarah Chen | Tenant Owner | ACME Corporation | Full administrative access with all MCP tools |
| `analyst@acme.com` | Mike Johnson | Agent User | ACME Corporation | Operational dashboard with agent management |
| `audit@acme.com` | Lisa Wang | Auditor | ACME Corporation | Read-only audit and compliance access |
| `owner@fintech.com` | David Smith | Tenant Owner | FinTech Solutions | Limited tenant with basic MCP tools |

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── auth/            # Authentication components
│   ├── dashboard/       # Dashboard-specific components
│   ├── layout/          # Layout components (header, sidebar)
│   ├── mcp/             # MCP server testing interface
│   └── ui/              # Base UI components (Button, Card, etc.)
├── lib/                 # Utility libraries and services
├── pages/               # Page components for routing
├── store/               # Zustand state management
├── styles/              # Global CSS and Tailwind configuration
└── types/               # TypeScript type definitions
```

## Key Components

### Authentication System (`src/lib/auth.ts`)
- Mock Azure AD B2C authentication service
- JWT token handling with tenant context
- Role-based permission checking
- Multi-tenant user management

### Dashboard Layout (`src/components/layout/`)
- Responsive sidebar with role-based navigation
- Tenant selector and user management in header
- Dark/light theme support
- Real-time notifications and alerts

### MCP Test Interface (`src/components/mcp/McpTestInterface.tsx`)
- Natural language chat interface for GRC queries
- Agent selection with tenant-scoped tools
- Confidence scoring and evidence display
- Compliance flag detection and alerts

### State Management (`src/store/`)
- Authentication state with tenant context
- Dashboard metrics and real-time data
- Type-safe Zustand stores with subscriptions

## Platform Integration

This dashboard properly integrates with the multi-tenant SaaS platform by:

### 1. **Tenant Isolation**
- All data and functionality is scoped to the authenticated tenant
- MCP tools are filtered based on tenant's approved server list
- Usage quotas and metrics are tenant-specific

### 2. **Azure AD B2C Integration**
- JWT tokens contain `tenantId` claims for proper tenant binding
- Role-based access control matches platform RBAC model
- Multi-factor authentication support for Tenant Owners

### 3. **MCP Server Compliance**
- Tools are sourced from platform-approved MCP registry
- Audit logging for all MCP tool executions
- Rate limiting and cost controls per tenant

### 4. **Platform API Gateway**
- All backend calls would route through Azure APIM
- Proper correlation IDs for distributed tracing
- Error handling that matches platform error model

## Building for Production

```bash
npm run build
```

The build artifacts will be in the `dist/` directory, ready for deployment to Azure Static Web Apps or App Service.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests (when configured)

## Environment Configuration

For production deployment, you would configure:

- Azure AD B2C tenant and application settings
- API Gateway endpoints for backend services
- Application Insights for telemetry
- Key Vault references for sensitive configuration

## Security Considerations

- All sensitive data (API keys, secrets) stored in Azure Key Vault
- HTTPS-only communication in production
- Content Security Policy (CSP) headers
- Cross-Origin Resource Sharing (CORS) properly configured
- Session management with secure token storage

## Compliance Features

- **Audit Logging**: All user actions logged with correlation IDs
- **Data Retention**: Configurable retention policies per framework
- **Access Controls**: Granular permissions based on user roles
- **Encryption**: Data encrypted in transit and at rest
- **Regulatory Reporting**: Automated compliance reports for audits

## Future Enhancements

- WebSocket integration for real-time updates
- Advanced analytics and machine learning insights
- Mobile-responsive improvements
- Additional compliance frameworks
- Enhanced MCP tool marketplace
- Automated remediation workflows

This dashboard serves as a comprehensive example of how to build a multi-tenant SaaS application that properly integrates with modern AI platforms while maintaining strict compliance and security standards.