# Archer Field Caching System Test Suite

This directory contains comprehensive tests for the Archer field caching system, validating the complete data flow from applications to field definitions to record translation.

## Test Structure

### Core Test Files

1. **`archer-field-caching.test.ts`** - Unit tests for basic caching functionality
2. **`archer-workflow-integration.test.ts`** - Integration tests for complete workflows
3. **`archer-performance-edge-cases.test.ts`** - Performance and edge case testing
4. **`test-setup.ts`** - Common test utilities, mock data, and setup functions

## System Under Test

The Archer field caching system implements the following workflow:

```
1. Applications Request → /api/core/system/application
2. Cache Applications → Filter active applications (Status: 1)
3. Level Request → /api/core/system/level/module/{applicationId}
4. Field Definitions → /api/core/system/fielddefinition/level/{levelId}
5. Field Mapping → alias_name → display_name (active fields only)
6. Record Translation → Translate records for LLM processing
7. Reverse Translation → display_name → alias_name (for updates)
```

## Test Coverage

### ✅ Application Caching (`archer-field-caching.test.ts`)
- **Fresh Data Retrieval**: Tests initial API calls to fetch applications
- **Cache Hit Performance**: Validates subsequent calls use cached data
- **Active Filter Logic**: Ensures only active applications (Status: 1) are cached
- **Cache Invalidation**: Tests cache clearing and rebuilding
- **Empty Response Handling**: Graceful handling of empty API responses

### ✅ Field Definition Caching
- **Field Mapping Creation**: Tests alias → display name mapping creation
- **Per-Application Caching**: Validates separate caches per application
- **Active Field Filtering**: Only active fields included in mappings
- **Cache Persistence**: Field mappings persisted across multiple requests

### ✅ Record Translation (`archer-workflow-integration.test.ts`)
- **Forward Translation**: alias_name → display_name for LLM processing
- **Reverse Translation**: display_name → alias_name for record updates
- **Unknown Field Preservation**: Unknown fields passed through unchanged
- **Inactive Field Filtering**: Inactive field data filtered during translation

### ✅ Complete Workflow Integration
- **End-to-End Flow**: Applications → Levels → Fields → Translation
- **Multi-Application Support**: Different field schemas per application
- **Cache Coordination**: Proper caching at each workflow step
- **Data Integrity**: Values preserved through complete translation cycle

### ✅ Performance Testing (`archer-performance-edge-cases.test.ts`)
- **Large Dataset Handling**: 100+ applications with 50+ fields each
- **Cache Performance Benefits**: Quantified speed improvements from caching
- **Batch Processing**: Efficient translation of 1000+ records
- **Memory Management**: Memory usage tracking and cleanup
- **Concurrent Access**: Multiple simultaneous cache operations

### ✅ Error Handling & Edge Cases
- **Network Failures**: Graceful handling of API timeouts
- **Data Corruption**: Malformed API response handling
- **Missing Data**: Applications/fields with no data
- **Concurrent Access**: Thread-safe cache operations
- **Memory Leaks**: Proper cache cleanup and memory management

## Key Test Scenarios

### Application Caching Workflow
```typescript
// Test validates this flow:
1. GET /api/core/system/application
2. Filter: item.IsSuccessful && item.RequestedObject
3. Extract: item.RequestedObject
4. Filter: app.Status === 1 (active only)
5. Cache: applicationCache = activeApplications
6. Subsequent calls: return cached data
```

### Field Definition Resolution
```typescript
// Test validates this flow:
1. Find application by name/ID
2. GET /api/core/system/level/module/{applicationId}
3. For each level: GET /api/core/system/fielddefinition/level/{levelId}
4. Filter: field.Status === 1 || field.IsActive === true
5. Map: { [field.Alias]: field.Name } (active fields only)
6. Cache: fieldMappingCache.set(applicationName, mapping)
```

### Record Translation Process
```typescript
// Forward translation (for LLM processing):
{
  "risk_title": "Data Breach Risk",     // Alias name (from API)
  "risk_score": 8.5
}
↓ Translation using field mapping
{
  "Risk Title": "Data Breach Risk",    // Display name (for humans)
  "Risk Score": 8.5
}

// Reverse translation (for record updates):
{
  "Risk Title": "Updated Risk Title"   // Display name (from user)
}
↓ Reverse translation
{
  "risk_title": "Updated Risk Title"   // Alias name (for API)
}
```

