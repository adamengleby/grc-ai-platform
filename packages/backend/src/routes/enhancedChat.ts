import { Router, Request, Response } from 'express';
import { LLMOrchestrator } from '../services/enhanced/LLMOrchestrator.js';
import { MCPServerManager } from '../services/enhanced/MCPServerManager.js';

const router = Router();

/**
 * Enhanced Chat API endpoint
 * Provides AI-powered GRC chat with database-configured LLMs and MCP tools
 */

interface EnhancedChatRequest {
  message: string;
  files?: any[];
  history?: any[];
  tenantId?: string;
  userId: string;
}

/**
 * POST /api/v1/enhanced-chat/process
 * Process a chat message with enhanced GRC capabilities
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { message, files, history, tenantId, userId }: EnhancedChatRequest = req.body;

    // Validate required fields
    if (!message || !userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Message and userId are required'
        }
      });
    }

    console.log(`🚀 Enhanced Chat Request from user ${userId}:`, {
      messageLength: message.length,
      hasFiles: !!files && files.length > 0,
      hasHistory: !!history && history.length > 0,
      tenantId
    });

    // Initialize MCP Server Manager
    const mcpManager = new MCPServerManager();
    await mcpManager.initialize();

    // Get available tools for this tenant/user
    const availableTools = await mcpManager.getAvailableTools();

    // Initialize LLM Orchestrator with tenant context
    const llmOrchestrator = new LLMOrchestrator(tenantId);

    // Process the chat message
    const result = await llmOrchestrator.processRequest({
      message,
      files: files || [],
      history: history || [],
      userId,
      availableTools,
      grcContext: {
        tenant: tenantId,
        role: 'user', // Could be extracted from user context
        frameworks: [] // Could be configured per tenant
      }
    }, mcpManager);

    // Clean up MCP Manager
    await mcpManager.cleanup();

    console.log(`✅ Enhanced Chat Response:`, {
      responseLength: result.response.length,
      toolsUsed: result.metadata.toolsUsed.length,
      llmProvider: result.metadata.llmProvider,
      confidence: result.metadata.confidence
    });

    return res.json({
      success: true,
      data: {
        response: result.response,
        metadata: {
          ...result.metadata,
          processingTime: new Date().toISOString(),
          availableTools: availableTools.length
        }
      }
    });

  } catch (error: any) {
    console.error('Enhanced Chat error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'ENHANCED_CHAT_ERROR',
        message: 'Failed to process enhanced chat request',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/v1/enhanced-chat/health
 * Health check for enhanced chat service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Initialize components to check health
    const mcpManager = new MCPServerManager();
    await mcpManager.initialize();

    const availableTools = await mcpManager.getAvailableTools();

    // Test LLM Orchestrator
    const llmOrchestrator = new LLMOrchestrator();
    const availableConfigs = llmOrchestrator.getAvailableLLMConfigs();
    const activeLLMProviders = llmOrchestrator.getActiveLLMProviders();

    await mcpManager.cleanup();

    return res.json({
      success: true,
      status: 'healthy',
      components: {
        mcpTools: {
          available: availableTools.length,
          status: availableTools.length > 0 ? 'operational' : 'limited'
        },
        llmConfigs: {
          available: availableConfigs.length,
          activeLLMProviders,
          status: activeLLMProviders.length > 0 ? 'operational' : 'fallback'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Enhanced Chat health check failed:', error);

    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/enhanced-chat/capabilities
 * Get current enhanced chat capabilities
 */
router.get('/capabilities', async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;

    // Initialize components
    const mcpManager = new MCPServerManager();
    await mcpManager.initialize();

    const availableTools = await mcpManager.getAvailableTools();

    const llmOrchestrator = new LLMOrchestrator(tenantId);
    await llmOrchestrator.loadLLMConfigurations();

    const availableConfigs = llmOrchestrator.getAvailableLLMConfigs();
    const activeLLMProviders = llmOrchestrator.getActiveLLMProviders();

    await mcpManager.cleanup();

    return res.json({
      success: true,
      data: {
        mcpTools: availableTools.map(tool => ({
          name: tool.name,
          server: tool.server,
          description: tool.description || 'No description available'
        })),
        llmProviders: activeLLMProviders,
        llmConfigurations: availableConfigs.filter(config => config.isEnabled).map(config => ({
          id: config.id,
          name: config.name,
          provider: config.provider,
          model: config.model
        })),
        features: [
          'Multi-LLM orchestration (OpenAI + Anthropic)',
          'Real-time MCP tool execution',
          'GRC-specific analysis and recommendations',
          'Confidence scoring and human review workflows',
          'File upload and document processing',
          'Conversation history and context memory',
          'Tenant-isolated configuration management'
        ]
      }
    });

  } catch (error: any) {
    console.error('Enhanced Chat capabilities error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'CAPABILITIES_ERROR',
        message: 'Failed to get enhanced chat capabilities',
        details: error.message
      }
    });
  }
});

export default router;