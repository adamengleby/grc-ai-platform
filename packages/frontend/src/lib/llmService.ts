/**
 * LLM Service - Handles AI model interactions with Archer MCP integration
 */

import { AIAgent } from '@/types/agent';
import { PrivacyProtectionService, getPrivacyConfig } from './privacyProtectionService';
import { mcpSSEClient } from '@/services/mcpSSEClient';

// LLM-related interfaces
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
  toolsUsed: string[];
  toolResults: any[];
  processingTime: number;
}

export interface AgentConfig {
  promptTemplate?: string;
}

export interface LLMConfig {
  provider: 'azure_openai' | 'openai' | 'anthropic';
  model: string;
  apiKey?: string;
  endpoint?: string;
  temperature: number;
  maxTokens: number;
  rateLimit?: number; // Requests per minute - configurable rate limiting
  responseFormat?: 'text' | 'json_object';
}

export interface ToolResult {
  id: string;
  name: string;
  result: any;
  success: boolean;
  error?: string;
}

export interface FunctionCallResponse {
  functionCalls?: Array<{
    id: string;
    name: string;
    arguments: any;
  }>;
  content: string;
  finishReason: string;
}

/**
 * LLM Service for processing agent requests with Archer integration
 */
export class LLMService {
  private tenantId: string;
  private privacyService: PrivacyProtectionService | null = null;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.initializePrivacyProtection();
  }

  /**
   * CRITICAL: Initialize privacy protection to prevent confidential data leakage to LLMs
   */
  private async initializePrivacyProtection() {
    try {
      const privacyConfig = await getPrivacyConfig(this.tenantId);
      this.privacyService = new PrivacyProtectionService(privacyConfig);
      console.log(`🔒 Privacy protection initialized for tenant ${this.tenantId}:`, {
        masking: privacyConfig.enableMasking,
        level: privacyConfig.maskingLevel
      });
    } catch (error) {
      console.error('❌ Failed to initialize privacy protection - using safe defaults:', error);
      this.privacyService = new PrivacyProtectionService({
        enableMasking: true,
        maskingLevel: 'strict',
        customSensitiveFields: []
      });
    }
  }

  /**
   * Get available MCP functions for this agent from ALL enabled MCP servers
   */
  private async getMCPToolsAsLLMFunctions(agent: AIAgent): Promise<any[]> {
    try {
      console.log(`[LLM Service] 🔧 Fetching MCP tools for agent ${agent.name} with enabled servers:`, agent.enabledMcpServers);
      
      // Get MCP server configurations for this tenant
      const mcpConfigsResponse = await fetch('/api/v1/simple-mcp-configs');
      if (!mcpConfigsResponse.ok) {
        throw new Error(`Failed to fetch MCP configs: ${mcpConfigsResponse.status}`);
      }
      
      const mcpConfigsData = await mcpConfigsResponse.json();
      const availableServers = mcpConfigsData.data?.mcp_servers || [];
      
      console.log(`[LLM Service] 📋 Available MCP servers:`, availableServers.map(s => s.server_id));
      
      // Filter to only enabled servers for this agent
      const enabledServers = availableServers.filter(server => 
        agent.enabledMcpServers.includes(server.server_id) && server.is_enabled
      );
      
      console.log(`[LLM Service] ✅ Enabled servers for agent ${agent.name}:`, enabledServers.map(s => s.server_name));
      
      if (enabledServers.length === 0) {
        console.warn(`[LLM Service] ⚠️ No enabled MCP servers found for agent ${agent.name}`);
        return [];
      }
      
      // For now, use the backend's tools endpoint which aggregates all enabled servers
      // This handles the server routing internally
      const toolsResponse = await fetch('/api/v1/mcp/tools');
      if (!toolsResponse.ok) {
        throw new Error(`Failed to fetch tools from backend: ${toolsResponse.status}`);
      }
      
      const toolsData = await toolsResponse.json();
      const tools = toolsData.tools || [];
      
      // Filter tools to only those from enabled servers
      const filteredTools = tools.filter(tool => {
        // If tool has serverId, check if it's enabled
        if (tool.serverId) {
          return enabledServers.some(server => server.server_id === tool.serverId);
        }
        // If no serverId specified, allow all tools (for backward compatibility)
        return true;
      });
      
      console.log(`[LLM Service] 🛠️ Filtered to ${filteredTools.length} tools from ${enabledServers.length} enabled servers`);
      
      // Convert MCP tools to LLM function format
      const llmFunctions = this.convertMcpToolsToLLMFunctions(filteredTools);

      console.log(`[LLM Service] ✅ Available MCP functions for agent ${agent.name}:`, llmFunctions.length);
      
      return llmFunctions;
      
    } catch (error) {
      console.error(`[LLM Service] 🚨 Error fetching MCP tools for agent ${agent.name}:`, error);
      return [];
    }
  }

  /**
   * Filter tools based on agent's enabled MCP servers and convert to LLM functions
   */
  private filterAndConvertTools(tools: any[], agent: AIAgent): any[] {
    // If agent has no enabled MCP servers, return empty array
    if (!agent.enabledMcpServers || agent.enabledMcpServers.length === 0) {
      console.log(`[LLM Service] Agent ${agent.name} has no enabled MCP servers`);
      return [];
    }
    
    // For fallback mode, return all tools (agent-server filtering will be handled by backend)
    return this.convertMcpToolsToLLMFunctions(tools);
  }

  /**
   * Convert MCP tools from multiple servers to LLM function format with deduplication
   */
  private convertMcpToolsToLLMFunctions(tools: any[]): any[] {
    const functionMap = new Map();
    
    tools.forEach((tool: any) => {
      const functionName = tool.name;
      const serverId = tool.serverId || 'unknown';
      
      // Create unique key for deduplication (prefer tools from specific servers)
      const key = functionName;
      
      if (!functionMap.has(key) || serverId !== 'unknown') {
        functionMap.set(key, {
          name: functionName,
          description: tool.description || `${functionName} tool from ${serverId}`,
          parameters: tool.inputSchema || {
            type: 'object',
            properties: {},
            required: []
          },
          serverId: serverId // Include server ID for routing
        });
      }
    });
    
    return Array.from(functionMap.values());
  }

  /**
   * Generate a fallback response when the LLM doesn't provide sufficient final response
   */
  private generateFallbackResponse(toolsUsed: string[], toolResults: any[], userMessage: string): string {
    let response = "I've analyzed your request using the following tools and gathered this information:\n\n";
    
    toolsUsed.forEach((toolName, index) => {
      const result = toolResults[index];
      response += `## ${toolName}\n`;
      
      if (result?.success && result?.result) {
        if (toolName === 'search_archer_records') {
          // Special handling for search_archer_records
          const content = result.result?.content?.[0]?.text;
          if (content) {
            const lines = content.split('\n');
            const recordCount = lines.find(line => line.includes('Total Records:'))?.replace(/[^0-9]/g, '') || 'Unknown';
            const appName = lines.find(line => line.includes('Records from'))?.match(/"([^"]+)"/) || ['', 'Unknown'];
            
            response += `Found ${recordCount} records from ${appName[1]} application.\n`;
            
            // Include first few record examples
            const recordLines = lines.filter(line => line.match(/^\d+\. Record:/));
            if (recordLines.length > 0) {
              response += `\n**Sample Records:**\n`;
              recordLines.slice(0, 3).forEach(recordLine => {
                response += `- ${recordLine}\n`;
              });
            }
          }
        } else if (toolName.includes('security_events')) {
          response += `Security events analysis completed successfully.\n`;
        } else {
          response += `Tool executed successfully and returned data.\n`;
        }
      } else {
        response += `Tool execution ${result?.success ? 'completed' : 'failed'}.\n`;
      }
      
      response += '\n';
    });
    
    response += "This analysis used the available data from your Archer GRC platform. Please let me know if you need more specific information or additional analysis.";
    
    return response;
  }

  /**
   * Use the agent's system prompt directly - now contains all specialization and workflow guidance
   */
  private generateSystemPrompt(agent: AIAgent, agentConfig: AgentConfig, tenantId?: string): string {
    // Use the comprehensive system prompt from agent configuration
    let systemPrompt = agent.systemPrompt;

    // Add multi-step orchestration guidance (common to all agents)
    const orchestrationGuidance = `

# MULTI-STEP ANALYSIS FRAMEWORK

You can perform complex, multi-step analysis workflows by calling multiple tools in sequence. For comprehensive requests:

1. **Data Gathering Phase**: Use tools like get_archer_applications, search_archer_records, get_security_events
2. **Analysis Phase**: Process the retrieved data to identify patterns, trends, and insights  
3. **Reporting Phase**: Use tools like generate_security_events_report for detailed summaries
4. **Follow-up**: Ask clarifying questions or suggest additional analysis if needed

## Common Multi-Step Workflows:
- "Security analysis": get_security_events → analyze patterns → generate_security_events_report
- "Application audit": get_archer_applications → search_archer_records → get_archer_stats
- "Compliance review": Multiple data gathering calls → cross-reference analysis → summary report

## Response Guidelines:
1. Always stay in character as ${agent.name}
2. **Announce your multi-step approach**: "I'll analyze this in several steps..."
3. **Explain each tool call**: State what you're doing and why before each tool call
4. **Provide methodology**: Explain your analysis approach and data sources
5. **CRITICAL: Always provide a comprehensive final response** that synthesizes all tool results into a clear, actionable summary
6. **Present data clearly**: Use tables, bullet points, and structured formatting to make complex data readable
7. **Include specific details**: Always include record counts, field values, and specific findings from tool results
8. Be professional but approachable in your communication
9. If you cannot help with a request, explain why and suggest alternatives

## Tool Usage Best Practices:
- **Think multi-step**: Complex requests often require multiple tool calls in sequence
- **Validate data**: Always check data quality before making recommendations  
- **Cross-reference**: Use multiple data sources when possible for comprehensive analysis
- **Provide record counts**: Always mention how many records were processed
- **Security events**: For date ranges like "last 30 days", use the timeRange parameter (e.g., "30d")
- **Error handling**: If a tool fails, try alternative approaches or explain limitations

## Search Results Handling:
- **Always summarize search_archer_records results**: Include record count, key fields, and representative examples
- **Format tabular data**: Present record data in clear tables or structured lists
- **Highlight important findings**: Call out significant patterns, anomalies, or key insights
- **Provide context**: Explain what the records represent and their business relevance
- **Never say "no results"**: If tools return data, always summarize and present the findings

## Privacy and Security:
- Never expose sensitive personal information
- Redact PII in responses  
- Focus on business insights rather than personal details
- Follow data governance principles
- Report any security concerns found in the data`;

    systemPrompt += orchestrationGuidance;

    // Add agent-specific prompt extensions if configured
    if (agentConfig.promptTemplate) {
      systemPrompt += `\n\nSpecial Instructions:\n${agentConfig.promptTemplate}`;
    }

    // Note: Tenant context is handled securely by the backend from authenticated session
    // Never expose tenant IDs in LLM prompts for security reasons

    return systemPrompt;
  }

  /**
   * Process a user message with the agent's LLM using multi-step orchestration
   * Now uses session-based authentication instead of credentials
   * Supports optional progress streaming for real-time tool execution updates
   */
  async processMessage(
    agent: AIAgent,
    llmConfig: LLMConfig,
    userMessage: string,
    conversationHistory: LLMMessage[] = [],
    archerSessionId?: string, // Secure session ID for backend lookup
    tenantId?: string,
    onProgress?: (update: {
      step?: number;
      totalSteps?: number;
      message: string;
      toolName?: string;
      toolProgress?: number;
      toolStatus?: string;
    }) => void
  ): Promise<LLMResponse> {
    console.log(`[LLM Service] 🚀 STARTING processMessage for agent: ${agent.name} (${agent.id})`);
    console.log(`[LLM Service] User message: "${userMessage}"`);
    console.log(`[LLM Service] LLM Config:`, {
      provider: llmConfig.provider,
      model: llmConfig.model,
      endpoint: llmConfig.endpoint,
      hasApiKey: !!llmConfig.apiKey,
      temperature: llmConfig.temperature,
      maxTokens: llmConfig.maxTokens
    });
    console.log(`[LLM Service] Archer session ID:`, archerSessionId || 'None');
    console.log(`[LLM Service] Conversation history length: ${conversationHistory.length}`);
    
    const startTime = Date.now();
    let mcpToolsUsed: string[] = [];
    let mcpResults: any[] = [];
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    // Get available MCP functions
    const agentConfig: AgentConfig = {
      promptTemplate: agent.systemPrompt
    };

    try {
      console.log(`[LLM Service] 🛠️  Getting MCP tools for agent...`);
      const availableFunctions = await this.getMCPToolsAsLLMFunctions(agent);
      console.log(`[LLM Service] ✅ Agent ${agent.name} has ${availableFunctions.length} MCP functions available:`, availableFunctions.map(f => f.name));

      // Build conversation messages with system prompt
      console.log(`[LLM Service] 📝 Generating system prompt...`);
      const systemPrompt = this.generateSystemPrompt(agent, agentConfig, tenantId);
      console.log(`[LLM Service] System prompt length: ${systemPrompt.length} characters`);
      
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        {
          role: 'user', 
          content: userMessage
        }
      ];
      console.log(`[LLM Service] 💬 Total conversation messages: ${messages.length}`);

      // **NEW: Multi-step orchestration loop**
      const maxSteps = 8; // Prevent infinite loops
      let currentMessages = [...messages];
      let finalResponse: FunctionCallResponse | null = null;
      console.log(`[LLM Service] 🔄 Starting multi-step orchestration (max ${maxSteps} steps)`);

      // Report initial progress
      onProgress?.({
        step: 0,
        totalSteps: maxSteps,
        message: `Starting AI analysis with ${agent.name}...`
      });

      for (let step = 1; step <= maxSteps; step++) {
        console.log(`[LLM Service] 🔄 Multi-step orchestration - Step ${step}/${maxSteps}`);
        console.log(`[LLM Service] Current conversation has ${currentMessages.length} messages`);

        // Report step progress
        onProgress?.({
          step,
          totalSteps: maxSteps,
          message: `Step ${step}: Analyzing and planning...`
        });

        // Call Azure OpenAI with current conversation state
        console.log(`[LLM Service] 🤖 Calling real LLM API...`);
        const response = await this.callRealLLM(currentMessages, availableFunctions, llmConfig);
        
        console.log(`[LLM Service] ✅ Step ${step} LLM Response received:`, {
          hasContent: !!response.content,
          contentPreview: response.content ? response.content.substring(0, 100) + '...' : 'No content',
          hasFunctionCalls: !!(response.functionCalls && response.functionCalls.length > 0),
          functionCallCount: response.functionCalls?.length || 0,
          functionNames: response.functionCalls?.map(fc => fc.name) || []
        });

        // Add assistant message to conversation
        const assistantMessage: LLMMessage = {
          role: 'assistant',
          content: response.content || (response.functionCalls && response.functionCalls.length > 0 ? '' : 'I\'ll help you with that.'),
          tool_calls: response.functionCalls?.map(call => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments)
            }
          }))
        };
        currentMessages.push(assistantMessage);

        // If no tool calls, we're done with orchestration
        if (!response.functionCalls || response.functionCalls.length === 0) {
          console.log(`[LLM Service] ✅ No more tool calls - orchestration complete at step ${step}`);
          finalResponse = response;
          break;
        }

        // Process function calls sequentially (as specified in the document)
        console.log(`[LLM Service] 🛠️  Processing ${response.functionCalls.length} function calls in step ${step}`);
        
        if (response.functionCalls.length > 0) {
          onProgress?.({
            step,
            totalSteps: maxSteps,
            message: `Step ${step}: Executing ${response.functionCalls.length} tool${response.functionCalls.length > 1 ? 's' : ''}...`
          });
        }

        for (const functionCall of response.functionCalls) {
          let mcpResult: any;
          try {
            console.log(`[LLM Service] 🔧 Step ${step}: Executing MCP tool: ${functionCall.name}`);
            console.log(`[LLM Service] Tool arguments:`, functionCall.arguments);
            
            // Report tool start
            onProgress?.({
              step,
              totalSteps: maxSteps,
              message: `Step ${step}: Executing ${functionCall.name}...`,
              toolName: functionCall.name,
              toolStatus: 'starting'
            });
            
            // Call MCP tool directly via SSE (hybrid architecture)
            console.log(`[LLM Service] 📡 Calling MCP tool directly via SSE: ${functionCall.name}`);
            mcpResult = await this.callDirectMCPTool(
              functionCall.name, 
              functionCall.arguments, 
              archerSessionId,
              agent,
              onProgress ? (toolProgress) => {
                onProgress({
                  step,
                  totalSteps: maxSteps,
                  message: `Step ${step}: ${toolProgress.status}`,
                  toolName: toolProgress.tool,
                  toolProgress: toolProgress.progress,
                  toolStatus: toolProgress.status
                });
              } : undefined
            );
            
            console.log(`[LLM Service] ✅ MCP tool ${functionCall.name} executed successfully:`, {
              success: mcpResult.success,
              hasResult: !!mcpResult.result,
              serverId: mcpResult.serverId
            });
            
            // Enhanced progress message with record count information
            const recordCount = this.extractRecordCount(mcpResult);
            const completionMessage = recordCount > 0 
              ? `Step ${step}: Retrieved ${recordCount.toLocaleString()} records from ${functionCall.name}`
              : `Step ${step}: ${functionCall.name} completed successfully`;
            
            onProgress?.({
              step,
              totalSteps: maxSteps,
              message: completionMessage,
              toolName: functionCall.name,
              toolStatus: 'completed'
            });
            
            mcpToolsUsed.push(functionCall.name);
            mcpResults.push(mcpResult);

          } catch (error) {
            console.error(`[LLM Service] ❌ Step ${step}: Error executing function ${functionCall.name}:`, error);
            mcpResult = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              content: `Failed to execute ${functionCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }

          // 🔒 CRITICAL PRIVACY PROTECTION: Apply masking before sending to LLM
          let protectedResult = mcpResult;
          if (this.privacyService && mcpResult.success && mcpResult.result) {
            console.log(`🔒 Applying privacy protection to ${functionCall.name} before sending to LLM`);
            protectedResult = this.privacyService.protectMCPResult(mcpResult, functionCall.name);
          }

          // Add tool result to conversation (format for better LLM understanding)
          let toolContent: string;
          if (protectedResult.success && protectedResult.result) {
            if (functionCall.name === 'search_archer_records') {
              // Special formatting for search results
              const resultText = protectedResult.result?.content?.[0]?.text || JSON.stringify(protectedResult.result);
              toolContent = `SEARCH_RESULTS_SUCCESS:\n${resultText}`;
            } else {
              toolContent = `TOOL_SUCCESS: ${JSON.stringify(protectedResult.result)}`;
            }
          } else {
            toolContent = `TOOL_ERROR: ${protectedResult.error || 'Unknown error'}`;
          }
          
          const toolMessage: LLMMessage = {
            role: 'tool',
            content: toolContent,
            tool_call_id: functionCall.id,
            name: functionCall.name
          };
          currentMessages.push(toolMessage);
        }

        // Continue to next step - Azure OpenAI will decide what to do next
      }

      // If we hit max steps without completion, use the last response
      if (!finalResponse) {
        console.warn(`[LLM Service] ⚠️  Hit max steps (${maxSteps}) - using last response`);
        finalResponse = {
          content: "I've completed the available analysis steps. Please let me know if you need additional information.",
          finishReason: 'stop'
        };
      }

      // Check if we have large datasets that need batch processing
      if (mcpResults.length > 0 && this.needsBatchProcessing(mcpResults)) {
        console.log(`[LLM Service] 🔍 Large dataset detected, switching to batch processing mode`);
        const batchResponse = await this.processLargeDataset(userMessage, mcpResults, availableFunctions, onProgress);
        finalResponse = batchResponse;
      }
      // Enhance final response if it's insufficient and we have tool results
      else if (mcpResults.length > 0 && (!finalResponse.content || finalResponse.content.length < 100)) {
        console.log(`[LLM Service] 🔧 Enhancing insufficient final response with tool result summary`);
        finalResponse.content = this.generateFallbackResponse(mcpToolsUsed, mcpResults, userMessage);
      }

      // Calculate total processing time and token usage
      const processingTime = Date.now() - startTime;
      
      // Estimate token usage (rough approximation)
      const messageCount = currentMessages.length;
      promptTokens = messageCount * 50; // Rough estimate
      completionTokens = mcpResults.length * 100 + (finalResponse.content?.length || 0) / 4;
      totalTokens = promptTokens + completionTokens;

      console.log(`[LLM Service] ✅ Multi-step orchestration complete:`, {
        totalSteps: currentMessages.filter(m => m.role === 'assistant').length,
        toolsUsed: mcpToolsUsed.length,
        uniqueTools: [...new Set(mcpToolsUsed)],
        processingTime: `${processingTime}ms`,
        totalTokens,
        finalResponseLength: finalResponse.content?.length || 0
      });
      
      console.log(`[LLM Service] 🎯 FINAL RESPONSE:`, {
        content: finalResponse.content?.substring(0, 200) + '...',
        toolsUsed: mcpToolsUsed,
        processingTime: `${processingTime}ms`
      });

      return {
        content: finalResponse.content || "I've completed your request using the available tools.",
        usage: {
          promptTokens,
          completionTokens,
          totalTokens
        },
        model: llmConfig.model,
        finishReason: finalResponse.finishReason || 'stop',
        toolsUsed: mcpToolsUsed,
        toolResults: mcpResults,
        processingTime
      };

    } catch (error) {
      console.error('[LLM Service] ❌ ERROR in multi-step orchestration:', error);
      console.error('[LLM Service] Error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        agent: { id: agent.id, name: agent.name },
        llmConfig: { provider: llmConfig.provider, model: llmConfig.model },
        userMessage,
        processingTime: `${Date.now() - startTime}ms`
      });
      throw new Error(`LLM processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call MCP tool directly via SSE connection (hybrid architecture)
   * Gets server config from backend registry, connects directly to MCP server
   */
  private async callDirectMCPTool(
    toolName: string, 
    toolArgs: any, 
    archerSessionId?: string,
    agent?: AIAgent,
    onProgress?: (progress: any) => void
  ): Promise<any> {
    try {
      console.log(`[LLM Service] 🚀 Calling MCP tool directly via SSE: ${toolName}`);
      console.log(`[LLM Service] Tool: ${toolName}, Agent: ${agent?.name} (${agent?.id})`);
      console.log(`[LLM Service] Session ID: ${archerSessionId}`);
      
      // Prepare arguments for MCP tool call
      const mcpArgs = {
        ...toolArgs,
        tenant_id: this.tenantId
      };

      // If we have archer session info, include it for authenticated calls
      if (archerSessionId) {
        mcpArgs.archer_session_id = archerSessionId;
      }

      // Call tool directly via SSE client (no backend proxy) with retry logic
      const result = await this.retryWithBackoff(async () => {
        return await mcpSSEClient.callTool(toolName, mcpArgs, {
          timeout: 120000, // 120 second timeout for slow Archer API calls
          onProgress,
          streaming: !!onProgress
        });
      }, 2, 2000); // 2 retries, 2 second base delay

      console.log(`[LLM Service] ✅ Direct MCP tool ${toolName} response received`);

      return {
        success: true,
        content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        result: result,
        serverId: 'direct-sse-connection',
        dataSource: 'direct-mcp-sse-server'
      };

    } catch (error) {
      console.error(`[LLM Service] 🚨 Direct MCP tool call failed for ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        content: `Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Real LLM API call supporting multiple providers
   */
  private async callRealLLM(
    messages: LLMMessage[], 
    availableFunctions: any[], 
    config: LLMConfig
  ): Promise<FunctionCallResponse> {
    
    console.log(`[LLM Service] Real LLM call to ${config.provider} with ${messages.length} messages, ${availableFunctions.length} functions`);
    
    try {
      // Normalize provider name to handle both formats
      const normalizedProvider = config.provider.replace('-', '_');
      
      switch (normalizedProvider) {
        case 'azure_openai':
          return await this.callAzureOpenAI(messages, availableFunctions, config);
        case 'openai':
          return await this.callOpenAI(messages, availableFunctions, config);
        case 'anthropic':
          return await this.callAnthropic(messages, availableFunctions, config);
        default:
          throw new Error(`Unsupported LLM provider: ${config.provider} (normalized: ${normalizedProvider})`);
      }
    } catch (error) {
      console.error(`[LLM Service] Real LLM call failed:`, error);
      throw error;
    }
  }

  /**
   * Retry utility with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on non-retriable errors
        if (error instanceof Error && error.message.includes('404')) {
          throw error;
        }
        
        // Check if it's a 429 (rate limit) or 5xx error
        const is429 = error instanceof Error && error.message.includes('429');
        const is5xx = error instanceof Error && /5\d\d/.test(error.message);
        
        if (!is429 && !is5xx) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          console.warn(`[LLM Service] Max retries (${maxRetries}) exceeded`);
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`[LLM Service] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Check if MCP tool result contains large dataset that needs batch processing
   */
  private needsBatchProcessing(toolResults: any[]): boolean {
    for (const result of toolResults) {
      if (result?.content) {
        try {
          const parsed = JSON.parse(result.content);
          
          // Check for large arrays in common MCP response patterns
          if (parsed?.records && Array.isArray(parsed.records) && parsed.records.length > 100) {
            console.log(`[LLM Service] Large dataset detected: ${parsed.records.length} records`);
            return true;
          }
          
          if (parsed?.data && Array.isArray(parsed.data) && parsed.data.length > 100) {
            console.log(`[LLM Service] Large dataset detected: ${parsed.data.length} data items`);
            return true;
          }

          // Check for Archer-specific large datasets
          if (parsed?.results && Array.isArray(parsed.results) && parsed.results.length > 100) {
            console.log(`[LLM Service] Large dataset detected: ${parsed.results.length} results`);
            return true;
          }
        } catch (e) {
          // If not JSON, check content length as fallback
          if (result.content.length > 50000) {
            console.log(`[LLM Service] Large content detected: ${result.content.length} characters`);
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Process large datasets with intelligent chunking and analysis
   */
  private async processLargeDataset(
    originalMessage: string,
    toolResults: any[],
    availableFunctions: any[],
    onProgress?: (update: {
      step?: number;
      totalSteps?: number;
      message: string;
      toolName?: string;
      toolProgress?: number;
      toolStatus?: string;
    }) => void
  ): Promise<LLMResponse> {
    console.log(`[LLM Service] 🔄 Processing large dataset with batch analysis`);
    
    // Extract the dataset from tool results
    let dataset: any[] = [];
    let datasetContext = '';
    
    for (const result of toolResults) {
      if (result?.content) {
        try {
          const parsed = JSON.parse(result.content);
          if (parsed?.records && Array.isArray(parsed.records)) {
            dataset = parsed.records;
            datasetContext = `Retrieved ${dataset.length} records from ${parsed.metadata?.applicationName || 'Archer'}`;
            break;
          }
          if (parsed?.data && Array.isArray(parsed.data)) {
            dataset = parsed.data;
            datasetContext = `Retrieved ${dataset.length} data items`;
            break;
          }
          if (parsed?.results && Array.isArray(parsed.results)) {
            dataset = parsed.results;
            datasetContext = `Retrieved ${dataset.length} results`;
            break;
          }
        } catch (e) {
          console.warn(`[LLM Service] Could not parse tool result as JSON`);
        }
      }
    }
    
    if (dataset.length === 0) {
      console.warn(`[LLM Service] No dataset found in tool results, falling back to normal processing`);
      // Simple fallback for when we can't extract a dataset
      const fallbackContent = toolResults.map(r => r.content).join('\n\n');
      const response = await this.callRealLLM(
        [{ role: 'user', content: `${originalMessage}\n\nTool Results:\n${fallbackContent}` }], 
        availableFunctions, 
        this.config
      );
      return response;
    }
    
    console.log(`[LLM Service] 📊 Processing ${dataset.length} items with intelligent analysis`);
    
    // Report large dataset processing start
    onProgress?.({
      message: `Analyzing ${dataset.length.toLocaleString()} records...`,
      toolStatus: 'running'
    });
    
    // Simple batch processing without complex strategy analysis to avoid additional API calls
    const batchSize = Math.min(20, Math.max(5, Math.floor(dataset.length / 50))); // Dynamic batch size
    
    console.log(`[LLM Service] 🎯 Using batch size: ${batchSize}`);
    
    // Process dataset in batches
    const results = await this.processBatch(
      dataset,
      async (item: any, index: number, total: number) => {
        const batchPrompt = `Analyze this item (${index + 1}/${total}) in context of: "${originalMessage}"

Item: ${JSON.stringify(item, null, 2)}

Provide focused analysis relevant to the user's request.`;

        try {
          const response = await this.callRealLLM(
            [{ role: 'user', content: batchPrompt }], 
            [], 
            this.config
          );
          return {
            index: index + 1,
            item_id: item.id || item.Id || `item_${index}`,
            analysis: response.content
          };
        } catch (error) {
          console.error(`[LLM Service] Error analyzing item ${index}:`, error);
          return {
            index: index + 1,
            item_id: item.id || item.Id || `item_${index}`,
            analysis: `Error: ${error.message}`
          };
        }
      },
      {
        batchSize: batchSize,
        concurrency: 1,
        onProgress: (completed, total, current) => {
          console.log(`[LLM Service] Progress: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
          const percentage = Math.round(completed/total*100);
          onProgress?.({
            message: `Analyzing ${completed.toLocaleString()}/${total.toLocaleString()} records (${percentage}%)...`,
            toolStatus: 'running',
            toolProgress: percentage
          });
        }
      }
    );
    
    // Report analysis completion
    onProgress?.({
      message: `Completed analysis of ${dataset.length.toLocaleString()} records. Generating summary...`,
      toolStatus: 'completed',
      toolProgress: 100
    });
    
    // Synthesize final response
    const summaryPrompt = `Based on analysis of ${dataset.length} items, provide a comprehensive response to: "${originalMessage}"

Analysis Results: ${JSON.stringify(results, null, 2)}

Provide a comprehensive summary that directly answers the user's question with all important findings and details.`;
    
    const finalResponse = await this.callRealLLM(
      [{ role: 'user', content: summaryPrompt }], 
      [], 
      this.config
    );
    
    return {
      content: finalResponse.content,
      toolCalls: [],
      usage: finalResponse.usage
    };
  }

  /**
   * Rate limiting queue for API calls
   */
  private rateLimitQueue: Array<() => void> = [];
  private isProcessingQueue = false;
  private requestCount = 0;
  private windowStart = Date.now();

  /**
   * Rate limiter: Uses configured rate limit from LLM configuration
   */
  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const windowDuration = 60 * 1000; // 1 minute
    
    // Use configured rate limit - if not configured, no rate limiting
    const limit = this.config?.rateLimit;
    
    if (!limit) {
      // No rate limit configured - skip throttling
      return;
    }
    
    // Reset counter if window has passed
    if (now - this.windowStart > windowDuration) {
      this.requestCount = 0;
      this.windowStart = now;
    }
    
    // If we're at the limit, wait
    if (this.requestCount >= limit) {
      const waitTime = windowDuration - (now - this.windowStart) + 1000;
      const configSource = this.config?.rateLimit ? 'configured' : 'default';
      console.log(`[LLM Service] Rate limit reached (${limit}/min ${configSource}), waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }
    
    this.requestCount++;
  }

  /**
   * Extract record count from MCP tool result for progress messages
   */
  private extractRecordCount(mcpResult: any): number {
    try {
      if (!mcpResult?.content) return 0;
      
      const content = typeof mcpResult.content === 'string' 
        ? JSON.parse(mcpResult.content) 
        : mcpResult.content;
      
      // Check for various array patterns in MCP responses
      if (content?.records && Array.isArray(content.records)) {
        return content.records.length;
      }
      
      if (content?.data && Array.isArray(content.data)) {
        return content.data.length;
      }
      
      if (content?.results && Array.isArray(content.results)) {
        return content.results.length;
      }
      
      // Check for Archer-specific response patterns
      if (content?.ResponseData && Array.isArray(content.ResponseData)) {
        return content.ResponseData.length;
      }
      
      return 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Batch processing for large datasets with progress callbacks
   */
  public async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number, total: number) => Promise<R>,
    options: {
      batchSize?: number;
      concurrency?: number;
      onProgress?: (completed: number, total: number, currentItem?: T) => void;
      onBatchComplete?: (batchResults: R[], batchIndex: number, totalBatches: number) => void;
    } = {}
  ): Promise<R[]> {
    const {
      batchSize = 10,
      concurrency = 1,
      onProgress,
      onBatchComplete
    } = options;
    
    const results: R[] = [];
    const totalBatches = Math.ceil(items.length / batchSize);
    
    console.log(`[LLM Service] Starting batch processing: ${items.length} items in ${totalBatches} batches`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, items.length);
      const batch = items.slice(batchStart, batchEnd);
      
      console.log(`[LLM Service] Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`);
      
      const batchPromises: Promise<R>[] = [];
      
      for (let i = 0; i < batch.length; i += concurrency) {
        const concurrentBatch = batch.slice(i, Math.min(i + concurrency, batch.length));
        
        const concurrentPromises = concurrentBatch.map(async (item, concurrentIndex) => {
          const globalIndex = batchStart + i + concurrentIndex;
          
          // Apply rate limiting
          await this.throttleRequest();
          
          try {
            const result = await processor(item, globalIndex, items.length);
            
            // Report progress
            if (onProgress) {
              onProgress(globalIndex + 1, items.length, item);
            }
            
            return result;
          } catch (error) {
            console.error(`[LLM Service] Error processing item ${globalIndex}:`, error);
            throw error;
          }
        });
        
        const concurrentResults = await Promise.all(concurrentPromises);
        batchPromises.push(...concurrentResults.map(r => Promise.resolve(r)));
      }
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      if (onBatchComplete) {
        onBatchComplete(batchResults, batchIndex, totalBatches);
      }
      
      // Small delay between batches to be extra nice to the API
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`[LLM Service] Batch processing complete: ${results.length} results`);
    return results;
  }

  /**
   * Specialized method for CPS230 breach analysis on large incident datasets
   */
  public async analyzeBulkIncidentsForCPS230(
    incidents: any[],
    onProgress?: (completed: number, total: number, current?: any) => void
  ): Promise<any[]> {
    console.log(`[LLM Service] Starting CPS230 analysis for ${incidents.length} incidents`);
    
    return this.processBatch(
      incidents,
      async (incident, index, total) => {
        const analysisPrompt = `Analyze this incident for potential CPS230 breach indicators:

Incident: ${JSON.stringify(incident, null, 2)}

CPS230 requires financial institutions to report:
1. Material service disruptions (>4 hours for critical services)
2. Cyber security incidents affecting business operations
3. Data breaches involving customer information
4. Third-party service provider failures
5. Incidents affecting business resilience

Provide analysis as JSON:
{
  "isPotentialBreach": boolean,
  "confidence": number (0-1),
  "breachCategories": string[],
  "reasoning": string,
  "reportingRequired": boolean,
  "timelineCompliance": string,
  "recommendedActions": string[]
}`;

        try {
          const response = await this.callRealLLM(
            [{ role: 'user', content: analysisPrompt }], 
            [], 
            this.config
          );
          
          return {
            incidentId: incident.id || `incident_${index}`,
            incident,
            analysis: response.content,
            processedAt: new Date()
          };
        } catch (error) {
          console.error(`[LLM Service] Failed to analyze incident ${incident.id || index}:`, error);
          return {
            incidentId: incident.id || `incident_${index}`,
            incident,
            analysis: { error: error.message },
            processedAt: new Date()
          };
        }
      },
      {
        batchSize: 5, // Small batches for complex analysis
        concurrency: 1, // Sequential processing to avoid rate limits
        onProgress,
        onBatchComplete: (results, batchIndex, totalBatches) => {
          console.log(`[LLM Service] Completed batch ${batchIndex + 1}/${totalBatches}: ${results.length} incidents analyzed`);
        }
      }
    );
  }

  /**
   * Call Azure OpenAI API with function calling and retry logic
   */
  private async callAzureOpenAI(
    messages: LLMMessage[], 
    availableFunctions: any[], 
    config: LLMConfig
  ): Promise<FunctionCallResponse> {
    
    let endpoint = config.endpoint!;
    if (!endpoint.startsWith('https://')) endpoint = 'https://' + endpoint;
    if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
    
    let apiUrl: string;
    
    // Check if endpoint is already a complete Azure OpenAI URL with deployment
    if (endpoint.includes('/openai/deployments/') && endpoint.includes('/chat/completions')) {
      // Use the complete URL as-is (legacy format)
      apiUrl = endpoint.includes('api-version=') ? endpoint : `${endpoint}&api-version=2024-08-01-preview`;
      console.log(`[LLM Service] Using complete Azure OpenAI URL: ${apiUrl}`);
    } else {
      // Construct URL with deployment name (new format)
      const deploymentName = config.model;
      apiUrl = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-08-01-preview`;
      console.log(`[LLM Service] Constructed Azure OpenAI URL: ${apiUrl}`);
      console.log(`[LLM Service] Endpoint: ${endpoint}, Deployment: ${deploymentName}`);
    }
    
    const requestBody: any = {
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id })
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens
    };

    // Add function calling if functions are available
    if (availableFunctions.length > 0) {
      requestBody.tools = availableFunctions.map(func => ({
        type: 'function',
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters
        }
      }));
      requestBody.tool_choice = 'auto';
    }

    console.log(`[LLM Service] Azure OpenAI API call to ${apiUrl}`);
    
    // Wrap API call in retry logic
    const data = await this.retryWithBackoff(async () => {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey!
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`[LLM Service] Azure OpenAI API error details:`, {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          errorData
        });
        
        let errorMessage = `Azure OpenAI API error: ${response.status} - ${response.statusText}`;
        if (response.status === 404) {
          errorMessage += `. Check deployment name '${config.model}' and endpoint URL.`;
        }
        
        throw new Error(errorMessage);
      }

      return await response.json();
    }, 5, 2000); // 5 retries, starting with 2 second base delay
    const choice = data.choices[0];
    const message = choice.message;

    // Handle function calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      return {
        functionCalls: message.tool_calls.map((call: any) => ({
          id: call.id,
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments)
        })),
        content: message.content || 'I\'ll help you with that information.',
        finishReason: choice.finish_reason
      };
    }

    return {
      content: message.content,
      finishReason: choice.finish_reason
    };
  }

  /**
   * Call OpenAI API with function calling
   */
  private async callOpenAI(
    messages: LLMMessage[], 
    availableFunctions: any[], 
    config: LLMConfig
  ): Promise<FunctionCallResponse> {
    
    const apiUrl = `${config.endpoint}/v1/chat/completions`;
    
    const requestBody: any = {
      model: config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name })
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens
    };

    // Add function calling if functions are available
    if (availableFunctions.length > 0) {
      requestBody.tools = availableFunctions.map(func => ({
        type: 'function',
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters
        }
      }));
      requestBody.tool_choice = 'auto';
    }

    console.log(`[LLM Service] OpenAI API call to ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey!}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    // Handle function calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      return {
        functionCalls: message.tool_calls.map((call: any) => ({
          id: call.id,
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments)
        })),
        content: message.content || 'I\'ll help you with that information.',
        finishReason: choice.finish_reason
      };
    }

    return {
      content: message.content,
      finishReason: choice.finish_reason
    };
  }

  /**
   * Call Anthropic API with function calling
   */
  private async callAnthropic(
    messages: LLMMessage[], 
    availableFunctions: any[], 
    config: LLMConfig
  ): Promise<FunctionCallResponse> {
    
    const apiUrl = `${config.endpoint}/v1/messages`;
    
    // Convert messages to Anthropic format
    const anthropicMessages = messages.filter(msg => msg.role !== 'system').map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Extract system message
    const systemMessage = messages.find(msg => msg.role === 'system')?.content;

    const requestBody: any = {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: anthropicMessages,
      ...(systemMessage && { system: systemMessage })
    };

    // Add function calling if functions are available
    if (availableFunctions.length > 0) {
      requestBody.tools = availableFunctions.map(func => ({
        name: func.name,
        description: func.description,
        input_schema: func.parameters
      }));
    }

    console.log(`[LLM Service] Anthropic API call to ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey!,
        'anthropic-version': '2024-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    // Handle tool use
    if (data.content && data.content.some((c: any) => c.type === 'tool_use')) {
      const toolUses = data.content.filter((c: any) => c.type === 'tool_use');
      return {
        functionCalls: toolUses.map((use: any) => ({
          id: use.id,
          name: use.name,
          arguments: use.input
        })),
        content: data.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') || 'I\'ll help you with that information.',
        finishReason: data.stop_reason
      };
    }

    return {
      content: data.content?.map((c: any) => c.text).join('') || '',
      finishReason: data.stop_reason
    };
  }
}

/**
 * Create LLM service instance
 */
export const createLLMService = (tenantId: string): LLMService => {
  return new LLMService(tenantId);
};

/**
 * Default LLM configurations for different providers
 */
export const defaultLLMConfigs: Record<string, LLMConfig> = {
  'azure_openai_gpt4o': {
    provider: 'azure_openai',
    model: 'gpt-4o',
    temperature: 0.3,
    maxTokens: 2000,
    responseFormat: 'text'
  },
  'azure_openai_gpt4': {
    provider: 'azure_openai',
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 2000,
    responseFormat: 'text'
  },
  'openai_gpt4': {
    provider: 'openai', 
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 2000,
    responseFormat: 'text'
  },
  'anthropic_claude': {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    temperature: 0.3,
    maxTokens: 2000,
    responseFormat: 'text'
  }
};