## Running the Tests

### Prerequisites
```bash
# Install dependencies
cd /path/to/mcp-server
npm install

# Ensure Vitest is configured (already in package.json)
```

### Run All Tests
```bash
npm run test
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test archer-field-caching.test.ts

# Integration tests only  
npm run test archer-workflow-integration.test.ts

# Performance tests only
npm run test archer-performance-edge-cases.test.ts
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode (Development)
```bash
npx vitest --watch
```

## Test Configuration

### Mock Data Structure
Tests use realistic mock data that matches actual Archer API responses:

```typescript
// Applications response format
{
  IsSuccessful: true,
  RequestedObject: {
    Id: 606,
    Name: 'Risk Management',
    Status: 1,        // 1 = Active, 0 = Inactive
    Type: 1,
    ModuleId: 606
  }
}

// Field definitions response format
{
  Id: 1001,
  Name: 'Risk Title',           // Display name
  Alias: 'risk_title',          // API field name
  Type: 'Text',
  Status: 1,                    // 1 = Active, 0 = Inactive
  IsActive: true,
  IsRequired: true,
  IsCalculated: false
}
```

### Performance Benchmarks
Current performance expectations (adjust as needed):

- **Application Loading**: < 1 second for 100 applications
- **Field Mapping Creation**: < 500ms for 50+ fields per application  
- **Batch Record Translation**: < 500ms for 1000 records
- **Cache Hit Performance**: > 90% faster than API calls

## Expected Behaviors

### ✅ Caching Requirements Met
- [x] Applications cached after first API call
- [x] Field definitions cached per application
- [x] Only active fields included in mappings
- [x] Cache invalidation works properly
- [x] Memory usage tracked and controlled

### ✅ Translation Requirements Met
- [x] Alias → Display name translation working
- [x] Display name → Alias reverse translation working
- [x] Inactive fields filtered from processing
- [x] Unknown fields preserved during translation
- [x] Data integrity maintained through translation cycle

### ✅ Error Handling Requirements Met  
- [x] Network failures handled gracefully
- [x] Malformed data filtered appropriately
- [x] Missing/empty data handled without errors
- [x] Concurrent access properly managed
- [x] Memory leaks prevented through proper cleanup

## Integration with MCP Server

These tests validate the core caching system that supports the MCP server's Archer integration. The caching system is used by:

1. **`get_archer_applications`** tool - Uses application caching
2. **`get_archer_fields`** tool - Uses field definition caching  
3. **`search_archer_records`** tool - Uses field translation for results
4. **Record update tools** - Use reverse translation for API calls

## Troubleshooting

### Common Test Failures

1. **Cache Not Working**: Check that mock responses match expected format
2. **Translation Errors**: Verify field mappings include expected aliases
3. **Performance Issues**: Check if test data size is appropriate for CI environment
4. **Memory Leaks**: Ensure `clearAllCaches()` called in test cleanup

### Debugging Tips

```typescript
// Enable verbose logging in tests
console.log('Cache stats:', client.getPerformanceMetrics());
console.log('Field mapping:', await client.getFieldMapping(app));
console.log('Translated records:', translatedRecords);
```

### Test Data Validation

```typescript
// Validate test data matches expected format
expect(MOCK_ARCHER_DATA.applications[0]).toHaveProperty('RequestedObject');
expect(MOCK_ARCHER_DATA.fieldDefinitions[408][0]).toHaveProperty('Alias');
```

## Contributing to Tests

### Adding New Test Cases
1. Add test data to `test-setup.ts` if needed
2. Follow existing naming conventions  
3. Include both positive and negative test cases
4. Add performance considerations for large datasets
5. Update this README with new test coverage

### Test Best Practices
- Use descriptive test names that explain the scenario
- Include both happy path and edge cases
- Mock external dependencies (axios calls)
- Clean up resources in `afterEach` hooks
- Use common assertions from `test-setup.ts`

This test suite provides comprehensive validation of the Archer field caching system, ensuring reliable performance for the MCP server's GRC integration capabilities.