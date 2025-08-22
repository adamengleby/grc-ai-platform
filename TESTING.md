# GRC Dashboard Testing Guide

## Quick Start - Testing Both Services

### 1. Start All Services
```bash
npm run start-all
```

This starts both:
- **React Dashboard**: http://localhost:3000
- **GRC HTTP Server**: http://localhost:3002

### 2. Test the Dashboard UI

1. **Login**: 
   - Go to http://localhost:3000
   - Use any of these test emails:
     - `user1@acme.com` (Tenant Owner)
     - `analyst@acme.com` (Agent User) 
     - `audit@acme.com` (Auditor)

2. **Navigate to MCP Tools**:
   - Click "MCP Tools" in sidebar
   - Should show connection status and available tools

3. **Test AI Analysis**:
   - Try queries like:
     - "Show me critical risks"
     - "What is our compliance status?"
     - "Detect any anomalies"

### 3. Test HTTP Server Directly

#### Health Check
```bash
curl http://localhost:3002/health
```

#### List Available Tools
```bash
curl http://localhost:3002/tools
```

#### Test Risk Analysis
```bash
curl -X POST http://localhost:3002/tools/analyze_grc_data/call \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "tenant_id": "tenant-fintech-001",
      "query": "Show me critical risks"
    }
  }'
```

#### Test Risk Summary
```bash
curl -X POST http://localhost:3002/tools/get_risk_summary/call \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "tenant_id": "tenant-healthcare-002",
      "include_trends": true
    }
  }'
```

#### Test Anomaly Detection
```bash
curl -X POST http://localhost:3002/tools/detect_anomalies/call \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "tenant_id": "tenant-manufacturing-003",
      "confidence_threshold": 0.7
    }
  }'
```

## Available Test Tenants

### 1. FinTech Solutions Corp (`tenant-fintech-001`)
- **Industry**: Financial Services
- **Critical Risks**: Cybersecurity Data Breach, Regulatory Compliance
- **Compliance**: SOX (89.2%), ISO27001 (94.7%)

### 2. Global Healthcare Systems (`tenant-healthcare-002`)
- **Industry**: Healthcare  
- **Critical Risks**: Patient Data Privacy Breach
- **Compliance**: HIPAA (94.8%)

### 3. Advanced Manufacturing Ltd (`tenant-manufacturing-003`)
- **Industry**: Manufacturing
- **Critical Risks**: Supply Chain Disruption
- **Compliance**: ISO9001 (93.4%)

## Expected Results

### Risk Analysis Queries
- Should return markdown-formatted analysis
- Includes risk scores, probabilities, owners, and mitigation plans
- Tailored to each tenant's industry and risk profile

### Compliance Queries  
- Shows overall compliance scores
- Framework-specific breakdowns
- Status indicators (excellent/good/requires attention)

### Anomaly Detection
- Returns confidence scores and severity levels
- Industry-specific anomalies (e.g., supply chain for manufacturing)
- Actionable recommendations

## Troubleshooting

### "MCP client not connected" Error
1. Check that HTTP server is running on port 3002
2. Verify health endpoint: `curl http://localhost:3002/health`
3. Restart with: `npm run start-all`

### Build Errors
1. Run: `npm run build` to check for TypeScript errors
2. Fix any compilation issues
3. Restart services

### Connection Issues
- Ensure ports 3000 and 3002 are available
- Check for firewall blocking localhost connections
- Try restarting with individual commands:
  - `npm run http-server` (in one terminal)
  - `npm run dev` (in another terminal)

## Development Notes

- The system includes both a traditional MCP server (`grc-mcp-server.js`) and an HTTP server (`grc-http-server.js`)
- For browser integration, the HTTP server is used as MCP servers use stdio transport
- All data is mock/demo data - in production, this would connect to real GRC systems
- The MCP client (`src/lib/mcpClient.ts`) handles the HTTP communication