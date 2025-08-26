# MCP Server Test Suite

This directory contains a comprehensive test suite to validate the MCP server and chat UI integration after making changes.

## Test Scripts

### 1. `test-simple.sh` - Quick Validation
**Purpose**: Fast validation that MCP server can retrieve Archer applications.

**What it tests**:
- MCP server health endpoint
- Archer authentication and application retrieval
- Presence of key applications (Risk Register, Obligations, Controls)

**Usage**:
```bash
./test-simple.sh
```

**Expected Output**: 85+ applications found including key GRC applications.

### 2. `test-comprehensive.sh` - Full Integration Test
**Purpose**: Complete end-to-end testing of MCP server and frontend integration.

**What it tests**:
- MCP server health and direct API access
- Frontend accessibility and MCP integration (simulated)
- Record count retrieval for key applications
- Results consistency between direct MCP and frontend access
- Privacy masking pipeline verification

**Usage**:
```bash
./test-comprehensive.sh
```

**Expected Output**: All phases pass with 85 applications and consistent record counts.

### 3. `test-integration.js` - Detailed Node.js Test
**Purpose**: Advanced integration testing with detailed reporting.

**What it tests**:
- Direct MCP server calls with full response validation
- Frontend proxy simulation with privacy masking
- Detailed error reporting and troubleshooting

**Usage**:
```bash
node test-integration.js
```

### 4. `test-e2e.js` - End-to-End Validation
**Purpose**: Complete system validation including privacy protection.

**Usage**:
```bash
node test-e2e.js
```

## Test Configuration

All tests use the following default configuration:
- **MCP Server**: `http://localhost:3001`
- **Frontend**: `http://localhost:3002` 
- **Archer Instance**: `https://hostplus-uat.archerirm.com.au`
- **Test Applications**: Risk Register, Obligations, Controls

## Before Running Tests

1. **Start MCP Server**:
   ```bash
   # In HTTP mode for testing
   npx tsx src/index.ts --port=3001 &
   ```

2. **Start Frontend** (optional):
   ```bash
   cd ../frontend && npm run dev &
   ```

3. **Verify Archer Credentials**: Tests use the working UAT credentials configured in the test scripts.

## Expected Results

### Successful Test Results:
- **Applications**: 85 applications retrieved from Archer
- **Key Applications**: Risk Register, Obligations, and Controls are present
- **Authentication**: Successful login to Archer GRC platform
- **Record Counts**: Applications return record counts (may be 0 for empty apps)
- **Frontend Integration**: Frontend can communicate with MCP server
- **Privacy Masking**: Privacy protection pipeline is functional

### Test Output Interpretation:

#### ✅ All Tests Passed
```
🎉 ALL TESTS PASSED - System is working correctly!
```
**Meaning**: MCP server is fully functional and ready for use.

#### ⚠️ Passed with Warnings
```
⚠️ TESTS PASSED WITH WARNINGS - Core functionality working
```
**Meaning**: Core MCP functionality works, but some non-critical issues detected (e.g., frontend not running, some record retrieval issues).

#### ❌ Tests Failed
```
❌ TESTS FAILED - System needs attention
```
**Meaning**: Critical issues detected that prevent proper operation.

## Troubleshooting

### Common Issues:

1. **MCP Server Not Healthy**:
   - Ensure MCP server is running: `npx tsx src/index.ts --port=3001`
   - Check port 3001 is not in use by another process

2. **Authentication Failures**:
   - Verify Archer credentials in test scripts
   - Check network connectivity to Archer UAT environment
   - Ensure SSL certificate bypass is working for UAT

3. **No Applications Found**:
   - Check Archer instance URL and credentials
   - Verify MCP server can reach external URLs
   - Check for API changes in Archer platform

4. **Frontend Not Accessible**:
   - Start frontend development server: `npm run dev`
   - Verify frontend is running on port 3002
   - This is often a warning, not a critical failure

5. **Record Count Issues**:
   - Some applications may legitimately have 0 records in UAT
   - Check specific application names match Archer configuration
   - Verify OData ContentAPI endpoints are accessible

## When to Run Tests

### Required Testing Scenarios:
1. **After MCP Server Changes**: Always run `test-simple.sh` minimum
2. **After Frontend Changes**: Run `test-comprehensive.sh`
3. **After Archer Integration Changes**: Run full test suite
4. **Before Production Deployment**: Run all tests
5. **After Environment Changes**: Verify configuration with tests

### Integration with CI/CD:
Tests can be integrated into automated pipelines:
```bash
# Quick validation in CI
./test-simple.sh && echo "MCP validation passed"

# Full validation for deployment
./test-comprehensive.sh && echo "Ready for deployment"
```

## Test Data and Privacy

Tests use UAT environment data and apply privacy masking validation. No production data is accessed during testing.

The test suite validates that:
- Raw data flows correctly from Archer to MCP server
- Privacy masking is applied correctly in the frontend
- Masked data maintains proper structure for LLM consumption

## Extending Tests

To add new test scenarios:
1. Add test functions to existing scripts
2. Update expected results documentation
3. Consider adding new applications to test coverage
4. Maintain backward compatibility with existing test expectations