import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { MCPServerManager, MCPTool } from './MCPServerManager.js';
import { LLMConfigService, LLMConfiguration } from '../llmConfigService.js';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'azure' | 'local';
  endpoint?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey?: string;
  configId?: string;
  name?: string;
}

export interface ProcessingContext {
  message: string;
  files?: any[];
  history?: any[];
  userId: string;
  availableTools: MCPTool[];
  userProfile?: any;
  grcContext?: {
    tenant?: string;
    role?: string;
    frameworks?: string[];
  };
}

export interface ProcessingResult {
  response: string;
  metadata: {
    toolsUsed: string[];
    reasoning: string;
    confidence: number;
    llmProvider: string;
    grcAnalysis?: {
      category?: string;
      riskLevel?: string;
      complianceFrameworks?: string[];
      recommendations?: string[];
    };
  };
}

export class LLMOrchestrator {
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;
  private llmConfigService: LLMConfigService;
  private availableConfigs: LLMConfiguration[] = [];
  private tenantId?: string;

  constructor(tenantId?: string) {
    this.tenantId = tenantId;
    this.llmConfigService = new LLMConfigService();
  }

  async loadLLMConfigurations(): Promise<void> {
    try {
      if (this.tenantId) {
        this.availableConfigs = await this.llmConfigService.getLLMConfigsByTenant(this.tenantId);
        console.log(`📋 Loaded ${this.availableConfigs.length} LLM configurations for tenant ${this.tenantId}`);
      } else {
        this.availableConfigs = await this.llmConfigService.getAllLLMConfigs();
        console.log(`📋 Loaded ${this.availableConfigs.length} LLM configurations`);
      }
    } catch (error) {
      console.error('Failed to load LLM configurations:', error);
      this.availableConfigs = [];
    }
  }

  private async initializeLLMClients(): Promise<void> {
    try {
      // Load configurations from database
      await this.loadLLMConfigurations();

      // Initialize OpenAI clients from configurations
      for (const config of this.availableConfigs) {
        if (config.provider === 'openai' && config.apiKey && config.isEnabled) {
          this.openaiClient = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.endpoint || undefined
          });
          console.log(`🤖 Initialized OpenAI client: ${config.name}`);
          break; // Use first available OpenAI config
        }
      }

