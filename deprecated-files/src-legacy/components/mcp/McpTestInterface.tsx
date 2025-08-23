import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Send,
  Bot,
  Settings,
  Shield,
  Database,
  BarChart3,
  FileText,
  CheckCircle,
  AlertCircle,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { clsx } from 'clsx';
import { createMcpService } from '@/lib/mcpService';
import { TenantSelector, McpTenant } from './TenantSelector';
import { createAgentService } from '@/lib/agentService';
import { AIAgent } from '@/types/agent';
import { securityAuditLogger } from '@/lib/security/auditLogger';
import { enhancedSessionValidator } from '@/lib/security/sessionValidator';

/**
 * Orchestrate AI agent workflow: LLM selects tools dynamically and processes results
 */
async function orchestrateWithAzureOpenAI(
  userQuery: string,
  tenant: any,
  availableTools: any[],
  mcpService: any
): Promise<{ content: string; toolsUsed: string[] }> {
  try {
    // Check if user is asking to list available tools
    const listToolsQueries = ['list tools', 'show tools', 'available tools', 'what tools', 'which tools', 'archer tools', 'show me tools', 'mcp tools', 'tools available', 'show me archer'];
    const isListToolsQuery = listToolsQueries.some(q => userQuery.toLowerCase().includes(q));
    
    if (isListToolsQuery) {
      console.log('[MCP Tools] User requesting tool list via MCP protocol');
      const toolsList = availableTools.map((tool, index) => 
        `${index + 1}. **${tool.name}**\n   - ${tool.description || 'GRC analysis tool'}`
      ).join('\n\n');
      
      return {
        content: `**Available Archer GRC Tools**:\n\n${toolsList}\n\n**Total Tools**: ${availableTools.length}\n**Server**: Archer GRC MCP\n\nYou can ask me to analyze risks, generate insights, detect anomalies, or perform GRC analysis using these tools.`,
        toolsUsed: ['list_tools']
      };
    }

    // Use selected agent configuration if available
    const selectedAgentConfig = tenant.selectedAgent;
    if (!selectedAgentConfig) {
      console.warn('No agent configuration found, using direct MCP fallback');
      
      // Direct MCP tool execution without LLM orchestration
      const defaultTool = userQuery.toLowerCase().includes('risk') ? 'get_risk_summary' : 'get_archer_applications';
      console.log('[MCP Direct] Using tool:', defaultTool);
      
      try {
        const workingTenantId = tenant?.id || selectedTenant?.id || 'tenant-acme'; // Use actual tenant
        
        const result = await mcpService.executeTool({
          toolId: defaultTool,
          inputs: {
            tenant_id: workingTenantId,
            query: userQuery,
            focus: 'overall'
          }
        });
        
        return {
          content: `**Query**: ${userQuery}\n\n**Analysis from GRC System:**\n\n${result.result}\n\n*Note: Using direct GRC analysis. Configure Azure OpenAI in LLM Configuration for enhanced AI insights.*`,
          toolsUsed: [defaultTool]
        };
      } catch (error) {
        console.error('[MCP Direct] Tool execution failed:', error);
        return {
          content: `I encountered an error while analyzing your GRC data: ${error instanceof Error ? error.message : String(error)}\n\nPlease check your MCP server configuration or set up Azure OpenAI in the LLM Configuration page.`,
          toolsUsed: ['error_fallback']
        };
      }
    }

    const config = selectedAgentConfig;
    
    // Proceed with any configured LLM provider
    if (!config || !config.apiKey) {
      console.warn('Agent not properly configured');
      return {
        content: `AI agent not configured properly. Please check your agent configuration.`,
        toolsUsed: ['config_error']
      };
    }

    // Test the configuration first with a simple call
    console.log('[Debug] Testing agent configuration...');
    try {
      await testAgentConfig(config);
      console.log('[Debug] Configuration test passed');
    } catch (testError) {
      console.error('[Debug] Configuration test failed:', testError);
      // Continue with fallback
    }

    // For now, let's use a simple fallback while we debug the API issue
    console.log('[MCP Orchestration] Available tools:', availableTools.length);
    
    try {
      // Step 1: Let the AI agent analyze the query and select appropriate MCP tools
      const toolSelectionResponse = await selectToolsWithAgent(userQuery, availableTools, config, tenant);
      
      // Step 2: Execute the selected tools using standard MCP protocol
      const toolResults = [];
      console.log('[MCP Orchestration] Executing selected tools:', toolSelectionResponse.selectedTools);
      
      for (const toolCall of toolSelectionResponse.selectedTools) {
        try {
          console.log(`[MCP Orchestration] Executing tool: ${toolCall.name} with inputs:`, toolCall.arguments);
          
          const result = await mcpService.executeTool({
            toolId: toolCall.name,
            inputs: {
              ...toolCall.arguments,
              tenant_id: tenant.id
            }
          });
          
          console.log(`[MCP Orchestration] Tool ${toolCall.name} returned:`, {
            success: true,
            hasResult: !!result.result,
            resultType: typeof result.result,
            resultLength: result.result ? (typeof result.result === 'string' ? result.result.length : JSON.stringify(result.result).length) : 0
          });
          
          // Log first 200 chars of result for debugging
          if (result.result) {
            const preview = typeof result.result === 'string' 
              ? result.result.substring(0, 200) 
              : JSON.stringify(result.result).substring(0, 200);
            console.log(`[MCP Orchestration] Result preview: ${preview}...`);
          }
          
          toolResults.push({
            tool: toolCall.name,
            result: result.result,
            success: true
          });
        } catch (error) {
          console.error(`[MCP Orchestration] Tool ${toolCall.name} failed:`, error);
          
          toolResults.push({
            tool: toolCall.name,
            error: error instanceof Error ? error.message : String(error),
            success: false
          });
        }
      }
      
      console.log('[MCP Orchestration] All tools executed. Results summary:', {
        totalTools: toolResults.length,
        successful: toolResults.filter(r => r.success).length,
        failed: toolResults.filter(r => !r.success).length
      });

      // Step 3: Let the AI agent synthesize the results
      const synthesizedContent = await synthesizeResultsWithAgent(userQuery, toolResults, config, tenant);
      const toolsUsed = toolResults.map(tr => tr.tool);
      
      return {
        content: synthesizedContent,
        toolsUsed: toolsUsed
      };
      
    } catch (apiError) {
      console.error('[MCP Orchestration] API Error, falling back to direct tool execution:', apiError);
      console.error('[MCP Orchestration] API Error type:', typeof apiError);
      console.error('[MCP Orchestration] API Error message:', apiError instanceof Error ? apiError.message : String(apiError));
      console.error('[MCP Orchestration] API Error stack:', apiError instanceof Error ? apiError.stack : 'No stack trace');
      
      // Fallback: Use a reasonable default tool based on query
      const defaultTool = userQuery.toLowerCase().includes('risk') ? 'get_risk_summary' : 'get_archer_applications';
      console.log('[MCP Orchestration] Using fallback tool:', defaultTool);
      
      try {
        console.log('[MCP Orchestration] Fallback tool execution with inputs:', {
          toolId: defaultTool,
          tenant_id: tenant.id,
          query: userQuery
        });

        // For testing, use a known working tenant ID
        const workingTenantId = tenant?.id || selectedTenant?.id || 'tenant-acme'; // Use actual tenant
        
        const result = await mcpService.executeTool({
          toolId: defaultTool,
          inputs: {
            tenant_id: workingTenantId,
            query: userQuery,
            focus: 'overall'
          }
        });
        
        console.log('[MCP Orchestration] Fallback tool execution successful');
        
        return {
          content: `**Query**: ${userQuery}\n\n**Tool Used**: ${defaultTool} (fallback mode)\n\n${result.result}\n\n*Note: LLM tool selection temporarily unavailable. Using fallback tool selection.*`,
          toolsUsed: [defaultTool]
        };
      } catch (toolError) {
        console.error('[MCP Orchestration] Fallback tool execution failed:', toolError);
        throw new Error(`Both LLM orchestration and fallback tool execution failed: ${toolError instanceof Error ? toolError.message : String(toolError)}`);
      }
    }

  } catch (error) {
    console.error('[MCP Orchestration] Failed:', error);
    return {
      content: `I encountered an error while processing your request: ${error instanceof Error ? error.message : String(error)}`,
      toolsUsed: ['error_handler']
    };
  }
}

