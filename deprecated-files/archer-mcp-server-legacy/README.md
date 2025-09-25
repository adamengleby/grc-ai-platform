# Archer MCP Server

A Model Context Protocol (MCP) server for integrating with Archer GRC platform, featuring comprehensive data transformation, privacy protection, and support for both applications and questionnaires.

## Features

- **Universal Data Transformation**: Automatic alias → display name conversion
- **Privacy Protection**: Built-in data masking and protection
- **Questionnaire Support**: Full integration with Archer questionnaires alongside applications
- **Field Retrieval**: Get fields for applications and questionnaires
- **Security Events**: Support for security events reporting
- **Level-based URLs**: Automatic ContentAPI URL generation and validation

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ArcherMCPServer
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your Archer configuration
```

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

## Configuration

Create a `.env` file with the following variables:

```env
ARCHER_BASE_URL=https://your-archer-instance.com
ARCHER_INSTANCE_NAME=your-instance
ARCHER_USERNAME=your-username
ARCHER_PASSWORD=your-password
ARCHER_USER_DOMAIN=your-domain
```

## Available MCP Tools

- `get_archer_applications` - List all active applications and questionnaires
- `get_application_fields` - Get fields for a specific application
- `search_archer_records` - Search and retrieve records from applications
- `get_archer_stats` - Get statistics and insights
- `report_security_event` - Report security events

## API Endpoints Supported

- `/api/core/system/application` - Applications
- `/api/core/system/questionnaire` - Questionnaires
- `/api/core/system/level` - Level mappings
- `/api/core/system/level/{id}/field` - Field definitions
- `/api/core/system/AccessControlReports/SecurityEvents` - Security events

## Development

### Building
```bash
npm run build
```

### Testing
```bash
node test-server.js
node test-privacy.js
node verify-masking.js
```

## Privacy & Security

This server includes comprehensive privacy protection:
- Automatic data masking for sensitive information
- Configurable privacy levels
- Secure credential handling
- No sensitive data logging

## Architecture

- **TypeScript** - Type-safe development
- **Axios** - HTTP client for Archer API
- **Privacy Protector** - Built-in data masking
- **Universal Data Transformer** - Data normalization

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

---

Built with [Claude Code](https://claude.ai/code)