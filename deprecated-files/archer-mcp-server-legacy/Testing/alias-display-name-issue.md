# Archer MCP Server: Alias to Display Name Mapping Issue

## Executive Summary
The Archer GRC MCP server currently returns field data using internal **aliases** rather than human-readable **display names**, making the data extremely difficult to interpret and use correctly. This critical usability issue led to confusion where "Overall Rating" data was present but unidentifiable because it was returned as "Compliance".

## The Problem

### Current Behavior
When fetching record data from Archer, the API returns fields using their technical aliases:
```json
{
  "Controls_Id": 372637,
  "Compliance": ["Effective"],           // What is "Compliance"?
  "Procedure_Name": "Risk Management...", // What is "Procedure_Name"?
  "Business_Unit_1": [373650],           // What is "Business_Unit_1"?
  ...
}
```

### Expected Behavior
The data should be returned with human-readable display names:
```json
{
  "Control Tracking ID": 372637,
  "Overall Rating": ["Effective"],       // Clear and understandable!
  "Control Name": "Risk Management...",  // Obvious what this field contains
  "Business Unit": [373650],            // No confusion about the field
  ...
}
```

## Real-World Impact

### Case Study: Overall Rating Confusion
1. **User Request**: "Show me the Overall Rating for these controls"
2. **Available Metadata**: Field list shows "Overall Rating (Alias: Compliance, Type: 4)"
3. **Actual Data Returned**: `"Compliance": ["Effective"]`
4. **Result**: Unable to find "Overall Rating" in the response, leading to incorrect assumption that the data was missing

### Other Confusing Mappings Discovered
| Alias (Returned) | Display Name (Expected) | Confusion Factor |
|-----------------|------------------------|------------------|
| Compliance | Overall Rating | Completely different meaning |
| Procedure_Name | Control Name | Misleading terminology |
| Procedure_ID | Control ID | Inconsistent naming |
| Business_Unit_1 | Business Unit | Unclear why "1" suffix |
| Management_Assessment_Rating | Control Self-Assessment Rating | Abbreviated and unclear |
| DateTime_Occurred | Date Occurred | Mixed naming convention |
| Areas_Impacted | Area(s) Impacted | Formatting differences |
| Remediation_Plans | Remediation Action(s) | Plural vs singular confusion |

## Code Analysis & Fix Location

### Where the Fix Should Be Implemented

The transformation should occur in the MCP server's data retrieval functions, specifically:

1. **Primary Location**: In any function that returns record data
   - `search_archer_records`
   - `find_record_by_id`
   - `get_top_records`
   - `get_record_statistics`

2. **Implementation Point**: After data retrieval, before response formatting

### Suggested Code Addition

```python
def transform_aliases_to_display_names(record_data, field_definitions):
    """
    Transform record data from aliases to display names
    
    Args:
        record_data: Dictionary with alias-based field names
        field_definitions: List of field definitions with display names and aliases
    
    Returns:
        Dictionary with display name-based field names
    """
    # Create alias to display name mapping
    alias_to_display = {
        field['alias']: field['display_name'] 
        for field in field_definitions
    }
    
    # Transform the record data
    transformed_data = {}
    for alias, value in record_data.items():
        display_name = alias_to_display.get(alias, alias)
        transformed_data[display_name] = value
    
    return transformed_data
```

### Integration Example

```python
@server.tool()
async def search_archer_records(
    applicationName: str,
    includeFullData: bool = False,
    pageNumber: int = 1,
    pageSize: int = 100
) -> str:
    # ... existing code to fetch data ...
    
    # Get field definitions for this application
    field_definitions = await get_field_definitions(session, base_url, app_id)
    
    # Transform each record
    transformed_records = []
    for record in records:
        transformed_record = transform_aliases_to_display_names(
            record, 
            field_definitions
        )
        transformed_records.append(transformed_record)
    
    # ... return transformed data ...
```

## Recommendations

### 1. Immediate Fix (High Priority)
- Implement alias-to-display-name transformation in all data retrieval functions
- Cache field definitions per application to avoid repeated API calls
- Add a parameter to allow users to choose between aliases and display names if needed

### 2. Enhanced Functionality (Medium Priority)
- Add a dedicated tool: `get_field_mapping(applicationName)` that returns the alias-to-display mapping
- Include field type information in the transformed output for better data interpretation
- Add option to include field metadata inline with the data

### 3. Documentation Updates (Medium Priority)
- Document the alias/display name issue in the tool descriptions
- Provide examples showing the transformation
- Add troubleshooting guide for common field name confusion

### 4. Testing Requirements
- Test with applications that have:
  - Special characters in display names
  - Very long display names
  - Duplicate display names (edge case)
  - Fields with no display name set

### 5. Performance Considerations
- Cache field definitions at the session level
- Only fetch field definitions once per application per session
- Consider lazy loading if field list is very large (1000+ fields)

## Benefits of Implementation

### For Users
- **Intuitive Data Access**: Find fields by their business names
- **Reduced Errors**: No guessing what "Compliance" means
- **Faster Development**: Less time mapping fields manually
- **Better Reports**: Headers in reports match business terminology

### For Developers
- **Cleaner Code**: No need for manual alias mapping in every query
- **Maintainability**: Changes to display names automatically reflected
- **Consistency**: Same field names across all tools and functions
- **Documentation**: Self-documenting field names

## Implementation Priority

This should be treated as a **HIGH PRIORITY** fix because:

1. **Current State is Unusable**: Users cannot reliably identify fields in responses
2. **Data Integrity Risk**: Misidentified fields could lead to incorrect business decisions
3. **Simple Fix**: The solution is straightforward and low-risk
4. **High Impact**: Affects every single data retrieval operation
5. **User Experience**: Dramatically improves usability of the entire MCP server

## Alternative Approaches

### Option 1: Client-Side Transformation
- Provide a separate tool for alias-to-display mapping
- Let clients handle the transformation
- **Pros**: No server changes needed
- **Cons**: Every client must implement the same logic

### Option 2: Dual Response Format
- Return both alias and display name versions
- Example: `{"fields_by_alias": {...}, "fields_by_display": {...}}`
- **Pros**: Backward compatible
- **Cons**: Doubles response size

### Option 3: Configuration Flag
- Add server configuration to choose default behavior
- Allow per-request override
- **Pros**: Flexible for different use cases
- **Cons**: More complex implementation

## Conclusion

The alias-to-display-name mapping issue is a critical usability problem that makes the Archer MCP server difficult to use effectively. The recommended solution is straightforward to implement and would dramatically improve the user experience. This transformation should be implemented server-side to ensure consistency and reduce client-side complexity.

**Recommended Action**: Implement the transformation in the MCP server immediately, starting with the most commonly used functions (`search_archer_records` and `get_application_fields`).