      // Initialize Anthropic clients from configurations
      for (const config of this.availableConfigs) {
        if (config.provider === 'anthropic' && config.apiKey && config.isEnabled) {
          this.anthropicClient = new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.endpoint || undefined
          });
          console.log(`🤖 Initialized Anthropic client: ${config.name}`);
          break; // Use first available Anthropic config
        }
      }

      if (!this.openaiClient && !this.anthropicClient) {
        console.warn('⚠️ No LLM clients available, using rule-based fallback');
      }
    } catch (error) {
      console.warn('⚠️ LLM client initialization failed, using rule-based fallback:', error);
    }
  }

  async processRequest(context: ProcessingContext, mcpManager: MCPServerManager): Promise<ProcessingResult> {
    console.log(`🤖 Enhanced GRC LLM Processing for user ${context.userId}`);
    console.log(`📊 Available tools: ${context.availableTools.length}`);
    console.log(`💬 Message: ${context.message.substring(0, 100)}...`);

    // Initialize LLM clients with database configurations
    await this.initializeLLMClients();

    try {
      // Analyze the request for GRC context
      const grcAnalysis = this.analyzeGRCContext(context.message);

      // Determine if we need to use tools
      const toolsNeeded = this.identifyRequiredTools(context.message, context.availableTools);

      // Execute tools if needed
      const toolResults: any[] = [];
      for (const tool of toolsNeeded) {
        try {
          const result = await mcpManager.callTool(tool.server, tool.name, tool.arguments);
          toolResults.push({
            tool: tool.name,
            server: tool.server,
            result
          });
        } catch (error) {
          console.error(`Tool execution failed: ${tool.name}`, error);
        }
      }

      // Use LLM for sophisticated analysis
      let response: string;
      let llmProvider: string;

      if (this.openaiClient) {
        const result = await this.processWithOpenAI(context, grcAnalysis, toolResults);
        response = result.response;
        llmProvider = result.provider;
      } else if (this.anthropicClient) {
        const result = await this.processWithAnthropic(context, grcAnalysis, toolResults);
        response = result.response;
        llmProvider = result.provider;
      } else {
        // Fallback to rule-based GRC processing
        const result = this.processWithRules(context, grcAnalysis, toolResults);
        response = result.response;
        llmProvider = result.provider;
      }

      return {
        response,
        metadata: {
          toolsUsed: toolResults.map(t => `${t.server}:${t.tool}`),
          reasoning: `GRC analysis with ${toolResults.length} tools and ${llmProvider} LLM`,
          confidence: this.calculateConfidence(toolResults, grcAnalysis),
          llmProvider,
          grcAnalysis
        }
      };

    } catch (error) {
      console.error('LLM Orchestration error:', error);
      return this.generateErrorResponse(context, error);
    }
  }

  private analyzeGRCContext(message: string): any {
    const grcKeywords = {
      compliance: ['compliance', 'regulation', 'audit', 'iso', 'gdpr', 'sox', 'hipaa', 'framework'],
      risk: ['risk', 'threat', 'vulnerability', 'likelihood', 'impact', 'mitigation'],
      governance: ['policy', 'procedure', 'control', 'oversight', 'governance'],
      incident: ['incident', 'breach', 'security', 'violation', 'failure']
    };

    const analysis = {
      category: 'general',
      riskLevel: 'low',
      complianceFrameworks: [] as string[],
      recommendations: [] as string[]
    };

    const lowerMessage = message.toLowerCase();

    // Determine primary category
    let maxMatches = 0;
    for (const [category, keywords] of Object.entries(grcKeywords)) {
      const matches = keywords.filter(keyword => lowerMessage.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        analysis.category = category;
      }
    }

    // Identify compliance frameworks
    if (lowerMessage.includes('iso') || lowerMessage.includes('27001')) {
      analysis.complianceFrameworks.push('ISO 27001');
    }
    if (lowerMessage.includes('gdpr')) {
      analysis.complianceFrameworks.push('GDPR');
    }
    if (lowerMessage.includes('sox')) {
      analysis.complianceFrameworks.push('SOX');
    }

    // Assess risk level based on keywords
    const highRiskKeywords = ['critical', 'severe', 'major', 'high', 'breach', 'failure'];
    const mediumRiskKeywords = ['moderate', 'medium', 'concern', 'issue'];

    if (highRiskKeywords.some(keyword => lowerMessage.includes(keyword))) {
      analysis.riskLevel = 'high';
    } else if (mediumRiskKeywords.some(keyword => lowerMessage.includes(keyword))) {
      analysis.riskLevel = 'medium';
    }

    return analysis;
  }

  private identifyRequiredTools(message: string, availableTools: MCPTool[]): any[] {
    const tools: any[] = [];
    const lowerMessage = message.toLowerCase();

    // Check if user is asking for risk calculation
    if (lowerMessage.includes('risk') && (lowerMessage.includes('calculate') || lowerMessage.includes('score'))) {
      const riskTool = availableTools.find(t => t.name === 'risk_calculator');
      if (riskTool) {
        tools.push({
          server: riskTool.server,
          name: riskTool.name,
          arguments: {
            likelihood: 3,
            impact: 3,
            category: 'General'
          }
        });
      }
    }

    // Check if user is asking for compliance check
    if (lowerMessage.includes('compliance') || lowerMessage.includes('iso') || lowerMessage.includes('gdpr')) {
      const complianceTool = availableTools.find(t => t.name === 'iso27001_checker');
      if (complianceTool) {
        tools.push({
          server: complianceTool.server,
          name: complianceTool.name,
          arguments: {
            control: 'General inquiry',
            evidence: message
          }
        });
      }
    }

    // Check if user is asking about Archer data
    if (lowerMessage.includes('archer') || lowerMessage.includes('incident') || lowerMessage.includes('application')) {
      const archerTool = availableTools.find(t => t.name === 'get_applications');
      if (archerTool) {
        tools.push({
          server: archerTool.server,
          name: archerTool.name,
          arguments: {}
        });
      }
    }

    return tools;
  }

  private async processWithOpenAI(context: ProcessingContext, grcAnalysis: any, toolResults: any[]): Promise<{response: string, provider: string}> {
    if (!this.openaiClient) throw new Error('OpenAI client not initialized');

    // Find the OpenAI configuration being used
    const openaiConfig = this.availableConfigs.find(config =>
      config.provider === 'openai' && config.isEnabled
    );

    if (!openaiConfig) {
      throw new Error('No OpenAI configuration found');
    }

    const systemPrompt = `You are a GRC (Governance, Risk, and Compliance) expert AI assistant. You help with:

- Risk assessments and calculations
- Compliance framework analysis (ISO 27001, GDPR, SOX, etc.)
- Security incident analysis and classification
- Control effectiveness evaluation
- Policy and procedure review

Context: ${JSON.stringify(grcAnalysis)}
Tool Results: ${JSON.stringify(toolResults)}

Provide clear, actionable GRC guidance. Include specific recommendations and next steps.`;

    const completion = await this.openaiClient.chat.completions.create({
      model: openaiConfig.model || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context.message }
      ],
      temperature: openaiConfig.temperature || 0.7,
      max_tokens: openaiConfig.maxTokens || 2000
    });

    return {
      response: completion.choices[0]?.message?.content || 'No response generated',
      provider: `OpenAI ${openaiConfig.model} (${openaiConfig.name})`
    };
  }

  private async processWithAnthropic(context: ProcessingContext, grcAnalysis: any, toolResults: any[]): Promise<{response: string, provider: string}> {
    if (!this.anthropicClient) throw new Error('Anthropic client not initialized');

    // Find the Anthropic configuration being used
    const anthropicConfig = this.availableConfigs.find(config =>
      config.provider === 'anthropic' && config.isEnabled
    );

    if (!anthropicConfig) {
      throw new Error('No Anthropic configuration found');
    }

    const systemPrompt = `You are a GRC (Governance, Risk, and Compliance) expert AI assistant specializing in enterprise risk management and regulatory compliance.

Analysis Context: ${JSON.stringify(grcAnalysis)}
Tool Results: ${JSON.stringify(toolResults)}

Provide expert GRC guidance with specific, actionable recommendations.`;

    const completion = await this.anthropicClient.messages.create({
      model: anthropicConfig.model || 'claude-3-sonnet-20240229',
      max_tokens: anthropicConfig.maxTokens || 2000,
      temperature: anthropicConfig.temperature || 0.7,
      system: systemPrompt,
      messages: [
        { role: 'user', content: context.message }
      ]
    });

    const responseText = completion.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('\n');

    return {
      response: responseText || 'No response generated',
      provider: `Anthropic ${anthropicConfig.model} (${anthropicConfig.name})`
    };
  }

  private processWithRules(context: ProcessingContext, grcAnalysis: any, toolResults: any[]): {response: string, provider: string} {
    let response = `🏢 **Enhanced GRC Analysis** (Rule-based processing)\n\n`;

    response += `**Analysis Summary:**\n`;
    response += `- Category: ${grcAnalysis.category}\n`;
    response += `- Risk Level: ${grcAnalysis.riskLevel}\n`;
    response += `- Frameworks: ${grcAnalysis.complianceFrameworks.join(', ') || 'General'}\n\n`;

    if (toolResults.length > 0) {
      response += `**Tool Results:**\n`;
      for (const result of toolResults) {
        response += `\n🔧 **${result.tool}** (${result.server}):\n`;
        if (result.result.success) {
          response += `✅ Success: ${JSON.stringify(result.result, null, 2)}\n`;
        } else {
          response += `❌ Error: ${result.result.error}\n`;
        }
      }
    }

    response += `\n**Available Enhanced Capabilities:**\n`;
    response += `- 🏢 Archer GRC Integration (25+ production tools)\n`;
    response += `- 📋 Compliance Framework Analysis (ISO 27001, GDPR, SOX)\n`;
    response += `- ⚠️ Risk Assessment Tools (scoring, threats, controls)\n`;
    response += `- 📄 Document Processing (policies, incidents)\n`;
    response += `- 💾 Persistent conversation memory\n`;
    response += `- 🔄 Multi-LLM orchestration (OpenAI + Anthropic)\n\n`;

    response += `**Next Steps:**\n`;
    if (grcAnalysis.category === 'risk') {
      response += `- Use risk calculator for quantitative analysis\n`;
      response += `- Review threat landscape and mitigation controls\n`;
    } else if (grcAnalysis.category === 'compliance') {
      response += `- Run compliance framework checks\n`;
      response += `- Review control implementations\n`;
    } else if (grcAnalysis.category === 'incident') {
      response += `- Classify incident using automated tools\n`;
      response += `- Create incident record in Archer\n`;
    }

    response += `\n*Enhanced GRC Platform with ${context.availableTools.length} total tools across multiple domains.*`;

    return {
      response,
      provider: 'Enhanced GRC Rules Engine'
    };
  }

  private calculateConfidence(toolResults: any[], grcAnalysis: any): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence based on tool results
    if (toolResults.length > 0) {
      const successfulTools = toolResults.filter(r => r.result.success).length;
      confidence += (successfulTools / toolResults.length) * 0.2;
    }

    // Increase confidence for specific GRC categories
    if (grcAnalysis.category !== 'general') {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private generateErrorResponse(context: ProcessingContext, error: any): ProcessingResult {
    return {
      response: `I encountered an issue processing your GRC request. However, I have access to ${context.availableTools.length} enhanced tools including Archer GRC integration, compliance frameworks, and risk assessment capabilities. Please try rephrasing your question or contact support.`,
      metadata: {
        toolsUsed: [],
        reasoning: `Error in LLM processing: ${error.message}`,
        confidence: 0.3,
        llmProvider: 'Error Handler',
        grcAnalysis: {
          category: 'error',
          riskLevel: 'unknown'
        }
      }
    };
  }

  async updateLLMConfig(config: Partial<LLMConfig>): Promise<void> {
    // Reload configurations from database
    await this.loadLLMConfigurations();
    // Reinitialize clients with new configurations
    await this.initializeLLMClients();
  }

  getAvailableLLMConfigs(): LLMConfiguration[] {
    return this.availableConfigs;
  }

  getActiveLLMProviders(): string[] {
    const providers: string[] = [];
    if (this.openaiClient) {
      const config = this.availableConfigs.find(c => c.provider === 'openai' && c.isEnabled);
      providers.push(`OpenAI (${config?.name || 'Unknown'})`);
    }
    if (this.anthropicClient) {
      const config = this.availableConfigs.find(c => c.provider === 'anthropic' && c.isEnabled);
      providers.push(`Anthropic (${config?.name || 'Unknown'})`);
    }
    return providers;
  }
}