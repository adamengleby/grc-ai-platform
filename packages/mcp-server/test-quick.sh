#!/bin/bash

# Quick Integration Test for MCP Server
# Tests that MCP server can return record counts for key applications
# Usage: ./test-quick.sh

echo "🧪 QUICK MCP INTEGRATION TEST"
echo "==============================="
echo ""

# Configuration
MCP_URL="http://localhost:3001"
TEST_TENANT="test-integration-$(date +%s)"

# Test applications to check
APPS=("Risk_Register" "Obligations" "Controls")

# Archer connection details
ARCHER_CONFIG='{
  "baseUrl": "https://hostplus-uat.archerirm.com.au",
  "username": "api_test", 
  "password": "Password1!.",
  "instanceId": "710100",
  "instanceName": "710100",
  "userDomainId": ""
}'

echo "Testing MCP Server: $MCP_URL"
echo "Test Tenant: $TEST_TENANT"
echo ""

# Function to test MCP call
test_mcp_call() {
    local tool_name="$1"
    local args="$2"
    local description="$3"
    
    echo "🔍 Testing: $description"
    
    local payload=$(cat <<EOF
{
  "name": "$tool_name",
  "arguments": {
    "tenant_id": "$TEST_TENANT",
    "archer_connection": $ARCHER_CONFIG,
    $args
  }
}
EOF
    )
    
    local response=$(curl -s -X POST "$MCP_URL/call" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    if [ $? -eq 0 ]; then
        local content=$(echo "$response" | jq -r '.content[0].text // "No content"' 2>/dev/null)
        if [[ "$content" == *"Error"* ]]; then
            echo "❌ Failed: $content"
            return 1
        else
            echo "✅ Success"
            echo "$content" | head -10
            echo ""
            return 0
        fi
    else
        echo "❌ Failed: Could not connect to MCP server"
        return 1
    fi
}

# Function to extract count from text
extract_count() {
    local text="$1"
    local pattern="$2"
    echo "$text" | grep -o "$pattern" | grep -o '[0-9]\+' || echo "0"
}

# Test 1: Health Check
echo "🏥 Step 1: Health Check"
health_response=$(curl -s "$MCP_URL/health" 2>/dev/null)
if [ $? -eq 0 ] && [[ "$health_response" == *"healthy"* ]]; then
    echo "✅ MCP Server is healthy"
else
    echo "❌ MCP Server health check failed"
    exit 1
fi
echo ""

# Test 2: Get Applications
echo "📋 Step 2: Get Applications List"
apps_result=$(test_mcp_call "get_archer_applications" "" "Getting applications list")
apps_success=$?

if [ $apps_success -eq 0 ]; then
    total_apps=$(echo "$apps_result" | grep -o "Total Applications: [0-9]\+" | grep -o '[0-9]\+')
    echo "Found $total_apps total applications"
    
    # Check if test applications are present
    for app in "${APPS[@]}"; do
        if echo "$apps_result" | grep -q "$app"; then
            echo "✅ Found: $app"
        else
            echo "⚠️ Not found: $app"
        fi
    done
else
    echo "❌ Failed to get applications - cannot continue"
    exit 1
fi
echo ""

# Test 3: Get Record Counts
echo "📊 Step 3: Get Record Counts"

# Create temp files for results since associative arrays aren't portable
RESULTS_FILE="/tmp/test_results_$$"
echo "" > "$RESULTS_FILE"

for app in "${APPS[@]}"; do
    echo "Testing $app..."
    
    # Convert underscores back to spaces for API call
    app_display=$(echo "$app" | sed 's/_/ /g')
    
    records_result=$(test_mcp_call "search_archer_records" "\"applicationName\": \"$app_display\", \"pageSize\": 1" "Getting $app_display records")
    records_success=$?
    
    if [ $records_success -eq 0 ]; then
        count=$(echo "$records_result" | grep -o "Total Records: [0-9,]\+" | grep -o '[0-9,]\+' | tr -d ',')
        if [ -n "$count" ]; then
            echo "$app:$count" >> "$RESULTS_FILE"
            echo "✅ $app_display: $count records"
        else
            echo "$app:unknown" >> "$RESULTS_FILE"
            echo "⚠️ $app_display: Could not determine record count"
        fi
    else
        echo "$app:error" >> "$RESULTS_FILE"
        echo "❌ $app_display: Failed to get records"
    fi
    echo ""
done

# Summary Report
echo "📊 FINAL RESULTS"
echo "================"
echo "Total Applications: $total_apps"
echo ""
echo "Record Counts:"

failed_count=0
total_count=0

for app in "${APPS[@]}"; do
    app_display=$(echo "$app" | sed 's/_/ /g')
    result=$(grep "^$app:" "$RESULTS_FILE" | cut -d: -f2)
    echo "  $app_display: $result"
    
    total_count=$((total_count + 1))
    if [ "$result" = "error" ]; then
        failed_count=$((failed_count + 1))
    fi
done

# Clean up temp file
rm -f "$RESULTS_FILE"
echo ""

# Determine overall result
if [ -n "$total_apps" ] && [ "$total_apps" -gt 0 ] && [ $failed_count -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED - System is working correctly!"
    exit 0
elif [ -n "$total_apps" ] && [ "$total_apps" -gt 0 ] && [ $failed_count -lt $total_count ]; then
    echo "⚠️ TESTS PASSED WITH WARNINGS - Core functionality working"
    exit 0
else
    echo "❌ TESTS FAILED - System needs attention"
    exit 1
fi