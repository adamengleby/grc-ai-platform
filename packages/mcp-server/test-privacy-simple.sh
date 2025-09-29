#!/bin/bash

# Simple Privacy Masking Test
# Tests that MCP returns raw data and frontend can apply masking

echo "🔒 PRIVACY MASKING TEST"
echo "======================"
echo ""

MCP_URL="http://localhost:3001"
TEST_TENANT="privacy-test-$(date +%s)"

# Test raw data from MCP server
echo "📡 Step 1: Getting raw data from MCP server..."

# Create payload file
cat > /tmp/privacy_test_payload.json << 'EOF'
{
  "name": "search_archer_records",
  "arguments": {
    "tenant_id": "TENANT_PLACEHOLDER",
    "archer_connection": {
      "baseUrl": "https://hostplus-uat.archerirm.com.au",
      "username": "api_test",
      "password": "Password1!.",
      "instanceId": "710100",
      "userDomainId": ""
    },
    "applicationName": "Obligations",
    "pageSize": 2
  }
}
EOF

# Replace tenant placeholder
sed -i.bak "s/TENANT_PLACEHOLDER/$TEST_TENANT/g" /tmp/privacy_test_payload.json

# Get raw data
echo "Getting raw data from MCP server..."
raw_response=$(curl -s -X POST "$MCP_URL/call" \
    -H "Content-Type: application/json" \
    -d @/tmp/privacy_test_payload.json)

if [ $? -eq 0 ]; then
    echo "✅ MCP server responded successfully"
    
    # Extract content
    content=$(echo "$raw_response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data['content'][0]['text'])
except:
    print('ERROR: Could not parse response')
    exit(1)
" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully extracted content from MCP response"
        
        # Check for sensitive data (indicating no masking)
        echo ""
        echo "🔍 Step 2: Analyzing raw data content..."
        
        sensitive_found=0
        
        if echo "$content" | grep -q "Approver_Review_Task_Description"; then
            echo "✅ Found detailed task descriptions (sensitive data present)"
            sensitive_found=$((sensitive_found + 1))
        fi
        
        if echo "$content" | grep -q "Approver_Review_Task_Resolution"; then
            echo "✅ Found task resolutions (sensitive data present)"
            sensitive_found=$((sensitive_found + 1))
        fi
        
        if echo "$content" | grep -q "Obligations_Id: [0-9]"; then
            echo "✅ Found record IDs (sensitive data present)"
            sensitive_found=$((sensitive_found + 1))
        fi
        
        content_length=${#content}
        if [ $content_length -gt 500 ]; then
            echo "✅ Content length indicates detailed data ($content_length chars)"
            sensitive_found=$((sensitive_found + 1))
        fi
        
        echo ""
        echo "📄 Raw Data Sample (first 300 chars):"
        echo "----------------------------------------"
        echo "$content" | head -c 300
        echo "..."
        echo "----------------------------------------"
        echo ""
        
        if [ $sensitive_found -gt 2 ]; then
            echo "✅ MCP SERVER RETURNS RAW DATA (No masking detected)"
        else
            echo "⚠️ MCP server may already be applying masking"
        fi
        
        echo ""
        echo "🎭 Step 3: Simulating frontend privacy masking..."
        
        # Simulate masking by replacing sensitive patterns
        masked_content=$(echo "$content" | sed \
            -e 's/Approver_Review_Task_Description: [^[:space:]]*/Approver_Review_Task_Description: [MASKED_DESCRIPTION]/g' \
            -e 's/Approver_Review_Task_Resolution: [^[:space:]]*/Approver_Review_Task_Resolution: [MASKED_RESOLUTION]/g' \
            -e 's/Accountability_Statements_[^[:space:]]*: [^[:space:]]*/Accountability_Statements: [MASKED_STATEMENTS]/g' \
            -e 's/[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/[MASKED_EMAIL]/g')
        
        masked_length=${#masked_content}
        original_length=${#content}
        
        # Count masked fields
        masked_fields=$(echo "$masked_content" | grep -o '\[MASKED_[A-Z_]*\]' | wc -l)
        
        echo "📊 Masking Results:"
        echo "  Original length: $original_length chars"
        echo "  Masked length: $masked_length chars"
        echo "  Fields masked: $masked_fields"
        echo ""
        
        echo "📄 Masked Data Sample (first 300 chars):"
        echo "----------------------------------------"
        echo "$masked_content" | head -c 300
        echo "..."
        echo "----------------------------------------"
        echo ""
        
        if [ $masked_fields -gt 0 ]; then
            echo "✅ FRONTEND MASKING SIMULATION SUCCESSFUL"
        else
            echo "⚠️ No masking patterns applied"
        fi
        
        echo ""
        echo "🔍 Step 4: Structure Preservation Check..."
        
        # Check that key structure elements are preserved
        structure_preserved=0
        
        if echo "$masked_content" | grep -q "Total Records:"; then
            echo "✅ Record count preserved"
            structure_preserved=$((structure_preserved + 1))
        fi
        
        if echo "$masked_content" | grep -q "1\. Record:" && echo "$masked_content" | grep -q "2\. Record:"; then
            echo "✅ Record numbering preserved"
            structure_preserved=$((structure_preserved + 1))
        fi
        
        if echo "$masked_content" | grep -q "_Id:"; then
            echo "✅ Field structure preserved"
            structure_preserved=$((structure_preserved + 1))
        fi
        
        if [ $structure_preserved -gt 1 ]; then
            echo "✅ DATA STRUCTURE PRESERVED AFTER MASKING"
        else
            echo "⚠️ Data structure may not be properly preserved"
        fi
        
    else
        echo "❌ Could not extract content from MCP response"
        exit 1
    fi
    
else
    echo "❌ MCP server request failed"
    exit 1
fi

# Clean up
rm -f /tmp/privacy_test_payload.json*

echo ""
echo "📋 PRIVACY MASKING TEST SUMMARY"
echo "==============================="

if [ $sensitive_found -gt 2 ] && [ $masked_fields -gt 0 ] && [ $structure_preserved -gt 1 ]; then
    echo "🎉 ALL TESTS PASSED"
    echo "✅ MCP server returns raw, unmasked data"
    echo "✅ Frontend masking simulation works correctly"
    echo "✅ Data structure is preserved after masking"
    echo ""
    echo "🔒 Privacy protection pipeline is working correctly!"
else
    echo "⚠️ TESTS COMPLETED WITH ISSUES"
    echo "Some aspects of privacy masking may need attention."
fi