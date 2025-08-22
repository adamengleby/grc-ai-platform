# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Workflow
```bash
# Build TypeScript to JavaScript
npm run build

# Development with hot reload
npm run dev

# Start production server  
npm start

# Manual testing
node test-server.js        # Basic connectivity test
node test-privacy.js       # Privacy masking validation
node verify-masking.js     # Comprehensive masking verification
node test-name-masking.js  # Name detection patterns test
```

### Environment Setup
```bash
# Copy example environment file
cp .env.example .env
# Edit .env with actual Archer credentials and configuration
```

## Core Architecture

This is an MCP (Model Context Protocol) server that provides secure integration with RSA Archer GRC platform. The architecture consists of three main components working together:

### 1. ArcherAPIClient (src/index.ts)
The central API client that handles all Archer interactions:
- **Session Management**: Handles login/logout and token management with automatic session renewal
- **Dual Data Support**: Supports both Applications (`/api/core/system/application`) and Questionnaires (`/api/core/system/questionnaire`) 
- **Level Mapping System**: Maps Archer applications/questionnaires to their Level aliases for URL generation
- **Caching Strategy**: Multi-level caching (applications, fields, levels) to minimize API calls
- **ContentAPI URL Generation**: Automatically constructs and validates Level-based URLs for direct Archer access

### 2. ArcherDataTransformer (src/index.ts)
Universal data transformation engine that normalizes Archer data:
- **Alias → Display Name Conversion**: Converts all Archer field aliases to human-readable display names
- **Smart Field Type Detection**: Automatically detects and formats field types (financial, dates, HTML, boolean, etc.)
- **Data Quality Analysis**: Provides population statistics, empty field detection, and data completeness metrics
- **Multiple View Types**: Supports summary, detailed, and full data views with configurable field prioritization

### 3. PrivacyProtector (src/privacy-protector.ts)
Comprehensive data protection system:
- **Multi-Level Masking**: Three levels (light/moderate/strict) with different exposure levels
- **Pattern-Based Detection**: Automatically detects emails, phone numbers, names, GUIDs, SSNs, credit cards
- **Smart Name Detection**: Advanced name pattern recognition including "Last, First", "First Last", "First M. Last" formats
- **Field Name Analysis**: Identifies sensitive fields by name patterns (owner, manager, contact, person, etc.)
- **Tokenization Support**: Optional reversible tokenization for sensitive data
- **Configurable Protection**: Environment-driven configuration with custom sensitive field support

## Key Integration Points

### MCP Tools Exposed
- `get_archer_applications`: Lists both applications AND questionnaires with Level mappings
- `get_application_fields`: Retrieves field definitions for applications
- `search_archer_records`: Searches with universal data transformation and privacy protection
- `get_archer_stats`: Provides data quality analysis and statistics
- `report_security_event`: Reports security events to Archer's AccessControlReports

### Data Flow Pattern
1. **API Call** → ArcherAPIClient handles authentication and makes Archer API calls
2. **Level Mapping** → Resolves application/questionnaire IDs to Level aliases and ContentAPI URLs  
3. **Data Transformation** → ArcherDataTransformer converts aliases to display names and formats data
4. **Privacy Protection** → PrivacyProtector masks sensitive information before returning to MCP client
5. **Response** → Final response includes both raw data and privacy-protected versions

### Environment Configuration
Critical environment variables for different deployment scenarios:
- **Archer Connection**: `ARCHER_BASE_URL`, `ARCHER_INSTANCE`, `ARCHER_USERNAME`, `ARCHER_PASSWORD`
- **Privacy Settings**: `ENABLE_PRIVACY_MASKING`, `MASKING_LEVEL` (light/moderate/strict), `CUSTOM_SENSITIVE_FIELDS`
- **Optional Features**: `ENABLE_TOKENIZATION`, `PRIVACY_KEY` for reversible tokenization

## Code Architecture Notes

### Questionnaire vs Application Handling
The system treats questionnaires and applications similarly but with key differences:
- Applications use `LevelId` field, questionnaires use `TargetLevelId`
- Both map to Level aliases through the same Level mapping system
- URL generation pattern is identical: `${baseUrl}/GenericContent/Content.aspx?instanceguid=${guid}&moduleId=${moduleId}`

### Error Handling Strategy
- All API calls include comprehensive error logging with response status and data
- Privacy protection is applied to error responses to prevent sensitive data leakage
- Session management includes automatic retry logic for expired sessions

### Caching Strategy
- **Application Cache**: Populated on first access, filtered for active status only
- **Field Cache**: Per-application field mappings cached indefinitely 
- **Level Cache**: Critical for URL generation, cached across all operations
- **Privacy Token Store**: In-memory storage for tokenization (if enabled)

### TypeScript Interfaces
Key interfaces define the data contracts:
- `ArcherApplication` / `ArcherQuestionnaire`: Core Archer objects
- `FieldMapping`: Alias-to-display-name mappings
- `TransformationOptions`: Controls data transformation behavior
- `PrivacyConfig`: Configures data protection levels
- `SecurityEventRequest`: Structure for security event reporting

## Testing Strategy

The repository includes specialized test files for different aspects:
- `test-server.js`: Basic MCP connectivity and Archer authentication
- `test-privacy.js`: Privacy protection validation with sample data
- `verify-masking.js`: Comprehensive masking pattern verification  
- `test-name-masking.js`: Name detection algorithm validation

Each test file can be run independently and includes detailed output for debugging privacy protection behavior.