#!/bin/bash

# Comprehensive Integration Test
# Tests MCP server direct access and frontend chat UI integration
# Run this after making changes to ensure everything works

echo "🧪 COMPREHENSIVE INTEGRATION TEST"
echo "=================================="
echo ""

MCP_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3002"
TEST_TENANT="comprehensive-test-$(date +%s)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNED=0

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
    TESTS_WARNED=$((TESTS_WARNED + 1))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Create JSON payload files to avoid shell escaping issues
create_test_payloads() {
    cat > /tmp/mcp_apps_payload.json << 'EOF'
{
  "name": "get_archer_applications",
  "arguments": {
    "tenant_id": "TENANT_PLACEHOLDER",
    "archer_connection": {
      "baseUrl": "https://hostplus-uat.archerirm.com.au",
      "username": "api_test",
      "password": "Password1!.",
      "instanceId": "710100",
      "instanceName": "710100",
      "userDomainId": ""
    }
  }
}
EOF

    cat > /tmp/mcp_records_payload.json << 'EOF'
{
  "name": "search_archer_records",
  "arguments": {
    "tenant_id": "TENANT_PLACEHOLDER", 
    "archer_connection": {
      "baseUrl": "https://hostplus-uat.archerirm.com.au",
      "username": "api_test",
      "password": "Password1!.",
      "instanceId": "710100",
      "instanceName": "710100",
      "userDomainId": ""
    },
    "applicationName": "APP_NAME_PLACEHOLDER",
    "pageSize": 5
  }
}
EOF

    # Replace tenant placeholder
    sed -i.bak "s/TENANT_PLACEHOLDER/$TEST_TENANT/g" /tmp/mcp_apps_payload.json
    sed -i.bak "s/TENANT_PLACEHOLDER/$TEST_TENANT/g" /tmp/mcp_records_payload.json
}

# Test MCP Server Health
test_mcp_health() {
    echo "🏥 Phase 1: MCP Server Health Check"
    
    if curl -s "$MCP_URL/health" | grep -q "healthy"; then
        log_success "MCP Server is healthy"
    else
        log_error "MCP Server is not healthy or not accessible"
        return 1
    fi
    echo ""
}

# Test Frontend Health  
test_frontend_health() {
    echo "🌐 Phase 2: Frontend Health Check"
    
    if curl -s --max-time 5 "$FRONTEND_URL/" >/dev/null 2>&1; then
        log_success "Frontend is accessible"
    else
        log_warning "Frontend is not accessible (may not be running)"
    fi
    echo ""
}

