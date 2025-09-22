/**
 * Chat Sessions API Routes
 * Replaces localStorage chat history with persistent, tenant-isolated database storage
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { tenantIsolationMiddleware } from '../middleware/authz';
import ChatSessionService from '../services/chatSessionService';

const router = Router();

// Types for request validation
interface ChatSessionCreateRequest {
  agent_id: string;
  session_name?: string;
  context?: Record<string, any>;
}

interface ChatMessageCreateRequest {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  content_type?: 'text' | 'json' | 'markdown';
  tool_calls?: Record<string, any>[];
  tool_call_id?: string;
  tokens_used?: number;
  processing_time_ms?: number;
}

/**
 * GET /api/chat/sessions
 * Get all chat sessions for the authenticated user
 * Replaces: localStorage session management
 */
router.get('/sessions',
  authMiddleware,
  tenantIsolationMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('agent_id').optional().isUUID().withMessage('Invalid agent ID'),
    query('active_only').optional().isBoolean().withMessage('active_only must be boolean')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const agentId = req.query.agent_id as string;
      const activeOnly = req.query.active_only === 'true';

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      let sessions = await ChatSessionService.getUserChatSessions(tenantId, userId);

      // Apply filters
      if (agentId) {
        sessions = sessions.filter(s => s.agent_id === agentId);
      }
      if (activeOnly) {
        sessions = sessions.filter(s => s.is_active);
      }

      // Apply pagination
      const totalCount = sessions.length;
      const paginatedSessions = sessions.slice(offset, offset + limit);

      res.json({
        success: true,
        data: paginatedSessions,
        metadata: {
          total_count: totalCount,
          returned_count: paginatedSessions.length,
          offset: offset,
          limit: limit
        }
      });
    } catch (error) {
      console.error('[ChatAPI] Error getting sessions:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve chat sessions',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/chat/sessions/:sessionId
 * Get specific chat session by ID
 */
router.get('/sessions/:sessionId',
  authMiddleware,
  tenantIsolationMiddleware,
  param('sessionId').isUUID().withMessage('Invalid session ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const session = await ChatSessionService.getChatSessionById(tenantId, userId, sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'Chat session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('[ChatAPI] Error getting session:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve chat session',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * POST /api/chat/sessions
 * Create new chat session
 * Replaces: localStorage.setItem for new chat session
 */
router.post('/sessions',
  authMiddleware,
  tenantIsolationMiddleware,
  [
    body('agent_id').isUUID().withMessage('Valid agent ID is required'),
    body('session_name').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Session name must be under 255 characters'),
    body('context').optional().isObject().withMessage('Context must be an object')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const { agent_id, session_name, context }: ChatSessionCreateRequest = req.body;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const newSession = await ChatSessionService.createChatSession(
        tenantId, 
        userId, 
        agent_id, 
        session_name, 
        context
      );

      console.log('[ChatAPI] Created chat session:', newSession.session_id, 'for agent:', agent_id);

      res.status(201).json({
        success: true,
        data: newSession,
        message: 'Chat session created successfully'
      });
    } catch (error) {
      console.error('[ChatAPI] Error creating session:', error);
      res.status(500).json({ 
        error: 'Failed to create chat session',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * PUT /api/chat/sessions/:sessionId
 * Update chat session (e.g., rename, update context)
 */
router.put('/sessions/:sessionId',
  authMiddleware,
  tenantIsolationMiddleware,
  [
    param('sessionId').isUUID().withMessage('Invalid session ID'),
    body('session_name').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Session name must be under 255 characters'),
    body('context').optional().isObject().withMessage('Context must be an object'),
    body('is_active').optional().isBoolean().withMessage('is_active must be boolean')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const updates = req.body;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const updatedSession = await ChatSessionService.updateChatSession(tenantId, userId, sessionId, updates);

      res.json({
        success: true,
        data: updatedSession,
        message: 'Chat session updated successfully'
      });
    } catch (error) {
      console.error('[ChatAPI] Error updating session:', error);
      
      if (error instanceof Error && error.message === 'Chat session not found') {
        return res.status(404).json({
          error: error.message,
          code: 'SESSION_NOT_FOUND'
        });
      }

      res.status(500).json({ 
        error: 'Failed to update chat session',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/chat/sessions/:sessionId
 * Delete chat session and all its messages
 */
router.delete('/sessions/:sessionId',
  authMiddleware,
  tenantIsolationMiddleware,
  param('sessionId').isUUID().withMessage('Invalid session ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const success = await ChatSessionService.deleteChatSession(tenantId, userId, sessionId);

      if (!success) {
        return res.status(404).json({
          error: 'Chat session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: 'Chat session deleted successfully'
      });
    } catch (error) {
      console.error('[ChatAPI] Error deleting session:', error);
      res.status(500).json({ 
        error: 'Failed to delete chat session',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/chat/sessions/:sessionId/messages
 * Get messages for a chat session
 * Replaces: localStorage.getItem(`chat_session_${sessionId}`)
 */
router.get('/sessions/:sessionId/messages',
  authMiddleware,
  tenantIsolationMiddleware,
  [
    param('sessionId').isUUID().withMessage('Invalid session ID'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const messages = await ChatSessionService.getSessionMessages(tenantId, userId, sessionId, limit, offset);

      res.json({
        success: true,
        data: messages,
        metadata: {
          session_id: sessionId,
          returned_count: messages.length,
          offset: offset,
          limit: limit
        }
      });
    } catch (error) {
      console.error('[ChatAPI] Error getting messages:', error);
      
      if (error instanceof Error && error.message === 'Chat session not found or access denied') {
        return res.status(404).json({
          error: 'Chat session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      res.status(500).json({ 
        error: 'Failed to retrieve messages',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * POST /api/chat/sessions/:sessionId/messages
 * Add message to chat session
 * Replaces: localStorage.setItem with updated messages array
 */
router.post('/sessions/:sessionId/messages',
  authMiddleware,
  tenantIsolationMiddleware,
  [
    param('sessionId').isUUID().withMessage('Invalid session ID'),
    body('role').isIn(['user', 'assistant', 'system', 'tool']).withMessage('Invalid role'),
    body('content').isString().isLength({ min: 1, max: 50000 }).withMessage('Content is required and must be under 50,000 characters'),
    body('content_type').optional().isIn(['text', 'json', 'markdown']).withMessage('Invalid content type'),
    body('tool_calls').optional().isArray().withMessage('Tool calls must be an array'),
    body('tool_call_id').optional().isString().withMessage('Tool call ID must be a string'),
    body('tokens_used').optional().isInt({ min: 0 }).withMessage('Tokens used must be non-negative'),
    body('processing_time_ms').optional().isInt({ min: 0 }).withMessage('Processing time must be non-negative')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const messageRequest: ChatMessageCreateRequest = req.body;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const newMessage = await ChatSessionService.addMessageToSession(
        tenantId, 
        userId, 
        sessionId, 
        messageRequest
      );

      res.status(201).json({
        success: true,
        data: newMessage,
        message: 'Message added successfully'
      });
    } catch (error) {
      console.error('[ChatAPI] Error adding message:', error);
      
      if (error instanceof Error && error.message === 'Chat session not found or access denied') {
        return res.status(404).json({
          error: 'Chat session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      res.status(500).json({ 
        error: 'Failed to add message',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/chat/sessions/:sessionId/messages
 * Clear all messages in a session
 * Replaces: localStorage.removeItem for chat session
 */
router.delete('/sessions/:sessionId/messages',
  authMiddleware,
  tenantIsolationMiddleware,
  param('sessionId').isUUID().withMessage('Invalid session ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const success = await ChatSessionService.clearSessionMessages(tenantId, userId, sessionId);

      if (!success) {
        return res.status(404).json({
          error: 'Chat session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: 'Session messages cleared successfully'
      });
    } catch (error) {
      console.error('[ChatAPI] Error clearing messages:', error);
      res.status(500).json({ 
        error: 'Failed to clear messages',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/chat/stats
 * Get chat statistics for the authenticated user
 */
router.get('/stats',
  authMiddleware,
  tenantIsolationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const stats = await ChatSessionService.getUserChatStats(tenantId, userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[ChatAPI] Error getting chat stats:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve chat statistics',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

export default router;