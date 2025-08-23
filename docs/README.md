# GRC AI Platform Documentation

Welcome to the comprehensive documentation for the GRC AI Platform - a multi-tenant SaaS solution for AI-powered GRC extensions built on Microsoft Azure.

## Quick Start

- **New Developers**: Start with [Development Guides](./guides/README.md) → [Getting Started](./guides/getting-started.md)
- **System Architects**: Begin with [Architecture Documentation](./architecture/README.md) → [Foundation Architecture](./architecture/01-foundation.md)
- **API Developers**: Check [API Documentation](./api/README.md) and [Archer API References](./Archer%20API%20References/archer-api-reference.md)

## Documentation Structure

### 📚 [Architecture Documentation](./architecture/README.md)
Comprehensive architectural documentation covering the multi-tenant SaaS platform design, security model, and technical specifications.

**Key Documents:**
- [Agent Architecture](./architecture/agent-architecture.md) - AI agent system design and implementation patterns
- [Foundation Architecture](./architecture/01-foundation.md) - Core multi-tenant principles and Azure architecture
- [Phase 2 Architecture](./architecture/phase2-architecture.md) - Current implementation architecture

### 📋 [Developer Guides](./guides/README.md)
Practical guides for developers, administrators, and operators working with the platform.

**Key Documents:**
- [UI Design Guidelines](./guides/ui-design-guidelines.md) - UI/UX design patterns and component guidelines
- [Getting Started](./guides/getting-started.md) - Quick start guide for new developers
- [Development Environment Setup](./guides/development-setup.md) - Local development setup

### 🔌 [API Documentation](./api/README.md)
API specifications, integration guides, and reference documentation for the platform APIs.

**Key Documents:**
- [Archer API Reference](./Archer%20API%20References/archer-api-reference.md) - RSA Archer GRC Platform API documentation

## Platform Overview

The GRC AI Platform provides:

### 🏢 **Multi-Tenant Architecture**
- Complete tenant isolation with Azure AD B2C
- Scalable multi-tenant data partitioning
- Tenant-specific AI agent configurations

### 🤖 **AI Agent Management**
- Model Context Protocol (MCP) integration
- Intelligent agent orchestration
- Privacy-aware data processing

### 🔒 **Enterprise Security**
- Zero-trust security model
- Comprehensive audit logging
- Compliance with ISO27001, SOC2, CPS230

### ⚡ **Azure-Native Platform**
- Serverless architecture with Azure Functions
- Cosmos DB for scalable data storage
- Integrated monitoring with Application Insights

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 18+ with TypeScript
- **Frontend**: React with Vite
- **Database**: Azure Cosmos DB
- **Authentication**: Azure AD B2C
- **AI Integration**: Model Context Protocol (MCP)

### Azure Services
- **Compute**: App Service, Azure Functions
- **Storage**: Cosmos DB, Blob Storage, Key Vault
- **Monitoring**: Application Insights, Log Analytics
- **Security**: Azure Security Center, Azure AD B2C

## Getting Started

### For Developers
1. Read the [Getting Started Guide](./guides/getting-started.md)
2. Set up your [Development Environment](./guides/development-setup.md)
3. Review [UI Design Guidelines](./guides/ui-design-guidelines.md)
4. Explore the [Architecture Documentation](./architecture/README.md)

### For Architects
1. Start with [Foundation Architecture](./architecture/01-foundation.md)
2. Review [Agent Architecture](./architecture/agent-architecture.md)
3. Understand [Phase 2 Architecture](./architecture/phase2-architecture.md)
4. Explore [API Documentation](./api/README.md)

### For Integration Developers
1. Review [API Documentation](./api/README.md)
2. Check [Archer API References](./Archer%20API%20References/archer-api-reference.md)
3. Explore [MCP Integration Guides](./guides/mcp-integration.md)
4. Review [Security Best Practices](./guides/security-best-practices.md)

## Key Concepts

### Multi-Tenancy
Each tenant operates in complete isolation with:
- Dedicated data partitions
- Separate Key Vault instances
- Isolated AI agent configurations
- Tenant-specific audit trails

### AI Agent Architecture
The platform features intelligent AI agents that:
- Use MCP tools for data integration
- Provide specialized GRC analysis (risk, compliance, controls)
- Support cross-agent collaboration
- Maintain privacy through data masking

### Security & Compliance
Built with enterprise security in mind:
- Encryption at rest and in transit
- Comprehensive audit logging
- Privacy-aware data processing
- Regulatory compliance frameworks

## Contributing

We welcome contributions to our documentation:

1. Follow our [Documentation Standards](./guides/documentation-standards.md)
2. Create clear, actionable content
3. Include practical examples
4. Test all code samples
5. Update relevant index files

## Support

For questions or support:
- **Documentation Issues**: Create an issue in this repository
- **Technical Support**: Contact the development team
- **Security Issues**: Follow our [Security Policy](../SECURITY.md)

## License

This documentation is part of the GRC AI Platform project. See the [LICENSE](../LICENSE) file for details.

---

**Last Updated**: January 2025  
**Next Review**: April 2025