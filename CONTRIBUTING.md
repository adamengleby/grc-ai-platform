# Contributing to GRC AI Platform

Thank you for your interest in contributing to the GRC AI Platform! This document provides guidelines for contributing to our multi-tenant SaaS platform for AI-powered GRC extensions.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Contribution Guidelines](#contribution-guidelines)
- [Security Considerations](#security-considerations)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Review Process](#review-process)
- [Release Process](#release-process)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of background, experience level, or personal characteristics.

### Expected Behavior

- Use welcoming and inclusive language
- Respect differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community and platform
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, trolling, or discriminatory language
- Personal attacks or insults
- Public or private harassment
- Publishing others' private information without permission
- Any conduct that would be inappropriate in a professional setting

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 18+** installed
- **npm 9+** for package management
- **Git** for version control
- **Azure CLI** for Azure integration (optional)
- **Docker** for containerization (optional)

### Development Environment Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/grc-ai-platform.git
   cd grc-ai-platform
   ```

2. **Install dependencies**:
   ```bash
   npm run install:all
   ```

3. **Copy environment configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Run development servers**:
   ```bash
   npm run dev
   ```

5. **Verify setup**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - MCP Server: http://localhost:3002

### Project Structure

```
grc-ai-platform/
├── packages/
│   ├── frontend/          # React frontend application
│   ├── backend/           # Node.js backend API
│   ├── mcp-server/        # MCP server implementation
│   └── shared/            # Shared utilities and types
├── docs/                  # Documentation
├── configs/               # Environment configurations
├── .azure/                # Azure DevOps pipelines
├── .github/               # GitHub workflows
└── docker/                # Docker configurations
```

## Development Process

### Branching Strategy

We use a modified Git Flow branching strategy:

- **`main`**: Production-ready code
- **`develop`**: Integration branch for features
- **`feature/*`**: Feature development branches
- **`hotfix/*`**: Critical bug fixes
- **`release/*`**: Release preparation branches

### Workflow

1. **Create Feature Branch**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Development**:
   - Write code following our standards
   - Add tests for new functionality
   - Update documentation as needed
   - Run tests and linting locally

3. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

4. **Push and Create PR**:
   ```bash
   git push origin feature/your-feature-name
   # Create pull request via GitHub/Azure DevOps
   ```

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types:
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **security**: Security-related changes

#### Examples:
```
feat(auth): add multi-factor authentication
fix(api): resolve tenant isolation issue
docs(api): update authentication endpoints
security(vault): rotate encryption keys
```

## Contribution Guidelines

### Code Quality Standards

#### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Maintain 80%+ test coverage
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

#### Security Requirements
- Never commit secrets or credentials
- Validate all inputs and sanitize outputs
- Follow OWASP security guidelines
- Implement proper error handling
- Use parameterized queries for database operations

#### Multi-Tenant Considerations
- Always validate tenant isolation
- Include `tenantId` in all data operations
- Test cross-tenant access scenarios
- Document tenant-specific behavior

### Performance Guidelines

- **API Response Times**: < 200ms for standard operations
- **Database Queries**: Use efficient indexing and pagination
- **Caching**: Implement appropriate caching strategies
- **Memory Usage**: Monitor and optimize memory consumption
- **Monitoring**: Add telemetry for performance tracking

### Accessibility Standards

- Follow WCAG 2.1 AA guidelines
- Ensure keyboard navigation support
- Provide proper ARIA labels and roles
- Test with screen readers
- Maintain color contrast ratios

## Security Considerations

### Security Review Process

All contributions undergo security review:

1. **Automated Scanning**: CI/CD pipelines run security scans
2. **Code Review**: Security-focused code review
3. **Penetration Testing**: For significant changes
4. **Compliance Validation**: Ensure regulatory compliance

### Security Best Practices

#### Authentication & Authorization
- Use Azure AD B2C for authentication
- Implement proper RBAC checks
- Validate JWT tokens correctly
- Handle session management securely

#### Data Protection
- Encrypt sensitive data at rest and in transit
- Implement field-level encryption where needed
- Use Azure Key Vault for secrets management
- Follow data classification guidelines

#### Input Validation
- Validate all user inputs
- Sanitize outputs to prevent XSS
- Use parameterized queries for SQL
- Implement rate limiting

#### Audit Logging
- Log all security-relevant events
- Include sufficient context for investigations
- Ensure logs are tamper-evident
- Follow data retention policies

### Vulnerability Reporting

If you discover a security vulnerability:

1. **DO NOT** create a public issue
2. Email security@grc-ai-platform.com
3. Include detailed reproduction steps
4. Allow 24 hours for acknowledgment
5. Work with our security team on disclosure

## Testing Requirements

### Test Coverage Requirements

- **Minimum Coverage**: 80% overall
- **Security Code**: 95% coverage required
- **New Features**: 90% coverage required
- **Bug Fixes**: Include regression tests

### Test Types

#### Unit Tests
```bash
npm run test
npm run test:coverage
```

#### Integration Tests
```bash
npm run test:integration
```

#### Security Tests
```bash
npm run test:security
```

#### Multi-Tenant Tests
```bash
npm run test:multi-tenant
```

#### Performance Tests
```bash
npm run test:performance
```

### Testing Guidelines

- Write tests before implementing features (TDD)
- Test both positive and negative scenarios
- Include edge cases and error conditions
- Mock external dependencies appropriately
- Test tenant isolation thoroughly

## Documentation

### Required Documentation

#### Code Documentation
- JSDoc comments for all public APIs
- Inline comments for complex logic
- README files for each package
- Type definitions with descriptions

#### Architecture Documentation
- Update relevant architecture documents
- Include sequence diagrams for new flows
- Document security implications
- Update API specifications

#### User Documentation
- Update user guides for new features
- Include screenshots and examples
- Test all documentation steps
- Ensure accessibility of documentation

### Documentation Standards

- Use clear, concise language
- Include practical examples
- Keep documentation up-to-date
- Follow established templates
- Test all code examples

## Review Process

### Pull Request Requirements

Before submitting a pull request:

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation is updated
- [ ] Security implications are documented
- [ ] Tenant isolation is maintained
- [ ] Performance impact is considered

### Review Checklist

Reviewers will check:

- [ ] **Functionality**: Feature works as intended
- [ ] **Security**: No security vulnerabilities introduced
- [ ] **Performance**: Acceptable performance impact
- [ ] **Testing**: Adequate test coverage
- [ ] **Documentation**: Documentation is complete and accurate
- [ ] **Multi-Tenancy**: Proper tenant isolation maintained
- [ ] **Compliance**: Regulatory requirements met

### Review Process

1. **Automated Checks**: CI/CD pipeline validates code
2. **Security Scan**: Automated security scanning
3. **Code Review**: Peer review by team members
4. **Security Review**: Security team review for sensitive changes
5. **Approval**: Required approvals before merge

## Release Process

### Release Types

- **Major Release**: Breaking changes or major features
- **Minor Release**: New features, backwards compatible
- **Patch Release**: Bug fixes and security updates
- **Hotfix**: Critical security or bug fixes

### Release Schedule

- **Major Releases**: Quarterly
- **Minor Releases**: Monthly
- **Patch Releases**: As needed
- **Hotfixes**: Immediate for critical issues

### Release Checklist

- [ ] All tests pass
- [ ] Security scan passes
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version numbers bumped
- [ ] Release notes prepared
- [ ] Deployment tested in staging

## Getting Help

### Support Channels

- **General Questions**: Create a GitHub issue
- **Development Help**: Join our Slack channel
- **Security Issues**: Email security@grc-ai-platform.com
- **Documentation**: Check our docs at docs.grc-ai-platform.com

### Office Hours

Our maintainers hold office hours:
- **When**: Thursdays 2-3 PM UTC
- **Where**: Video call (link in Slack)
- **What**: Questions, feedback, contribution planning

## Recognition

We value all contributions and recognize contributors through:

- **Contributor List**: Listed in CHANGELOG.md
- **GitHub Recognition**: Contributor badges and highlights
- **Community Highlights**: Featured in newsletters
- **Conference Opportunities**: Speaking opportunities at events

## Legal

### Contributor License Agreement

By contributing to this project, you agree that:

1. Your contributions are your original work
2. You have the right to submit your contributions
3. Your contributions may be distributed under the project license
4. You grant us rights to use your contributions

### Intellectual Property

- All contributions become part of the project
- Original copyright is retained by contributors
- Contributions are licensed under the project license
- No contribution should include third-party IP without proper licensing

---

Thank you for contributing to the GRC AI Platform! Together, we're building the future of AI-powered governance, risk, and compliance solutions.

For questions about this contributing guide, please contact: contributors@grc-ai-platform.com