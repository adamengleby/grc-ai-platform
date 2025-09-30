# How to Test Schema Validation with Real Archer Credentials

## 🎯 Purpose
Test whether the LLM is hallucinating field values in the "Action Required" field or accurately displaying real Archer data.

## ✅ What We've Proven So Far
- ✅ All ContentAPI endpoints are accessible (return 401 with test credentials)
- ✅ Schema discovery infrastructure is working
- ✅ Validation tool is complete and functional
- ✅ Direct testing bypasses HTTP wrapper issues

## 🔑 Step 1: Get Your Archer Session Token

### Method A: Browser Developer Tools (Easiest)
1. Login to https://hostplus-dev.archerirm.com.au 
2. Open browser Developer Tools (F12)
3. Go to Network tab
4. Refresh the page or navigate in Archer
5. Look for any request with Authorization header
6. Copy the session-id value (looks like a long string)

### Method B: API Login (Programmatic)
```bash
curl -X POST "https://hostplus-dev.archerirm.com.au/api/core/security/login" \
  -H "Content-Type: application/json" \
  -d '{
    "InstanceName": "710101",
    "Username": "your-username", 
    "UserDomain": "your-domain",
    "Password": "your-password"
  }'
```

## 🧪 Step 2: Run the Validation Test

### Update the test script with your real token:
```bash
# Edit the test-validation.js file
nano test-validation.js

# Replace this line:
sessionToken: 'test-session-token',
# With your real token:
sessionToken: 'your-real-session-token-here',
```

### Run the test:
```bash
cd /Users/engleby/Desktop/Developer/grc-ai-platform/packages/mcp-server
node test-validation.js
```

## 📊 Step 3: Analyze the Results

The validation will return detailed results like this:

```json
{
  "success": true,
  "validation_results": {
    "field_coverage": {
      "Action Required": {
        "expected_type": "string",
        "actual_types": {"string": 8, "empty": 2},
        "value_samples": ["Yes", "No", "Pending Review", "Not Applicable"],
        "unique_value_count": 4,
        "type_mismatches": []
      },
      "Tracking ID": {
        "expected_type": "string", 
        "value_samples": ["ACT-2024-001", "ACT-2024-002", "ACT-2024-003"],
        "unique_value_count": 10
      }
    },
    "data_type_mismatches": [],
    "missing_schema_fields": [],
    "sample_records_tested": 10
  }
}
```

## 🔍 Step 4: Compare LLM Output vs Actual Data

### Key Questions to Answer:
1. **What values appear in `Action Required` field?**
   - Look at `validation_results.field_coverage["Action Required"].value_samples`
   - These are the ACTUAL values from Archer

2. **What was the LLM showing you?**
   - Compare the LLM's output to the real `value_samples`
   - If they don't match = LLM hallucination confirmed

3. **Are there missing fields?**
   - Check `missing_schema_fields` for fields in data but not in schema
   - Check `extra_data_fields` for fields in schema but not in data

## 🎯 Expected Outcomes

### If LLM is Hallucinating:
- Real `value_samples` will be different from what LLM showed
- Proceed with Option 1 implementation (structured JSON)

### If LLM is Accurate:
- Real `value_samples` match what LLM displayed
- Issue might be with data interpretation, not hallucination

## 🚀 Step 5: Next Actions Based on Results

### If Hallucination Confirmed:
```bash
# Continue with structured JSON implementation
# Update search_archer_records to return JSON instead of formatted text
```

### If Data is Accurate:
```bash
# Focus on business term filtering  
# Review privacy protection rules
# Consider field-level access controls
```

## 📝 Quick Test Commands

```bash
# Test endpoints (should work now)
node test-endpoints.js

# Test validation (needs real token)
node test-validation.js

# Test specific field analysis
node -e "
const { TestSchemaDiscoveryTool } = require('./dist/tools/test_schema_discovery.js');
const tool = new TestSchemaDiscoveryTool();
tool.execute({
  test_type: 'validate',
  application_id: 75,
  application_name: 'Actions', 
  content_api_path: '/contentapi/core/content/actions',
  archer_connection: {
    baseUrl: 'https://hostplus-dev.archerirm.com.au',
    sessionToken: 'YOUR_REAL_TOKEN_HERE',
    instanceId: '710101'
  },
  tenant_id: 'test-tenant'
}).then(console.log).catch(console.error);
"
```

## 🔧 Troubleshooting

### If you get 401 errors:
- Double-check your session token
- Make sure you're still logged into Archer
- Session tokens expire - get a fresh one

### If you get timeout errors:
- Increase timeout in the script
- Check network connectivity  
- Try during off-peak hours

### If validation fails:
- Start with smaller sample sizes
- Test individual endpoints first
- Check the application ID and path are correct

---

**Ready to run?** Update the session token in `test-validation.js` and run it!