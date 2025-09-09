/**
 * AI Agents API Routes
 * Replaces localStorage agent storage with secure, tenant-isolated REST API
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AgentService } from '../services/agentService';

const router = Router();

// Create service instance
const agentService = new AgentService();

// Simple mock auth middleware for development
const mockAuth = (req: Request, res: Response, next: any) => {
  req.user = {
    userId: 'U1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6',
    tenantId: 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6',
    email: 'demo@example.com',
    roles: ['TenantOwner']
  };
  next();
};

// Types for request/response
interface AgentCreateRequest {
  name: string;
  description?: string;
  persona?: string;
  system_prompt?: string;
  llm_config_id?: string;
  enabled_mcp_servers?: string[];
  avatar?: string;
  color?: string;
}

interface AgentUpdateRequest extends Partial<AgentCreateRequest> {
  is_enabled?: boolean;
}

/**
 * GET /api/agents
 * Get all agents for the authenticated user's tenant
 * Replaces: localStorage.getItem(`ai_agents_${tenantId}`)
 */
router.get('/',
  mockAuth,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      // Get query parameters
      const enabled = req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const sort = req.query.sort as 'name' | 'created_at' | 'usage_count' || 'created_at';
      const order = req.query.order as 'asc' | 'desc' || 'desc';

      const result = await agentService.getAgents(tenantId, {
        enabled,
        limit,
        offset,
        sort,
        order
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting agents:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'AGENTS_FETCH_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/agents/:agentId
 * Get specific agent by ID
 */
router.get('/:agentId',
  mockAuth,
  param('agentId').isUUID().withMessage('Invalid agent ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const tenantId = req.user?.tenantId!;
      const agentId = req.params.agentId;

      const agent = await agentService.getAgent(tenantId, agentId);
      
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: agent,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting agent:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'AGENT_FETCH_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/agents
 * Create new agent
 */
router.post('/',
  mockAuth,
  [
    body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Name is required and must be 1-255 characters'),
    body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('persona').optional().isString().isLength({ max: 500 }).withMessage('Persona must be less than 500 characters'),
    body('system_prompt').optional().isString().isLength({ max: 10000 }).withMessage('System prompt must be less than 10000 characters'),
    body('llm_config_id').optional().isUUID().withMessage('Invalid LLM config ID'),
    body('enabled_mcp_servers').optional().isArray().withMessage('MCP servers must be an array'),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const tenantId = req.user?.tenantId!;
      const userId = req.user?.userId!;
      
      const agent = await agentService.createAgent(tenantId, userId, req.body);

      res.status(201).json({
        success: true,
        data: agent,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating agent:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'AGENT_CREATE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * PUT /api/agents/:agentId  
 * Update existing agent
 */
router.put('/:agentId',
  mockAuth,
  [
    param('agentId').isUUID().withMessage('Invalid agent ID'),
    body('name').optional().isString().isLength({ min: 1, max: 255 }).withMessage('Name must be 1-255 characters'),
    body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('persona').optional().isString().isLength({ max: 500 }).withMessage('Persona must be less than 500 characters'),
    body('system_prompt').optional().isString().isLength({ max: 10000 }).withMessage('System prompt must be less than 10000 characters'),
    body('llm_config_id').optional().isUUID().withMessage('Invalid LLM config ID'),
    body('enabled_mcp_servers').optional().isArray().withMessage('MCP servers must be an array'),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color'),
    body('is_enabled').optional().isBoolean().withMessage('is_enabled must be a boolean')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const tenantId = req.user?.tenantId!;
      const userId = req.user?.userId!;
      const agentId = req.params.agentId;
      
      const agent = await agentService.updateAgent(tenantId, userId, agentId, req.body);
      
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: agent,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating agent:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'AGENT_UPDATE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * DELETE /api/agents/:agentId
 * Delete agent (soft delete)
 */
router.delete('/:agentId',
  mockAuth,
  param('agentId').isUUID().withMessage('Invalid agent ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const tenantId = req.user?.tenantId!;
      const userId = req.user?.userId!;
      const agentId = req.params.agentId;
      
      const deleted = await agentService.deleteAgent(tenantId, userId, agentId);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
          code: 'AGENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Agent deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting agent:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'AGENT_DELETE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;