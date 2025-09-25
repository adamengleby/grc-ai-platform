# API Documentation

This directory contains comprehensive API documentation for the GRC AI Platform.

## Overview

The GRC AI Platform provides RESTful APIs for multi-tenant SaaS operations, AI agent management, and MCP server integration.

## API Categories

### Core Platform APIs
- **Authentication & Authorization** - Multi-tenant authentication with Azure AD B2C
- **Tenant Management** - Tenant onboarding, configuration, and isolation
- **User Management** - User roles, permissions, and tenant associations

### AI & Agent APIs
- **Agent Lifecycle** - Create, configure, and manage AI agents
- **LLM Configuration** - Manage both platform and BYO LLM settings
- **AI Insights** - Retrieve AI-generated insights and analytics

### MCP Integration APIs
- **MCP Registry** - Global registry of approved MCP servers
- **MCP Configuration** - Tenant-specific MCP server enablement
- **Tool Management** - Manage available tools and their configurations

### Data & Analytics APIs
- **GRC Data** - Access governance, risk, and compliance data
- **Audit Logs** - Comprehensive audit trail access
- **Analytics** - Platform usage and performance metrics

## API Standards

All APIs follow enterprise-grade standards:

- **RESTful Design** - Standard HTTP methods and status codes
- **JSON Format** - Consistent JSON request/response format
- **Authentication** - Bearer token authentication with JWT
- **Authorization** - Role-based access control (RBAC)
- **Rate Limiting** - Per-tenant and per-user rate limits
- **Versioning** - API versioning through headers
- **Pagination** - Cursor-based pagination for large datasets
- **Error Handling** - Standardized error response format

## Security Features

- **Multi-tenant Isolation** - Strict data isolation between tenants
- **Encryption** - End-to-end encryption for sensitive data
- **Audit Logging** - Comprehensive audit trails for compliance
- **Input Validation** - Strict input validation and sanitization
- **DLP Integration** - Data Loss Prevention policy enforcement

## Getting Started

1. Review the [Authentication Guide](./authentication.md)
2. Explore the [Core APIs](./core/)
3. Check out the [Integration Examples](./examples/)
4. Test with the [Postman Collection](./postman/)

## API Reference Files

- `authentication.md` - Authentication and authorization
- `core/` - Core platform API endpoints
- `agents/` - AI agent management APIs
- `mcp/` - MCP server integration APIs
- `analytics/` - Data and analytics APIs
- `webhooks/` - Webhook configurations and events
- `examples/` - Code examples and use cases
- `postman/` - Postman collection for testing

## Support

For API support and questions:
- Review the [Developer Guide](../guides/developer-guide.md)
- Check the [FAQ](../guides/faq.md)
- Contact: api-support@grc-ai-platform.com