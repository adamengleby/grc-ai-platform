# GRC Dashboard MCP Integration Test Guide

## How to Test the Complete Integration

### 1. Start the Development Server (Already Running)
The development server is currently running at: **http://localhost:3000**

### 2. Navigate to the Chat Interface
1. Open your browser to http://localhost:3000
2. Navigate to the **Chat** page in the dashboard
3. You should see the MCP Test Interface with tenant selection

### 3. Test Tenant Selection
Try switching between the 3 available tenants:

#### **FinTech Solutions Corp** 🏦
- **Industry**: Financial Services
- **Region**: North America
- **Risk Appetite**: Moderate
- **Frameworks**: SOX, PCI-DSS, GDPR
- **Best test queries**:
  - "What are our current critical risks?"
  - "Show me our SOX compliance status"
  - "Analyze our financial system security"

#### **Global Healthcare Systems** 🏥
- **Industry**: Healthcare
- **Region**: Europe
- **Risk Appetite**: Low (Conservative)
- **Frameworks**: HIPAA, GDPR, ISO 27001
- **Best test queries**:
  - "Analyze our HIPAA compliance status and identify privacy risks"
  - "Show me patient data access control effectiveness"
  - "Detect any unusual access patterns"

#### **Advanced Manufacturing Ltd** 🏭
- **Industry**: Manufacturing
- **Region**: Asia Pacific
- **Risk Appetite**: High
- **Frameworks**: ISO 9001, ISO 14001, OHSAS 18001
- **Best test queries**:
  - "Analyze supply chain disruption risks"
  - "What are our operational risk exposures?"
  - "Show production quality control metrics"

### 4. Test Agent Selection
Switch between the 3 available agents and notice how they affect tool selection:

1. **GRC Data Analyzer** → Uses `analyze_grc_data` tool
2. **Risk Summary Agent** → Uses `get_risk_summary` tool  
3. **Anomaly Detection Agent** → Uses `detect_anomalies` tool

### 5. Test Sample Queries

#### Risk Analysis Queries
- "What are the current high-risk findings?"
- "Show me critical risks requiring immediate attention"
- "Calculate our overall risk exposure"

#### Compliance Queries
- "Generate a compliance summary"
- "What controls need attention for our upcoming audit?"
- "Show me our current compliance score"

#### Anomaly Detection Queries
- "Detect any unusual patterns in our data"
- "Show me any anomalies in the last 30 days"
- "Are there any suspicious trends?"

### 6. What to Look For

#### Response Quality
- ✅ Realistic, detailed responses
- ✅ Industry-specific content based on selected tenant
- ✅ Proper compliance framework references
- ✅ Actionable recommendations

#### Metadata Display
- ✅ **Confidence scores** (typically 85-95%)
- ✅ **Processing time** (1.5-3 seconds simulated)
- ✅ **Tools used** indicators with icons
- ✅ **Evidence sources** with relevance scores
- ✅ **Compliance flags** when applicable

#### User Experience
- ✅ Tenant context switching updates conversation
- ✅ Suggested queries change based on tenant
- ✅ Connection status indicator
- ✅ Proper error handling
- ✅ Input validation (disabled until tenant selected)

### 7. Error Testing
Try these scenarios to test error handling:
- Ask a query without selecting a tenant (should be disabled)
- Try queries that might trigger different response types
- Switch tenants mid-conversation (should add system message)

### 8. Expected Response Format
Each response should include:

```markdown
# Response Title

## Key Findings
- Detailed analysis points
- Risk scores and metrics
- Compliance status updates

## Recommendations
1. Actionable steps
2. Priority assignments
3. Timeline expectations
```

**Plus metadata showing**:
- Confidence: 85-95%
- Processing time: 1500-3000ms
- Tools used: analyze_grc_data, get_risk_summary, or detect_anomalies
- Evidence from mock sources
- Compliance framework alerts

### 9. Multi-Tenant Context Testing
1. Start with FinTech tenant
2. Ask "What are our critical risks?"
3. Switch to Healthcare tenant
4. Ask the same question
5. Notice how responses change based on:
   - Industry context
   - Compliance frameworks
   - Risk appetite
   - Regional considerations

### 10. Verification Checklist
- [ ] Can select different tenants
- [ ] Suggested queries update per tenant
- [ ] Responses are tenant-specific
- [ ] Confidence scores display correctly
- [ ] Processing time shows
- [ ] Tools used are displayed with icons
- [ ] Evidence sources are shown
- [ ] System messages appear on tenant change
- [ ] Error handling works properly
- [ ] Connection status is visible

## Troubleshooting

### If the interface doesn't load:
- Check that development server is running on port 3000
- Verify no TypeScript compilation errors
- Check browser console for JavaScript errors

### If responses seem generic:
- Ensure a tenant is selected
- Try different query types (risk, compliance, anomaly)
- Switch between different agents

### If features are missing:
- Refresh the page to ensure latest code is loaded
- Check that all components are properly imported

The integration successfully demonstrates a complete working system with realistic GRC data analysis, AI-powered insights, and proper multi-tenant context management!