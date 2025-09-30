import express from 'express';
import multer from 'multer';
import { MCPServerManager } from '../../services/enhanced/MCPServerManager.js';
import { LLMOrchestrator } from '../../services/enhanced/LLMOrchestrator.js';
import { MemoryService } from '../../services/enhanced/MemoryService.js';
import { FileService } from '../../services/enhanced/FileService.js';
import { AuthMiddleware, AuthenticatedRequest } from '../../middleware/enhanced/AuthMiddleware.js';

const router = express.Router();

// Initialize enhanced services
const mcpManager = new MCPServerManager();
const llmOrchestrator = new LLMOrchestrator();
const memoryService = new MemoryService();
const fileService = new FileService();
const authMiddleware = new AuthMiddleware();

// Configure multer for file uploads
const upload = multer({
  dest: 'temp/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allow common GRC file types
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
      'application/xml',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed for GRC processing`));
    }
  }
});

// Initialize MCP servers on startup
let mcpInitialized = false;
const initializeMCP = async () => {
  if (!mcpInitialized) {
    try {
      await mcpManager.initializeAllServers();
      mcpInitialized = true;
      console.log('🚀 Enhanced GRC MCP servers initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize MCP servers:', error);
    }
  }
};

// Initialize on first request
router.use(async (req, res, next) => {
  if (!mcpInitialized) {
    await initializeMCP();
  }
  next();
});

/**
 * Enhanced GRC Chat Endpoint
 * Supports multi-LLM orchestration, multi-MCP server integration, file processing, and conversation memory
 */
router.post('/chat',
  authMiddleware.validateToken,
  authMiddleware.logGRCAccess('enhanced_chat'),
  upload.array('attachments'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { message, grcContext } = req.body;
      const files = req.files as Express.Multer.File[] || [];
      const userId = req.user.id;

      console.log(`🤖 Enhanced GRC Chat Request from ${req.user.email}`);
      console.log(`💬 Message: ${message?.substring(0, 100)}...`);
      console.log(`📁 Files: ${files.length}`);
      console.log(`👤 User Roles: ${req.user.roles.join(', ')}`);

      // Validate request
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MESSAGE',
            message: 'Message is required and must be a non-empty string'
          }
        });
        return;
      }

      // Process uploaded files
      const processedFiles = await Promise.all(
        files.map(file => fileService.processFile(file))
      );

      console.log(`📄 Processed ${processedFiles.length} files for GRC analysis`);

      // Get conversation memory
      const conversationHistory = await memoryService.getConversationHistory(userId, 20);

      // Get available tools from all MCP servers
      const availableTools = mcpManager.getAvailableTools();

      // Create enhanced context with GRC-specific information
      const enhancedContext = {
        message,
        files: processedFiles,
        history: conversationHistory,
        userId,
        availableTools,
        userProfile: {
          id: req.user.id,
          tenantId: req.user.tenantId,
          name: req.user.name,
          email: req.user.email,
          roles: req.user.roles,
          grcPermissions: req.user.grcPermissions
        },
        grcContext: {
          tenant: req.user.tenantId,
          role: req.user.roles[0], // Primary role
          frameworks: grcContext?.frameworks || [],
          ...grcContext
        }
      };

      console.log(`🔧 Available tools: ${availableTools.length} across ${mcpManager.getServerStatus().size} servers`);

      // Process through enhanced LLM orchestrator
      const response = await llmOrchestrator.processRequest(enhancedContext, mcpManager);

      // Save interaction to conversation memory
      await memoryService.saveInteraction(userId, {
        input: {
          message,
          files: processedFiles,
          grcContext: enhancedContext.grcContext
        },
        output: response,
        timestamp: new Date(),
        reasoning: response.metadata.reasoning,
        toolsUsed: response.metadata.toolsUsed,
        grcAnalysis: response.metadata.grcAnalysis
      });

      // Return enhanced response
      res.json({
        success: true,
        data: {
          response: response.response,
          metadata: {
            ...response.metadata,
            filesProcessed: processedFiles.length,
            conversationLength: conversationHistory.length,
            serverStatus: Array.from(mcpManager.getServerStatus().entries()).map(([name, server]) => ({
              name,
              status: server.status,
              toolCount: server.tools.length
            })),
            userContext: {
              tenantId: req.user.tenantId,
              roles: req.user.roles,
              permissions: req.user.grcPermissions
            }
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Enhanced chat error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CHAT_PROCESSING_ERROR',
          message: 'Failed to process chat request',
          details: error.message
        }
      });
    }
  }
);

/**
 * Get conversation history with GRC insights
 */
router.get('/conversations/:userId',
  authMiddleware.validateToken,
  authMiddleware.logGRCAccess('get_conversation_history'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      // Check if user can access this conversation
      if (userId !== req.user.id && !req.user.roles.includes('grc_admin')) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Cannot access another user\'s conversation history'
          }
        });
        return;
      }

      const history = await memoryService.getConversationHistory(userId, limit);
      const insights = await memoryService.getGRCInsights(userId);

      res.json({
        success: true,
        data: {
          conversations: history,
          insights,
          summary: {
            totalInteractions: history.length,
            timeRange: {
              first: history[0]?.timestamp,
              last: history[history.length - 1]?.timestamp
            }
          }
        }
      });

    } catch (error) {
      console.error('❌ Conversation history error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'HISTORY_RETRIEVAL_ERROR',
          message: 'Failed to retrieve conversation history'
        }
      });
    }
  }
);

/**
 * Search conversation memory
 */
router.get('/memory/search',
  authMiddleware.validateToken,
  authMiddleware.logGRCAccess('search_memory'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { query, limit } = req.query;
      const userId = req.user.id;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Search query is required'
          }
        });
        return;
      }

      const searchLimit = Math.min(parseInt(limit as string) || 10, 50);
      const results = await memoryService.searchMemory(userId, query, searchLimit);

      res.json({
        success: true,
        data: {
          query,
          results,
          summary: {
            totalResults: results.length,
            searchTerms: query.split(' ').filter(term => term.length > 2)
          }
        }
      });

    } catch (error) {
      console.error('❌ Memory search error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'Failed to search conversation memory'
        }
      });
    }
  }
);

/**
 * Get available MCP tools and servers
 */
router.get('/tools',
  authMiddleware.validateToken,
  authMiddleware.logGRCAccess('get_mcp_tools'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const tools = mcpManager.getAvailableTools();
      const serverStatus = mcpManager.getServerStatus();

      res.json({
        success: true,
        data: {
          tools,
          servers: Array.from(serverStatus.entries()).map(([name, server]) => ({
            id: server.id,
            name: server.name,
            status: server.status,
            toolCount: server.tools.length,
            auth: server.auth,
            url: server.url
          })),
          summary: {
            totalTools: tools.length,
            totalServers: serverStatus.size,
            toolsByServer: Array.from(serverStatus.entries()).reduce((acc, [name, server]) => {
              acc[name] = server.tools.length;
              return acc;
            }, {} as Record<string, number>)
          }
        }
      });

    } catch (error) {
      console.error('❌ Tools retrieval error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TOOLS_RETRIEVAL_ERROR',
          message: 'Failed to retrieve MCP tools'
        }
      });
    }
  }
);

/**
 * Health check for enhanced chat service
 */
router.get('/health', async (req: express.Request, res: express.Response) => {
  try {
    const serverStatus = mcpManager.getServerStatus();
    const activeServers = Array.from(serverStatus.values()).filter(s => s.status === 'active').length;

    res.json({
      success: true,
      data: {
        service: 'Enhanced GRC Chat',
        status: 'healthy',
        mcpServers: {
          total: serverStatus.size,
          active: activeServers,
          inactive: serverStatus.size - activeServers
        },
        capabilities: [
          'Multi-LLM Orchestration (OpenAI + Anthropic)',
          'Multi-MCP Server Integration',
          'Conversation Memory & Search',
          'GRC File Processing',
          'Azure B2C Authentication',
          'Tenant Isolation',
          'GRC-Specific Analysis'
        ],
        version: '2.0.0-enhanced'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Service health check failed'
      }
    });
  }
});

export default router;