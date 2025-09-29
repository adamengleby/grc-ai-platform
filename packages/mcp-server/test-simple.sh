#!/bin/bash

# Simple MCP Test Script
# Tests basic MCP functionality with proper JSON escaping

echo "🧪 SIMPLE MCP TEST"
echo "=================="
echo ""

MCP_URL="http://localhost:3001"

# Test 1: Health Check
echo "🏥 Health Check..."
if curl -s "$MCP_URL/health" | grep -q "healthy"; then
    echo "✅ MCP Server is healthy"
else
    echo "❌ MCP Server is not healthy"
    exit 1
fi
echo ""

# Test 2: Get Applications (using a simpler JSON structure)
echo "📋 Testing Applications..."

# Create JSON file to avoid shell escaping issues
cat > /tmp/test_apps.json << 'EOF'
{
  "name": "get_archer_applications",
  "arguments": {
    "tenant_id": "test-simple",
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

response=$(curl -s -X POST "$MCP_URL/call" \
    -H "Content-Type: application/json" \
    -d @/tmp/test_apps.json)

echo "Response received. Checking format..."

# Check if we got a JSON response
if echo "$response" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
    echo "✅ Valid JSON response received"
    
    # Extract text content
    content=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'content' in data and len(data['content']) > 0:
    print(data['content'][0].get('text', ''))
else:
    print('No content found')
" 2>/dev/null)
    
    # Check for applications count
    apps_count=$(echo "$content" | grep -o "Total Applications: [0-9,]*" | grep -o "[0-9,]*" | tr -d ',')
    
    if [ -n "$apps_count" ] && [ "$apps_count" -gt 0 ]; then
        echo "✅ Found $apps_count applications"
        
        # Check for key applications
        if echo "$content" | grep -q "Risk Register"; then
            echo "✅ Risk Register found"
        else
            echo "⚠️ Risk Register not found"
        fi
        
        if echo "$content" | grep -q "Obligations"; then
            echo "✅ Obligations found"  
        else
            echo "⚠️ Obligations not found"
        fi
        
        if echo "$content" | grep -q "Controls"; then
            echo "✅ Controls found"
        else
            echo "⚠️ Controls not found"
        fi
        
    else
        echo "❌ No applications found or parse error"
        echo "Content preview:"
        echo "$content" | head -5
        exit 1
    fi
    
else
    echo "❌ Invalid JSON response"
    echo "Response preview:"
    echo "$response" | head -10
    exit 1
fi

# Clean up
rm -f /tmp/test_apps.json

echo ""
echo "🎉 BASIC MCP TEST PASSED"
echo "MCP server can successfully retrieve Archer applications!"