/**
 * LLM Service - Handles AI model interactions with Archer MCP integration
 */

import { AIAgent } from '@/types/agent';

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
  capabilities: string[];
  useCase: string;
}

export interface LLMConfig {
  provider: 'azure_openai' | 'openai' | 'anthropic';
  model: string;
  apiKey?: string;
  endpoint?: string;
  temperature: number;
  maxTokens: number;
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

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Get available MCP functions for this agent from ALL enabled MCP servers
   */
  private async getMCPToolsAsLLMFunctions(agent: AIAgent): Promise<any[]> {
    try {
      const backendUrl = import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:3001/api/v1';
      
      console.log(`[LLM Service] Fetching MCP tools for agent ${agent.name} with ${agent.enabledMcpServers.length} enabled servers`);
      
      // Fetch tools from all enabled MCP servers for this agent
      const response = await fetch(`${backendUrl}/mcp/tools/agent/${agent.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': this.tenantId
        }
      });
      
      if (!response.ok) {
        // Fallback to general tools endpoint if agent-specific endpoint not available
        console.warn(`[LLM Service] Agent-specific endpoint failed, falling back to general tools`);
        const fallbackResponse = await fetch(`${backendUrl}/mcp/tools`);
        if (!fallbackResponse.ok) {
          throw new Error(`Failed to fetch MCP tools: ${fallbackResponse.status}`);
        }
        
        const fallbackData = await fallbackResponse.json();
        return this.filterAndConvertTools(fallbackData.tools || [], agent);
      }
      
      const data = await response.json();
      const tools = data.tools || [];
      
      // Convert MCP tools from multiple servers to LLM function format
      const llmFunctions = this.convertMcpToolsToLLMFunctions(tools);

      console.log(`[LLM Service] Available MCP functions for agent ${agent.name}:`, llmFunctions.length);
      console.log(`[LLM Service] Functions from servers:`, tools.map((t: any) => t.serverId || 'unknown').filter((id: string, index: number, arr: string[]) => arr.indexOf(id) === index));
      
      return llmFunctions;
      
    } catch (error) {
      console.error(`[LLM Service] Error fetching MCP tools for agent ${agent.name}:`, error);
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
   * Generate comprehensive system prompt for agent with multi-step orchestration guidance
   */
  private generateSystemPrompt(agent: AIAgent, agentConfig: AgentConfig): string {
    const basePrompt = `You are ${agent.name}, an AI assistant specialized in ${agent.useCase}.

Agent Configuration:
- Name: ${agent.name}
- Use Case: ${agent.useCase}
- Description: ${agent.description}

Core Capabilities:
${agent.capabilities.map(cap => `- ${cap}`).join('\n')}

Multi-Step Analysis Framework:
You can perform complex, multi-step analysis workflows by calling multiple tools in sequence. For comprehensive requests:

1. **Data Gathering Phase**: Use tools like get_archer_applications, search_archer_records, get_security_events
2. **Analysis Phase**: Process the retrieved data to identify patterns, trends, and insights  
3. **Reporting Phase**: Use tools like generate_security_events_report for detailed summaries
4. **Follow-up**: Ask clarifying questions or suggest additional analysis if needed

Common Multi-Step Workflows:
- "Security analysis": get_security_events → analyze patterns → generate_security_events_report
- "Application audit": get_archer_applications → search_archer_records → get_archer_stats
- "Compliance review": Multiple data gathering calls → cross-reference analysis → summary report

Response Guidelines:
1. Always stay in character as ${agent.name}
2. Focus on ${agent.useCase} related tasks
3. Use your GRC expertise to provide accurate, actionable insights
4. **Announce your multi-step approach**: "I'll analyze this in several steps..."
5. **Explain each tool call**: State what you're doing and why before each tool call
6. **Provide methodology**: Explain your analysis approach and data sources
7. Be professional but approachable in your communication
8. If you cannot help with a request, explain why and suggest alternatives

Tool Usage Best Practices:
- **Think multi-step**: Complex requests often require multiple tool calls in sequence
- **Validate data**: Always check data quality before making recommendations  
- **Cross-reference**: Use multiple data sources when possible for comprehensive analysis
- **Provide record counts**: Always mention how many records were processed
- **Security events**: For date ranges like "last 30 days", use the timeRange parameter (e.g., "30d")
- **Error handling**: If a tool fails, try alternative approaches or explain limitations

Privacy and Security:
- Never expose sensitive personal information
- Redact PII in responses  
- Focus on business insights rather than personal details
- Follow data governance principles
- Report any security concerns found in the data`;

    // Add agent-specific prompt extensions if configured
    if (agentConfig.promptTemplate) {
      return `${basePrompt}\n\nSpecial Instructions:\n${agentConfig.promptTemplate}`;
    }

    return basePrompt;
  }

  /**
   * Process a user message with the agent's LLM using multi-step orchestration
   */
  async processMessage(
    agent: AIAgent,
    llmConfig: LLMConfig,
    userMessage: string,
    conversationHistory: LLMMessage[] = [],
    archerConnection?: any
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    let mcpToolsUsed: string[] = [];
    let mcpResults: any[] = [];
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    // Get available MCP functions
    const agentConfig: AgentConfig = {
      capabilities: agent.capabilities,
      useCase: agent.useCase,
      promptTemplate: agent.systemPrompt
    };

    try {
      const availableFunctions = await this.getMCPToolsAsLLMFunctions(agent);
      console.log(`[LLM Service] Agent ${agent.name} has ${availableFunctions.length} MCP functions available`);

      // Build conversation messages with system prompt
      const systemPrompt = this.generateSystemPrompt(agent, agentConfig);
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        {
          role: 'user', 
          content: userMessage
        }
      ];

      // **NEW: Multi-step orchestration loop**
      const maxSteps = 8; // Prevent infinite loops
      let currentMessages = [...messages];
      let finalResponse: FunctionCallResponse | null = null;

      for (let step = 1; step <= maxSteps; step++) {
        console.log(`[LLM Service] Multi-step orchestration - Step ${step}/${maxSteps}`);
        console.log(`[LLM Service] Current conversation has ${currentMessages.length} messages`);

        // Call Azure OpenAI with current conversation state
        const response = await this.callRealLLM(currentMessages, availableFunctions, llmConfig);
        
        console.log(`[LLM Service] Step ${step} LLM Response:`, {
          hasContent: !!response.content,
          hasFunctionCalls: !!(response.functionCalls && response.functionCalls.length > 0),
          functionCallCount: response.functionCalls?.length || 0
        });

        // Add assistant message to conversation
        const assistantMessage: LLMMessage = {
          role: 'assistant',
          content: response.content || null,
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
          console.log(`[LLM Service] No more tool calls - orchestration complete at step ${step}`);
          finalResponse = response;
          break;
        }

        // Process function calls sequentially (as specified in the document)
        console.log(`[LLM Service] Processing ${response.functionCalls.length} function calls in step ${step}`);
        
        for (const functionCall of response.functionCalls) {
          let mcpResult: any;
          try {
            console.log(`[LLM Service] Step ${step}: Executing MCP tool: ${functionCall.name}`, functionCall.arguments);
            
            // Call backend MCP API
            mcpResult = await this.callBackendMCPTool(
              functionCall.name, 
              functionCall.arguments, 
              archerConnection,
              agent
            );
            
            mcpToolsUsed.push(functionCall.name);
            mcpResults.push(mcpResult);

          } catch (error) {
            console.error(`[LLM Service] Step ${step}: Error executing function ${functionCall.name}:`, error);
            mcpResult = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              content: `Failed to execute ${functionCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }

          // Add tool result to conversation
          const toolMessage: LLMMessage = {
            role: 'tool',
            content: JSON.stringify({
              success: mcpResult.success,
              result: mcpResult.result,
              error: mcpResult.error
            }),
            tool_call_id: functionCall.id,
            name: functionCall.name
          };
          currentMessages.push(toolMessage);
        }

        // Continue to next step - Azure OpenAI will decide what to do next
      }

      // If we hit max steps without completion, use the last response
      if (!finalResponse) {
        console.warn(`[LLM Service] Hit max steps (${maxSteps}) - using last response`);
        finalResponse = {
          content: "I've completed the available analysis steps. Please let me know if you need additional information.",
          finishReason: 'stop'
        };
      }

      // Calculate total processing time and token usage
      const processingTime = Date.now() - startTime;
      
      // Estimate token usage (rough approximation)
      const messageCount = currentMessages.length;
      promptTokens = messageCount * 50; // Rough estimate
      completionTokens = mcpResults.length * 100 + (finalResponse.content?.length || 0) / 4;
      totalTokens = promptTokens + completionTokens;

      console.log(`[LLM Service] Multi-step orchestration complete:`, {
        totalSteps: currentMessages.filter(m => m.role === 'assistant').length,
        toolsUsed: mcpToolsUsed.length,
        uniqueTools: [...new Set(mcpToolsUsed)],
        processingTime,
        totalTokens
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
      console.error('[LLM Service] Error in multi-step orchestration:', error);
      throw new Error(`LLM processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call backend MCP API to execute tools with multi-server support
   */
  private async callBackendMCPTool(
    toolName: string, 
    toolArgs: any, 
    archerConnection?: any,
    agent?: AIAgent
  ): Promise<any> {
    try {
      const backendUrl = import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:3001/api/v1';
      
      // Use tenant ID from constructor
      const tenantId = this.tenantId;
      
      // Get connection info
      if (!archerConnection) {
        throw new Error('Archer connection is required for MCP tool calls');
      }

      const payload = {
        toolName,
        arguments: toolArgs,
        connectionId: archerConnection.id,
        tenantId: tenantId,
        agentId: agent?.id, // Pass agent ID for server routing
        enabledMcpServers: agent?.enabledMcpServers || [], // Pass enabled servers
        credentials: archerConnection // Pass credentials to backend
      };

      console.log(`[LLM Service] Calling backend MCP API: ${backendUrl}/mcp/call`);
      console.log(`[LLM Service] Tool: ${toolName}, Agent: ${agent?.name}, Enabled Servers: ${agent?.enabledMcpServers?.length || 0}`);

      const response = await fetch(`${backendUrl}/mcp/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[LLM Service] MCP tool ${toolName} response from server ${result.serverId || 'unknown'}:`, result.success);

      if (!result.success) {
        throw new Error(result.error || 'MCP tool call failed');
      }

      return {
        success: true,
        content: typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2),
        result: result.result,
        serverId: result.serverId // Track which server handled the request
      };

    } catch (error) {
      console.error(`[LLM Service] Backend MCP tool call failed for ${toolName}:`, error);
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
   * Call Azure OpenAI API with function calling
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

    console.log(`[LLM Service] Azure OpenAI API call to ${apiUrl}`);
    
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