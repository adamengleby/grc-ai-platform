# AI Agent Prompt Guidelines for GRC Risk Analysis

## Overview
This document provides prompt engineering best practices for AI agents working with the Archer MCP Server to identify and analyze critical risks in GRC systems.

## Recommended Tool Usage Sequence

### 1. Initial Risk Discovery
Start with the dedicated risk analysis tool for immediate insights:
```
Use analyze_risks with:
- applicationName: "Risk Register" (or relevant risk module)
- severityThreshold: "critical" (for urgent risks only)
- includeOnlyActive: true (focus on current risks)
- includeFullData: true (for comprehensive analysis)
```

### 2. Field Verification
If risk fields appear masked or incomplete:
```
Use get_application_fields to:
- Identify all active risk assessment fields
- Understand field types and relationships
- Map field aliases to actual data
```

### 3. Deep Dive on Critical Risks
For specific critical risks identified:
```
Use find_record_by_id to:
- Retrieve complete record details
- Access all unmasked risk metrics
- Review mitigation strategies
```

## Effective Prompting Patterns

### Pattern 1: Critical Risk Identification
```
"Analyze the Risk Register to identify all critical and high-severity risks that are currently active. 
Focus on risks with:
- Severity levels of 'Critical' or 'High'
- Status of 'Active' or 'Open'
- High financial impact (if annualized loss data is available)

Provide:
1. Total count of critical risks
2. Top 10 risks by severity/impact
3. Key risk categories affected
4. Recommendations for immediate action"
```

### Pattern 2: Risk Trend Analysis
```
"Search Risk Register records with includeFullData=true to analyze risk trends.
Group risks by:
- Severity distribution
- Risk categories
- Control effectiveness (if residual vs inherent risk data exists)
- Status (active vs closed)

Highlight:
- Emerging risk patterns
- Areas with risk concentration
- Gaps in risk coverage"
```

### Pattern 3: Active Risk Filtering
```
"Focus exclusively on active risks by:
1. Using analyze_risks with includeOnlyActive=true
2. Filter by status fields containing 'Active', 'Open', 'Current'
3. Exclude risks with status 'Closed', 'Mitigated', 'Accepted'

This ensures analysis covers only actionable risks requiring attention."
```

## Key Field Mappings

### Essential Risk Fields (Now Whitelisted)
These fields are no longer masked and contain critical risk data:
- `risk_score`, `risk_rating`, `risk_level`
- `severity`, `severity_level`
- `impact`, `impact_score`, `impact_level`
- `likelihood`, `likelihood_score`, `probability`
- `inherent_risk`, `residual_risk`
- `actual_annualized_loss_amount`, `estimated_loss`
- `priority`, `criticality`
- `active`, `is_active`, `record_status`

### Field Detection Strategy
The AI should:
1. Auto-detect risk fields using pattern matching
2. Prioritize fields containing keywords: severity, impact, likelihood, score
3. Map variations (e.g., "Risk_Score" vs "RiskScore" vs "Score")

## Response Optimization

### For Missing Risk Data
If critical risk fields appear null or masked:
```
"The risk analysis shows limited data visibility. To improve analysis:
1. Verify field mappings using get_application_fields
2. Use includeFullData=true for complete dataset access
3. Check if fields are calculated fields requiring special handling
4. Ensure you're accessing the correct risk module/application"
```

### For Large Datasets
When dealing with hundreds of risks:
```
"Due to the large number of risks (194 total), I'll focus on:
1. Critical risks first (severity = critical/extreme)
2. High risks with financial impact > $X
3. Active risks requiring immediate mitigation
4. Risks without assigned owners or treatment plans

Use pagination strategically:
- First page: Critical risks
- Subsequent pages: High/medium risks
- Filter out low/accepted risks"
```

## Example AI Agent Workflow

```python
# Step 1: Analyze risks with smart filtering
risk_analysis = analyze_risks(
    applicationName="Risk Register",
    severityThreshold="high",
    includeOnlyActive=True,
    topN=50,
    sortBy="risk_score",
    includeFullData=True
)

# Step 2: If unclassified risks are high, check field mappings
if risk_analysis.riskSummary.unclassified > 20:
    fields = get_application_fields("Risk Register")
    # Map fields to improve classification

# Step 3: Deep dive on critical risks
for risk in risk_analysis.topRisks[:5]:
    detailed_risk = find_record_by_id("Risk Register", risk.id)
    # Analyze mitigation strategies, ownership, etc.

# Step 4: Generate executive summary
summary = {
    "critical_risks": risk_analysis.riskSummary.critical,
    "requires_immediate_action": [...],
    "risk_trends": [...],
    "recommendations": risk_analysis.recommendations
}
```

## Common Pitfalls to Avoid

1. **Don't rely solely on search_archer_records** - Use analyze_risks for risk-specific analysis
2. **Don't ignore active status filtering** - Many risks may be closed/mitigated
3. **Don't overlook field variations** - Risk fields may have different names across modules
4. **Don't analyze without context** - Always check field definitions first

## Advanced Techniques

### Risk Correlation Analysis
```
"After identifying critical risks, correlate with:
- Associated controls (if Controls module is available)
- Related incidents (if Incidents module is available)
- Compliance violations (if Compliance module is available)

This provides holistic risk context beyond individual risk scores."
```

### Financial Impact Prioritization
```
"When annualized_loss fields are available:
1. Sort risks by financial impact
2. Calculate total potential loss exposure
3. Identify risks exceeding materiality thresholds
4. Recommend risk transfer/insurance strategies"
```

### Control Effectiveness Analysis
```
"When both inherent_risk and residual_risk are available:
1. Calculate control effectiveness = (inherent - residual) / inherent
2. Identify risks with low control effectiveness
3. Highlight risks where residual > risk appetite
4. Recommend control improvements"
```

## Testing Your Prompts

Before deploying prompts to production:
1. Test with analyze_risks using different severity thresholds
2. Verify active record filtering works correctly
3. Ensure critical fields are properly identified
4. Validate recommendations are actionable
5. Check performance with includeFullData parameter

## Conclusion

Effective risk analysis requires:
- Using the right tool (analyze_risks) for the job
- Focusing on active, high-severity risks
- Understanding field mappings and data structure
- Providing actionable recommendations

The improved MCP server now provides better visibility into risk data while maintaining appropriate privacy controls for non-risk sensitive information.