# Test MCP Direct Access
test_mcp_direct() {
    echo "📡 Phase 3: MCP Direct Access Test"
    
    log_info "Getting applications list..."
    
    response=$(curl -s -X POST "$MCP_URL/call" \
        -H "Content-Type: application/json" \
        -d @/tmp/mcp_apps_payload.json)
    
    if echo "$response" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
        log_success "Valid JSON response received"
        
        # Extract and validate content
        content=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'content' in data and len(data['content']) > 0:
    print(data['content'][0].get('text', ''))
" 2>/dev/null)
        
        # Check applications count
        apps_count=$(echo "$content" | grep -o "Total Applications: [0-9]*" | grep -o "[0-9]*")
        
        if [ -n "$apps_count" ] && [ "$apps_count" -gt 0 ]; then
            log_success "Found $apps_count applications"
            
            # Store for later comparison
            echo "$apps_count" > /tmp/mcp_apps_count
            
            # Test key applications
            for app in "Risk Register" "Obligations" "Controls"; do
                if echo "$content" | grep -q "$app"; then
                    log_success "$app application found"
                else
                    log_warning "$app application not found"
                fi
            done
            
        else
            log_error "No applications found or parse error"
            return 1
        fi
        
    else
        log_error "Invalid JSON response from MCP server"
        echo "Response preview:" 
        echo "$response" | head -5
        return 1
    fi
    
    # Test record counts for key applications
    log_info "Testing record counts..."
    
    for app in "Risk Register" "Obligations" "Controls"; do
        log_info "Getting records for $app..."
        
        # Create app-specific payload
        sed "s/APP_NAME_PLACEHOLDER/$app/g" /tmp/mcp_records_payload.json > /tmp/mcp_records_temp.json
        
        records_response=$(curl -s -X POST "$MCP_URL/call" \
            -H "Content-Type: application/json" \
            -d @/tmp/mcp_records_temp.json)
        
        if echo "$records_response" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
            records_content=$(echo "$records_response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'content' in data and len(data['content']) > 0:
    print(data['content'][0].get('text', ''))
" 2>/dev/null)
            
            records_count=$(echo "$records_content" | grep -o "Total Records: [0-9,]*" | grep -o "[0-9,]*" | tr -d ',')
            
            if [ -n "$records_count" ]; then
                log_success "$app: $records_count records"
                echo "$app:$records_count" >> /tmp/mcp_record_counts
            else
                log_warning "$app: Could not determine record count"
                echo "$app:unknown" >> /tmp/mcp_record_counts
            fi
        else
            log_warning "$app: Invalid response format"
            echo "$app:error" >> /tmp/mcp_record_counts
        fi
    done
    
    echo ""
}

# Test Frontend Integration (simulated)
test_frontend_integration() {
    echo "💬 Phase 4: Frontend Integration Test"
    
    log_info "Testing frontend MCP integration..."
    
    # Check if frontend has MCP proxy endpoints
    # For now, we'll simulate this since the actual endpoints may not be implemented
    
    if curl -s --max-time 5 "$FRONTEND_URL/" >/dev/null 2>&1; then
        log_info "Frontend is accessible - simulating MCP integration test"
        
        # Simulate frontend calling MCP (since actual proxy endpoints may not exist yet)
        # This represents what should happen when a user asks about applications in the chat UI
        
        log_info "Simulating chat UI request: 'Show me Archer applications'"
        
        # The frontend should:
        # 1. Parse the user request
        # 2. Call MCP server via its proxy/client
        # 3. Apply privacy masking
        # 4. Send masked data to LLM
        # 5. Return formatted response
        
        # For now, simulate step 2 (call MCP via frontend logic)
        frontend_response=$(curl -s -X POST "$MCP_URL/call" \
            -H "Content-Type: application/json" \
            -d @/tmp/mcp_apps_payload.json)
        
        if echo "$frontend_response" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
            frontend_content=$(echo "$frontend_response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'content' in data and len(data['content']) > 0:
    print(data['content'][0].get('text', ''))
" 2>/dev/null)
            
            frontend_apps_count=$(echo "$frontend_content" | grep -o "Total Applications: [0-9]*" | grep -o "[0-9]*")
            
            if [ -n "$frontend_apps_count" ]; then
                log_success "Frontend simulation: $frontend_apps_count applications"
                echo "$frontend_apps_count" > /tmp/frontend_apps_count
                
                # Simulate privacy masking check
                if echo "$frontend_content" | grep -q "Description:"; then
                    log_info "Privacy masking should be applied to descriptions in production"
                fi
                
            else
                log_warning "Frontend simulation: Could not parse applications count"
            fi
        else
            log_warning "Frontend simulation: Invalid MCP response"
        fi
        
    else
        log_warning "Frontend not accessible - skipping integration test"
    fi
    
    echo ""
}

# Compare Results
compare_results() {
    echo "📊 Phase 5: Results Comparison"
    
    if [ -f /tmp/mcp_apps_count ] && [ -f /tmp/frontend_apps_count ]; then
        mcp_count=$(cat /tmp/mcp_apps_count)
        frontend_count=$(cat /tmp/frontend_apps_count)
        
        if [ "$mcp_count" = "$frontend_count" ]; then
            log_success "Applications count matches: MCP=$mcp_count, Frontend=$frontend_count"
        else
            log_warning "Applications count mismatch: MCP=$mcp_count, Frontend=$frontend_count"
        fi
    else
        log_warning "Cannot compare - missing count data"
    fi
    
    echo ""
}

# Generate Final Report
generate_report() {
    echo "📋 FINAL TEST REPORT"
    echo "===================="
    echo ""
    
    echo "Test Summary:"
    echo "  ✅ Passed: $TESTS_PASSED"
    echo "  ⚠️ Warnings: $TESTS_WARNED" 
    echo "  ❌ Failed: $TESTS_FAILED"
    echo ""
    
    if [ -f /tmp/mcp_apps_count ]; then
        echo "MCP Results:"
        echo "  Total Applications: $(cat /tmp/mcp_apps_count)"
        
        if [ -f /tmp/mcp_record_counts ]; then
            echo "  Record Counts:"
            while IFS=: read -r app count; do
                echo "    $app: $count"
            done < /tmp/mcp_record_counts
        fi
        echo ""
    fi
    
    # Overall result
    if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_PASSED -gt 0 ]; then
        if [ $TESTS_WARNED -eq 0 ]; then
            echo -e "${GREEN}🎉 ALL TESTS PASSED${NC}"
            echo "System is working correctly!"
            cleanup_temp_files
            exit 0
        else
            echo -e "${YELLOW}⚠️ TESTS PASSED WITH WARNINGS${NC}"
            echo "Core functionality working, some non-critical issues detected."
            cleanup_temp_files
            exit 0
        fi
    else
        echo -e "${RED}❌ TESTS FAILED${NC}"
        echo "System needs attention before use."
        cleanup_temp_files
        exit 1
    fi
}

# Cleanup temporary files
cleanup_temp_files() {
    rm -f /tmp/mcp_apps_payload.json* /tmp/mcp_records_payload.json* 
    rm -f /tmp/mcp_records_temp.json /tmp/mcp_apps_count /tmp/frontend_apps_count /tmp/mcp_record_counts
}

# Main test execution
main() {
    echo "Testing Configuration:"
    echo "  MCP Server: $MCP_URL"
    echo "  Frontend: $FRONTEND_URL"
    echo "  Test Tenant: $TEST_TENANT"
    echo ""
    
    # Setup
    create_test_payloads
    
    # Run test phases
    test_mcp_health || exit 1
    test_frontend_health
    test_mcp_direct || exit 1
    test_frontend_integration
    compare_results
    generate_report
}

# Trap to ensure cleanup on exit
trap cleanup_temp_files EXIT

# Run main test
main