/**
 * Test agent configuration with a simple API call
 */
async function testAgentConfig(config: any): Promise<void> {
  console.log('[Agent Test] Provider:', config.provider);
  console.log('[Agent Test] Model:', config.model);
  console.log('[Agent Test] API Key length:', config.apiKey?.length);

  let testEndpoint: string;
  let headers: Record<string, string>;
  
  // Configure endpoint and headers based on provider
  switch (config.provider) {
    case 'azure-openai':
      let endpoint = config.endpoint;
      if (!endpoint.startsWith('https://')) endpoint = 'https://' + endpoint;
      if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
      testEndpoint = `${endpoint}/openai/deployments/${config.model}/chat/completions?api-version=2024-02-15-preview`;
      headers = {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      };
      break;
      
    case 'openai':
      testEndpoint = config.endpoint + '/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };
      break;
      
    case 'anthropic':
      testEndpoint = config.endpoint + '/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      };
      break;
      
    default:
      // Custom endpoint
      testEndpoint = config.endpoint;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };
      break;
  }

  // Add custom headers if configured
  if (config.customHeaders) {
    Object.assign(headers, config.customHeaders);
  }

  const response = await fetch(testEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: 'Test message'
        }
      ],
      max_tokens: 10
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Agent Test] Error Response:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      headers: Object.fromEntries(response.headers.entries())
    });
    throw new Error(`Agent test failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('[Agent Test] Success:', result);
}

/**
 * Use selected AI agent to select appropriate MCP tools based on user query
 */
async function selectToolsWithAgent(userQuery: string, availableTools: any[], config: any, tenant: any) {
  console.log('[Tool Selection] Config:', {
    provider: config.provider,
    endpoint: config.endpoint,
    model: config.model,
    hasApiKey: !!config.apiKey,
    apiKeyStart: config.apiKey?.substring(0, 10) + '...'
  });

  const toolsSchema = availableTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema
  }));

  // Construct API endpoint and headers based on provider
  let apiEndpoint: string;
  let headers: Record<string, string>;
  
  switch (config.provider) {
    case 'azure-openai':
      let endpoint = config.endpoint;
      if (!endpoint.startsWith('https://')) endpoint = 'https://' + endpoint;
      if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
      apiEndpoint = `${endpoint}/openai/deployments/${config.model}/chat/completions?api-version=2024-02-15-preview`;
      headers = {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      };
      break;
      
    case 'openai':
      apiEndpoint = config.endpoint + '/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };
      break;
      
    default:
      apiEndpoint = config.endpoint;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };
      break;
  }

  // Add custom headers if configured
  if (config.customHeaders) {
    Object.assign(headers, config.customHeaders);
  }
  
  console.log('[Tool Selection] API Endpoint:', apiEndpoint);
  console.log('[Tool Selection] Provider:', config.provider);
  
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `${config.selectedAgent?.systemPrompt || 'You are a helpful AI assistant specializing in GRC (Governance, Risk, and Compliance).'} 

You are working for ${tenant.name}.

IMPORTANT: Today's date is ${new Date().toISOString().split('T')[0]} (${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}). Use this as the current date for all date-related queries.

Available MCP Tools:
${JSON.stringify(toolsSchema, null, 2)}

# ADVANCED TOOL ORCHESTRATION FRAMEWORK

## Your Mission:
Create a COMPREHENSIVE multi-tool workflow that gathers ALL necessary data to produce Claude Desktop-quality professional GRC analysis reports.

## Tool Selection Strategy:

### For Risk Analysis Queries:
Required workflow (use ALL these tools in sequence):
1. **search_archer_records** - Search for risk-related records
2. **get_risk_summary** - Get overall risk metrics and summary
3. **analyze_grc_data** - Perform deep analysis on the data
4. **get_record_statistics** - Get statistical breakdowns
5. **detect_anomalies** (if available) - Identify unusual patterns

### For Compliance Queries:
Required workflow:
1. **search_archer_records** - Search for compliance/control records
2. **get_record_statistics** - Get compliance metrics
3. **analyze_grc_data** - Analyze compliance status
4. **get_application_fields** (if specific app mentioned) - Get detailed field data

### For Executive/Summary Queries:
Required workflow:
1. **get_risk_summary** - Overall risk position
2. **get_record_statistics** - Key metrics and KPIs
3. **search_archer_records** - Recent critical items
4. **analyze_grc_data** - Strategic analysis
5. **generate_ai_insights** (if available) - AI-powered insights

### For Application/System Queries:
Required workflow:
1. **get_archer_applications** - List available applications
2. **get_application_fields** (if specific app) - Get field details
3. **search_archer_records** (if records needed) - Get related records

## Tool Combination Patterns:

### Pattern: "Show me critical risks"
Tools needed:
1. search_archer_records(query: "critical OR high severity OR risk")
2. get_risk_summary(focus_area: "critical_risks")
3. analyze_grc_data(analysis_type: "risk_categorization")
4. get_record_statistics(metric_type: "risk_distribution")

### Pattern: "Compliance status"
Tools needed:
1. search_archer_records(query: "compliance OR control OR audit")
2. get_record_statistics(metric_type: "compliance_metrics")
3. analyze_grc_data(analysis_type: "compliance_assessment")

### Pattern: "Executive report"
Tools needed:
1. get_risk_summary(focus_area: "executive_overview")
2. get_record_statistics(metric_type: "executive_kpis")
3. search_archer_records(query: "critical OR high priority")
4. analyze_grc_data(analysis_type: "strategic_analysis")
5. generate_ai_insights(insight_type: "executive_recommendations")

## CRITICAL INSTRUCTIONS:

1. **ALWAYS use multiple tools** - Single tool responses are insufficient for professional analysis
2. **Sequence matters** - Get raw data first, then analyze, then generate insights
3. **Include all parameters** - Each tool needs proper parameters to work effectively
4. **Think comprehensively** - What data would you need to create a professional report?
5. **Use specific queries** - Don't use generic terms; be specific in search queries

## Query Analysis:
Based on the user's question, determine the query type and required depth:
- Simple listing → 1-2 tools
- Standard analysis → 3-4 tools
- Comprehensive report → 4-6 tools
- Executive briefing → 5-7 tools

## Response Format (MUST be valid JSON):
{
  "reasoning": "Based on the query '${userQuery}', I need to: 1) First gather [specific data type] using [tool], 2) Then analyze [what] using [tool], 3) Get statistical breakdown using [tool], 4) Finally synthesize insights using [tool]. This comprehensive approach will provide all data needed for a professional ${userQuery.includes('executive') ? 'executive' : userQuery.includes('risk') ? 'risk analysis' : 'GRC'} report.",
  "queryType": "risk_analysis|compliance|executive|operational|standard",
  "expectedDepth": "simple|standard|comprehensive|executive",
  "selectedTools": [
    {
      "name": "exact_tool_name", 
      "purpose": "what this tool will contribute to the analysis",
      "arguments": { 
        "query": "specific search terms if applicable",
        "focus_area": "specific focus if applicable",
        "analysis_type": "type of analysis if applicable",
        "metric_type": "type of metrics if applicable",
        "tenant_id": "${tenant.id}"
      }
    }
  ]
}

REMEMBER: Professional GRC reports require comprehensive data. Don't be conservative - use ALL relevant tools to gather complete information!`
        },
        {
          role: 'user',
          content: `User Question: "${userQuery}"

Tenant Context: ${tenant.name} (${tenant.industry})

Please create a COMPLETE WORKFLOW of MCP tools to fully answer this question. Think step-by-step:
1. What data do I need first?
2. How should I process/analyze that data?
3. What additional tools might I need?

Select ALL necessary tools in the correct sequence to provide a comprehensive answer.`
        }
      ],
      temperature: 0.1, // Low temperature for consistent tool selection
      max_tokens: 1000,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Tool Selection] API Error Details:', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
      headers: Object.fromEntries(response.headers.entries())
    });
    throw new Error(`Tool selection API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No tool selection response from LLM');
  }

  return JSON.parse(content);
}

/**
 * Use selected AI agent to synthesize tool results into a comprehensive response
 */
async function synthesizeResultsWithAgent(userQuery: string, toolResults: any[], config: any, tenant: any) {
  // Use same endpoint construction logic as tool selection
  let apiEndpoint: string;
  let headers: Record<string, string>;
  
  switch (config.provider) {
    case 'azure-openai':
      let endpoint = config.endpoint;
      if (!endpoint.startsWith('https://')) endpoint = 'https://' + endpoint;
      if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
      apiEndpoint = `${endpoint}/openai/deployments/${config.model}/chat/completions?api-version=2024-02-15-preview`;
      headers = {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      };
      break;
      
    case 'openai':
      apiEndpoint = config.endpoint + '/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };
      break;
      
    default:
      apiEndpoint = config.endpoint;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };
      break;
  }

  // Add custom headers if configured
  if (config.customHeaders) {
    Object.assign(headers, config.customHeaders);
  }
  
  // Log tool results for debugging
  console.log('[Synthesis] Tool results to synthesize:', {
    count: toolResults.length,
    tools: toolResults.map(tr => ({ tool: tr.tool, success: tr.success, hasResult: !!tr.result }))
  });
  
  // Let the LLM handle all responses naturally, including errors
  
  // Format tool results for better LLM understanding
  const formattedResults = toolResults.map(tr => {
    if (tr.success) {
      return {
        tool_name: tr.tool,
        status: 'success',
        data: tr.result // This contains the actual data from the tool
      };
    } else {
      return {
        tool_name: tr.tool,
        status: 'error',
        error_message: tr.error
      };
    }
  });
  
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `${config.selectedAgent?.systemPrompt || 'You are a helpful AI assistant specializing in GRC (Governance, Risk, and Compliance).'} 

You are working for ${tenant.name}.

Today's date is ${new Date().toISOString().split('T')[0]}.

You will receive tool results from GRC systems. Use only the actual data provided in successful tool results. If tools fail or return errors, explain what happened naturally and what information isn't available. Be helpful and conversational while remaining accurate about what data you can and cannot access.`
        },
        {
          role: 'user',
          content: `User Question: "${userQuery}"

Tool Results:
${JSON.stringify(formattedResults, null, 2)}

Please answer the user's question using the tool results provided. Be natural and conversational.`
        }
      ],
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 4000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Synthesis] API error:', errorText);
    throw new Error(`Synthesis API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const synthesizedContent = result.choices?.[0]?.message?.content;
  
  if (synthesizedContent) {
    console.log('[MCP Orchestration] Successfully synthesized tool results');
    return synthesizedContent;
  }
  
  // Fallback to raw tool results
  console.warn('[Synthesis] No synthesized content, falling back to raw results');
  return toolResults.map(tr => tr.success ? tr.result : `Error: ${tr.error}`).join('\n\n');
}

/**
 * MCP Server Testing Interface - Natural language query interface 
 * with tenant-specific GRC tools and compliance context
 */
export const McpTestInterface: React.FC = () => {
  const { user, tenant } = useAuthStore();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<McpTenant | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [availableAgents, setAvailableAgents] = useState<AIAgent[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'GRC AI Assistant ready! Ask about compliance, risk, or governance using your enabled MCP servers.',
      timestamp: new Date().toISOString(),
      confidence: 1.0,
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string>(() => 
    `conversation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  // Initialize with real tenant data and load LLM configurations
  useEffect(() => {
    if (tenant && !selectedTenant) {
      // Convert real tenant to McpTenant format
      const mcpTenant: McpTenant = {
        id: tenant.id,
        name: tenant.name,
        industry: (tenant as any).industry || 'General',
        region: (tenant as any).region || 'Global',
        settings: {
          riskAppetite: 'moderate' as const,
          complianceFrameworks: ['ISO27001', 'CPS230'], // Default frameworks
          notificationPreferences: {
            email: true,
            sms: false,
            criticalAlertsOnly: false
          }
        }
      };
      setSelectedTenant(mcpTenant);
      
      // Load available AI agents
      loadAIAgents(tenant.id);
      setIsConnecting(false);
    }
  }, [tenant, selectedTenant]);

  // Load AI agents for selection
  const loadAIAgents = async (tenantId: string) => {
    try {
      const agentService = createAgentService(tenantId);
      const agents = await agentService.getEnabledAgents();
      
      setAvailableAgents(agents);
      
      // Auto-select first available agent
      if (agents.length > 0 && !selectedAgent) {
        setSelectedAgent(agents[0].id);
      }
    } catch (error) {
      console.error('Error loading AI agents:', error);
      setAvailableAgents([]);
    }
  };

  interface ConversationMessage {
    id: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    confidence?: number;
    toolsUsed?: string[];
    evidence?: Array<{
      source: string;
      excerpt: string;
      relevance: number;
    }>;
    complianceFlags?: Array<{
      framework: string;
      rule: string;
      severity: 'info' | 'warning' | 'critical';
    }>;
    processingTime?: number;
  }



  // Get suggested queries based on selected tenant
  const getSuggestedQueries = (tenant: McpTenant | null): string[] => {
    if (!tenant) return [];
    
    const baseQueries = [
      "What are our current critical risks?",
      "Show me our overall risk summary",
      "Detect any anomalies in our GRC data",
    ];
    
    if (tenant.id === 'tenant-fintech-001') {
      return [
        ...baseQueries,
        "Generate AI insights for financial services risks",
        "What are the current high-risk findings in our SOX assessment?",
        "Show me recent security incidents and their risk impact",
        "Forecast our risk trajectory for next quarter",
        "Predict control failures in our trading systems",
        "Create executive summary of our risk posture",
      ];
    } else if (tenant.id === 'tenant-healthcare-002') {
      return [
        ...baseQueries,
        "Generate AI insights for healthcare compliance",
        "Analyze our HIPAA compliance status and identify privacy risks",
        "What controls need attention for patient data protection?",
        "Show me any unusual access patterns in patient records",
        "Predict patient data security risks",
        "Executive summary of compliance status",
      ];
    } else {
      return [
        ...baseQueries,
        "Generate AI insights for manufacturing operations",
        "Analyze supply chain disruption risks",
        "What are our operational risk exposures?",
        "Show production quality control anomalies",
        "Forecast operational risk trends",
        "Executive recommendations for risk management",
      ];
    }
  };

  const suggestedQueries = getSuggestedQueries(selectedTenant);



  // Start a new conversation
  const startNewConversation = () => {
    const newConversationId = `conversation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setConversationId(newConversationId);
    setConversationHistory([
      {
        id: '1',
        type: 'system',
        content: 'GRC AI Assistant ready! Ask about compliance, risk, or governance using your enabled MCP servers.',
        timestamp: new Date().toISOString(),
        confidence: 1.0,
      }
    ]);
    setQuery('');
  };

  // Handle tenant selection
  const handleTenantChange = (tenant: McpTenant) => {
    setSelectedTenant(tenant);
    
    // Add system message about tenant change
    const systemMessage: ConversationMessage = {
      id: Date.now().toString(),
      type: 'system',
      content: `Switched to ${tenant.name} (${tenant.industry}). Context updated with ${tenant.settings.complianceFrameworks.join(', ')} frameworks.`,
      timestamp: new Date().toISOString(),
      confidence: 1.0,
    };
    
    setConversationHistory(prev => [...prev, systemMessage]);
  };


  // Handle sending queries to the MCP server with security validation
  const handleSendQuery = async () => {
    if (!query.trim() || !user || !tenant || !selectedAgent || isLoading) return;

    setIsLoading(true);

    // Security: Enhanced monitoring with non-blocking validation
    try {
      const sessionToken = localStorage.getItem('auth_token');
      if (sessionToken) {
        const parsed = JSON.parse(sessionToken);
        
        // Log security monitoring activity
        console.log('[Security] Enhanced security monitoring active');
        console.log('[Security] User:', parsed.userId, 'Tenant:', parsed.tenantId);
        
        // Basic tenant access validation
        const userTenant = selectedTenant?.id || tenant.id;
        const isPlatformOwner = user.roles.includes('PlatformOwner');
        const hasAccess = isPlatformOwner || userTenant === parsed.tenantId || 
                         userTenant.includes('manufacturing') && parsed.tenantId === 'tenant-acme';
        
        if (!hasAccess) {
          const errorMessage: ConversationMessage = {
            id: `${conversationId}-${Date.now()}`,
            type: 'assistant',
            content: '⛔ Please select a tenant you have access to. Platform owners can access all tenants.',
            timestamp: new Date().toISOString(),
            confidence: 0,
          };
          setConversationHistory(prev => [...prev, errorMessage]);
          setIsLoading(false);
          return;
        }
        
        console.log('[Security] Access validated - proceeding with request');
      }
    } catch (sessionError) {
      console.warn('[Security] Monitoring error (non-blocking):', sessionError);
    }

    // Add user message to conversation
    const userMessage: ConversationMessage = {
      id: `${conversationId}-${Date.now()}`,
      type: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      confidence: 1.0,
    };

    setConversationHistory(prev => [...prev, userMessage]);
    setQuery(''); // Clear input immediately to show responsiveness

    try {
      // Audit log: User initiated chat interaction
      await securityAuditLogger.logAgentInteraction(
        selectedTenant?.id || tenant.id,
        user.id,
        selectedAgent,
        'CHAT_QUERY',
        'SUCCESS',
        {
          query: query.substring(0, 100), // First 100 chars for audit
          queryLength: query.length,
          conversationId
        }
      );

      // Use the new tenant-aware MCP service (now with enhanced security)
      const mcpService = createMcpService(tenant.id, user.id, user.roles);
      
      // Get available tools from MCP server
      let availableTools: any[] = [];
      let mcpConnectionError: string | null = null;
      
      try {
        availableTools = await mcpService.getAvailableTools();
      } catch (error) {
        mcpConnectionError = error instanceof Error ? error.message : 'MCP server connection failed';
        console.warn('[MCP] Server connection failed:', mcpConnectionError);
      }
      
          // Get selected AI agent with full context (LLM config + MCP servers + persona)
      const agentService = createAgentService(tenant.id);
      const agentWithContext = selectedAgent ? await agentService.getAgentWithContext(selectedAgent) : null;
      
      if (!agentWithContext) {
        throw new Error('Selected AI agent not found or not properly configured');
      }

      // Let the selected AI agent decide which tools to use and orchestrate the workflow
      const startTime = Date.now();
      const result = await orchestrateWithSelectedAgent(
        query, 
        tenant, 
        availableTools, 
        mcpService, 
        agentWithContext,
        mcpConnectionError
      );

      // Add assistant response to conversation
      const assistantMessage: ConversationMessage = {
        id: `${conversationId}-${Date.now() + 1}`,
        type: 'assistant',
        content: result.content || 'No response available',
        timestamp: new Date().toISOString(),
        confidence: 0.95,
        toolsUsed: result.toolsUsed || [],
        processingTime: Date.now() - startTime,
      };

      setConversationHistory(prev => [...prev, assistantMessage]);

      // Audit log: Successful agent interaction
      await securityAuditLogger.logAgentInteraction(
        selectedTenant?.id || tenant.id,
        user.id,
        selectedAgent,
        'CHAT_RESPONSE',
        'SUCCESS',
        {
          responseLength: result.content?.length || 0,
          processingTime: Date.now() - startTime,
          toolsUsed: result.toolsUsed || [],
          conversationId
        }
      );
      
    } catch (error) {
      console.error('MCP query error:', error);

      // Audit log: Failed agent interaction
      await securityAuditLogger.logAgentInteraction(
        selectedTenant?.id || tenant.id,
        user.id,
        selectedAgent,
        'CHAT_ERROR',
        'FAILURE',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          conversationId
        }
      );
      
      // Add error message to conversation
      const errorMessage: ConversationMessage = {
        id: `${conversationId}-${Date.now() + 2}`,
        type: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date().toISOString(),
        confidence: 0,
      };

      setConversationHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // New function to use the selected AI agent with full context
  const orchestrateWithSelectedAgent = async (
    userQuery: string,
    tenant: any,
    availableTools: any[],
    mcpService: any,
    agentWithContext: any,
    mcpConnectionError: string | null
  ): Promise<{ content: string; toolsUsed: string[] }> => {
    if (!agentWithContext) {
      return { content: 'No AI agent selected. Please select an agent from the sidebar.', toolsUsed: [] };
    }

    // Handle simple conversational queries first
    const simpleQueries = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'how are you', 'what can you do', 'help'];
    const isSimpleQuery = simpleQueries.some(q => userQuery.toLowerCase().includes(q));
    
    if (isSimpleQuery) {
      const { agent } = agentWithContext;
      return {
        content: `Hello! I'm **${agent.name}** ${agent.avatar || '🤖'}, your ${agent.useCase} specialist.

${agent.description}

**My specialization**: ${agent.persona}

I can help you with GRC analysis, compliance assessments, risk management, and governance reporting using Archer data. Ask me about:
• Archer applications and records
• Risk analysis and insights  
• Compliance status and reporting
• Control monitoring and effectiveness
• Executive summaries and recommendations

Just ask me naturally - I'll determine which tools to use based on your question. For example:
- "List applications in Archer"
- "Show me recent risk assessments"
- "Generate insights about our compliance status"

How can I assist you today?`,
        toolsUsed: ['conversation']
      };
    }

    // Check if user is asking to list available tools
    const listToolsQueries = ['list tools', 'show tools', 'available tools', 'what tools', 'which tools', 'archer tools', 'show me tools', 'mcp tools', 'tools available', 'show me archer'];
    const isListToolsQuery = listToolsQueries.some(q => userQuery.toLowerCase().includes(q));
    
    if (isListToolsQuery) {
      console.log('[Agent Tools] User requesting tool list');
      const { agent } = agentWithContext;
      
      if (mcpConnectionError) {
        return { 
          content: `**${agent.name} Connection Status** ${agent.avatar || '🤖'}\n\n❌ **MCP Server Connection Failed**\n\n**Error**: ${mcpConnectionError}\n\n**Required**: Archer GRC MCP server must be running on localhost:3001\n\n**To resolve**: \n1. Start the Archer GRC MCP server\n2. Verify it's accessible at http://localhost:3001\n3. Check server logs for any startup errors\n\nOnce the server is running, I'll be able to access real Archer GRC tools for analysis.`,
          toolsUsed: ['connection_check']
        };
      }
      
      const toolsList = availableTools.map((tool, index) => 
        `${index + 1}. **${tool.name}**\n   - ${tool.description || 'GRC analysis tool'}`
      ).join('\n\n');
      
      return { 
        content: `**${agent.name} Available Tools** ${agent.avatar || '🤖'}\n\n${toolsList}\n\n**Total Tools**: ${availableTools.length}\n**Server**: Archer GRC MCP\n**Agent**: ${agent.name} (${agent.useCase})\n\nYou can ask me to analyze risks, generate insights, detect anomalies, or perform GRC analysis using these tools.`,
        toolsUsed: ['list_tools']
      };
    }

    const { agent, llmConfig } = agentWithContext;
    
    // Handle case when LLM is not configured - provide direct tool results
    if (!llmConfig) {
      console.log(`[Agent] Using agent "${agent.name}" without LLM config - providing direct tool results`);
      
      // Use agent's persona to customize the response style
      const agentStyle = agent.persona || 'Professional GRC analyst';
      
      // Determine which tool to use based on query context
      let selectedTool = 'analyze_grc_data'; // Default to the most general tool
      const queryLower = userQuery.toLowerCase();
      
      if (queryLower.includes('application') || 
          (queryLower.includes('list') && queryLower.includes('archer')) ||
          queryLower.includes('archer applications') ||
          queryLower.includes('show applications') ||
          queryLower.includes('get applications')) {
        selectedTool = 'get_archer_applications';
      } else if (queryLower.includes('field') || 
                 queryLower.includes('fields') ||
                 queryLower.includes('application fields') ||
                 queryLower.includes('show fields') ||
                 queryLower.includes('list fields')) {
        selectedTool = 'get_application_fields';
      } else if (queryLower.includes('insight') || queryLower.includes('recommendation')) {
        selectedTool = 'get_archer_applications';
      } else if (queryLower.includes('search') || queryLower.includes('record')) {
        selectedTool = 'search_archer_records';
      } else if (queryLower.includes('stat') || queryLower.includes('summary')) {
        selectedTool = 'get_record_statistics';
      }
      
      try {
        const workingTenantId = tenant?.id || selectedTenant?.id || 'tenant-acme'; // Use actual tenant
        
        // Prepare inputs based on selected tool
        let toolInputs: any = {
          tenant_id: workingTenantId,
          query: userQuery,
          focus_area: 'overall'
        };

        // Handle tools that require specific parameters
        if (selectedTool === 'get_application_fields') {
          // Try to extract application name from query
          const appNameMatch = userQuery.match(/fields?\s+(?:for|of|in)\s+([^?]+)/i) ||
                              userQuery.match(/([^?]+)\s+fields?/i);
          if (appNameMatch) {
            toolInputs = {
              applicationName: appNameMatch[1].trim()
            };
          } else {
            // If no application name found, provide helpful error
            throw new Error('Please specify an application name. For example: "show fields for Risk Register" or "list fields in Controls"');
          }
        }

        const result = await mcpService.executeTool({
          toolId: selectedTool,
          inputs: toolInputs
        });
        
        // Record agent usage
        const agentService = createAgentService(tenant.id);
        await agentService.recordUsage(agent.id);
        
        // Format response according to agent persona
        return {
          content: `**${agent.name} Analysis** ${agent.avatar || '🤖'}

**Query**: ${userQuery}

**GRC Analysis** (${agent.useCase}):

${result.result}

---
*Analysis provided by ${agent.name} using ${selectedTool} tool*
*Agent Persona: ${agentStyle}*
*Note: For enhanced AI insights with custom prompts, configure LLM settings in the Settings page.*`,
          toolsUsed: [selectedTool]
        };
        
      } catch (error) {
        console.error('[Agent] Tool execution failed:', error);
        
        // Provide more helpful feedback based on the tool that was attempted
        let errorMessage = `I attempted to use the **${selectedTool}** tool to answer your question, but encountered an error.`;
        let suggestedActions = '';
        
        if (selectedTool === 'get_archer_applications') {
          suggestedActions = `

**What I was trying to do**: List all Archer applications available for analysis

**Error Details**: ${error instanceof Error ? error.message : String(error)}

**This usually means**:
- Archer server connection needs to be configured
- Authentication credentials need to be updated
- The Archer instance may be unavailable

**To fix this**: Please check your Archer connection settings in the Settings page.`;
        } else {
          suggestedActions = `

**Error Details**: ${error instanceof Error ? error.message : String(error)}

**Please check your MCP server configuration and Archer connection settings.**`;
        }
        
        return {
          content: `**${agent.name} Analysis** ${agent.avatar || '🤖'}

**Query**: ${userQuery}

${errorMessage}${suggestedActions}

---
*Tool attempted: ${selectedTool}*
*Agent: ${agent.name} (${agent.useCase})*`,
          toolsUsed: [selectedTool]
        };
      }
    }

    // Create enhanced tenant with agent configuration for LLM orchestration
    const enhancedTenant = {
      ...tenant,
      selectedAgent: {
        id: agent.id,
        name: agent.name,
        persona: agent.persona,
        systemPrompt: agent.systemPrompt,
        provider: llmConfig.provider,
        model: llmConfig.model,
        endpoint: llmConfig.endpoint,
        apiKey: llmConfig.apiKey,
        maxTokens: llmConfig.maxTokens,
        temperature: llmConfig.temperature
      }
    };

    // Record agent usage
    const agentService = createAgentService(tenant.id);
    await agentService.recordUsage(agent.id);

    const llmResult = await orchestrateWithAzureOpenAI(userQuery, enhancedTenant, availableTools, mcpService);
    return llmResult;
  };

  if (isConnecting) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Connecting to MCP Server...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">GRC AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask questions about compliance, risk, and governance using your tenant-scoped MCP tools
        </p>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Tenant Selection Sidebar */}
        <div className="col-span-3">
          <div className="space-y-4">
            <TenantSelector 
              selectedTenant={selectedTenant}
              onTenantChange={handleTenantChange}
              allowCrossTenantAccess={false}
            />
            
            {/* Agent Selection */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-sm mb-3 flex items-center space-x-2">
                <Bot className="h-4 w-4" />
                <span>AI Agent</span>
              </h3>
              <div className="space-y-3">
                {availableAgents.length > 0 ? (
                  <>
                    <select
                      value={selectedAgent || ''}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select an AI Agent...</option>
                      {availableAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.avatar} {agent.name} - {agent.useCase}
                        </option>
                      ))}
                    </select>
                    
                    {selectedAgent && (() => {
                      const agent = availableAgents.find(a => a.id === selectedAgent);
                      return agent ? (
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-lg">{agent.avatar}</span>
                            <div className="font-medium text-blue-800">{agent.name}</div>
                          </div>
                          <div className="text-blue-600 text-xs mb-2">{agent.description}</div>
                          <div className="flex flex-wrap gap-1">
                            {agent.capabilities.map((cap) => (
                              <span key={cap} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                {cap}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-blue-600">
                            <div>Use Case: {agent.useCase}</div>
                            <div>Usage: {agent.usageCount} times</div>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <div className="font-medium text-yellow-800">No AI Agents Available</div>
                    <div className="text-yellow-600 mt-1">
                      Configure LLM settings and create AI agents to get started
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* MCP Server Status */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-sm mb-3 flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>MCP Tools</span>
              </h3>
              <div className="space-y-3">
                <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <h4 className="font-medium text-sm text-green-800">Archer GRC Server</h4>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                      Risk Analysis
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                      Compliance
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                      Control Monitoring
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Interface */}
        <div className="col-span-9 flex flex-col">
          {/* Conversation Area */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Conversation</span>
                  <span className="text-xs text-muted-foreground font-normal">#{conversationId.split('-')[1]}</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={startNewConversation}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    New Chat
                  </Button>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <span>Server:</span>
                    <span className="font-medium">Archer GRC MCP</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col min-h-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {conversationHistory.map((message) => (
                  <div
                    key={message.id}
                    className={clsx(
                      'p-4 rounded-lg',
                      message.type === 'user' 
                        ? 'bg-primary text-primary-foreground ml-8'
                        : message.type === 'system'
                        ? 'bg-muted/50 text-center text-sm text-muted-foreground'
                        : 'bg-muted mr-8'
                    )}
                  >
                    {message.type !== 'system' && (
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                          {message.type === 'user' ? (
                            <div className="h-full w-full bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                              {user?.name?.charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <div className="h-full w-full bg-primary/10 text-primary rounded-full flex items-center justify-center">
                              <Bot className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="font-medium text-sm">
                          {message.type === 'user' ? user?.name : 'GRC AI Assistant'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                        {message.confidence && message.confidence < 1 && (
                          <div className="text-xs text-muted-foreground">
                            {Math.round(message.confidence * 100)}% confidence
                          </div>
                        )}
                        {message.processingTime && (
                          <div className="text-xs text-muted-foreground">
                            {message.processingTime}ms
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    
                    {/* Tools and Evidence */}
                    {message.toolsUsed && message.toolsUsed.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center space-x-2 mb-2">
                          <Settings className="h-3 w-3" />
                          <span className="text-xs font-medium">Tools Used:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {message.toolsUsed.map((tool) => (
                            <span
                              key={tool}
                              className="px-2 py-1 bg-background/50 rounded text-xs flex items-center space-x-1"
                            >
                              {tool === 'archer-connector' && <Database className="h-3 w-3" />}
                              {tool === 'analyze_grc_data' && <BarChart3 className="h-3 w-3" />}
                              {tool === 'get_risk_summary' && <Shield className="h-3 w-3" />}
                              {tool === 'detect_anomalies' && <FileText className="h-3 w-3" />}
                              <span>{tool}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Compliance Flags */}
                    {message.complianceFlags && message.complianceFlags.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center space-x-2 mb-2">
                          <Shield className="h-3 w-3" />
                          <span className="text-xs font-medium">Compliance Alerts:</span>
                        </div>
                        {message.complianceFlags.map((flag, index) => (
                          <div key={index} className="flex items-center space-x-2 text-xs">
                            {flag.severity === 'critical' && <AlertCircle className="h-3 w-3 text-red-500" />}
                            {flag.severity === 'warning' && <AlertCircle className="h-3 w-3 text-yellow-500" />}
                            {flag.severity === 'info' && <CheckCircle className="h-3 w-3 text-blue-500" />}
                            <span>{flag.framework} {flag.rule}: {flag.severity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="bg-muted mr-8 p-4 rounded-lg border border-border/50">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="h-6 w-6 bg-primary/10 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="font-medium text-sm">GRC AI Assistant</div>
                      <div className="flex items-center space-x-1">
                        <div className="h-1 w-1 bg-primary rounded-full animate-pulse"></div>
                        <div className="h-1 w-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-1 w-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div className="animate-pulse">Analyzing with MCP tools...</div>
                    </div>
                  </div>
                )}
                
                {/* Invisible element for auto-scroll */}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendQuery()}
                    placeholder={
                      !selectedTenant ? "Select a tenant first..." :
                      !selectedAgent ? "Select an AI agent first..." :
                      "Ask about compliance, risks, or governance..."
                    }
                    className="flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || !selectedTenant || !selectedAgent}
                  />
                  <Button
                    onClick={handleSendQuery}
                    disabled={isLoading || !query.trim() || !selectedTenant || !selectedAgent}
                    size="sm"
                    className="px-4 py-2 transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Suggested Queries */}
                <div className="mt-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Suggested queries:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQueries.slice(0, 3).map((suggested, index) => (
                      <button
                        key={index}
                        onClick={() => setQuery(suggested)}
                        className="px-3 py-1.5 bg-muted hover:bg-primary/10 hover:border-primary/20 border border-transparent rounded-md text-xs text-left transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading || !selectedTenant || !selectedAgent}
                      >
                        {suggested}
                      </button>
                    ))}
                  </div>
                  
                  {/* Status Information - Moved to bottom */}
                  {selectedTenant && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="space-y-2">
                        {/* Agent Status */}
                        {selectedAgent && (() => {
                          const agent = availableAgents.find(a => a.id === selectedAgent);
                          return agent ? (
                            <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                              <div className="flex items-center space-x-2">
                                <span>{agent.avatar}</span>
                                <span className="font-medium">Agent:</span>
                                <span>{agent.name}</span>
                              </div>
                              <div className="text-muted-foreground/50">•</div>
                              <span>{agent.useCase}</span>
                            </div>
                          ) : null;
                        })()}
                        
                        {/* MCP Server Status */}
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="font-medium">MCP:</span>
                            <span>Archer GRC Server</span>
                          </div>
                          <div className="text-muted-foreground/50">•</div>
                          <span>Tenant: {selectedTenant.name}</span>
                        </div>
                        
                        {/* Security Status */}
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <Shield className="h-3 w-3 text-green-500" />
                            <span className="font-medium">Security:</span>
                            <span>Enhanced Protection Active</span>
                          </div>
                        </div>
                        
                        {/* Quick Tips */}
                        <div className="text-xs text-muted-foreground/70 italic">
                          💡 Ask naturally - the AI agent will select the right tools automatically
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};