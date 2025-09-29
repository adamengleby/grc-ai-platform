/**
 * LLM Configurations API Routes
 * Replaces localStorage LLM config storage with secure, tenant-isolated REST API
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { tenantIsolationMiddleware } from '../middleware/authz';
import LLMConfigService from '../services/llmConfigService';

const router = Router();

// Types for request validation
interface LLMConfigCreateRequest {
  name: string;
  provider: 'azure_openai' | 'openai' | 'anthropic' | 'custom';
  model: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: 'text' | 'json_object';
  api_key?: string; // Will be stored in Key Vault
  endpoint?: string; // Will be stored in Key Vault
  is_default?: boolean;
}

interface LLMConfigUpdateRequest extends Partial<LLMConfigCreateRequest> {
  is_enabled?: boolean;
}

/**
 * GET /api/llm-configs
 * Get all LLM configurations for the authenticated user's tenant
 * Replaces: localStorage.getItem(`user_llm_configs_${tenantId}`)
 */
router.get('/',
  authMiddleware,
  tenantIsolationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      const configs = await LLMConfigService.getTenantLLMConfigs(tenantId);

      res.json({
        success: true,
        data: configs,
        metadata: {
          total_count: configs.length,
          enabled_count: configs.filter(c => c.is_enabled).length,
          default_config_id: configs.find(c => c.is_default)?.config_id || null
        }
      });
    } catch (error) {
      console.error('[LLMConfigsAPI] Error getting configs:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve LLM configurations',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/llm-configs/:configId
 * Get specific LLM configuration by ID
 */
router.get('/:configId',
  authMiddleware,
  tenantIsolationMiddleware,
  param('configId').isUUID().withMessage('Invalid config ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { configId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      const config = await LLMConfigService.getLLMConfigById(tenantId, configId);

      if (!config) {
        return res.status(404).json({
          error: 'LLM configuration not found',
          code: 'CONFIG_NOT_FOUND'
        });
      }

      // Remove sensitive data from response
      const sanitizedConfig = {
        ...config,
        api_key_vault_secret: config.api_key_vault_secret ? '[CONFIGURED]' : undefined,
        endpoint_vault_secret: config.endpoint_vault_secret ? '[CONFIGURED]' : undefined
      };

      res.json({
        success: true,
        data: sanitizedConfig
      });
    } catch (error) {
      console.error('[LLMConfigsAPI] Error getting config:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve LLM configuration',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/llm-configs/default
 * Get default LLM configuration for tenant
 */
router.get('/default',
  authMiddleware,
  tenantIsolationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      const defaultConfig = await LLMConfigService.getDefaultLLMConfig(tenantId);

      if (!defaultConfig) {
        return res.status(404).json({
          error: 'No default LLM configuration found',
          code: 'NO_DEFAULT_CONFIG'
        });
      }

      res.json({
        success: true,
        data: defaultConfig
      });
    } catch (error) {
      console.error('[LLMConfigsAPI] Error getting default config:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve default LLM configuration',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * POST /api/llm-configs
 * Create new LLM configuration
 * Replaces: localStorage.setItem with new config added to array
 */
router.post('/',
  authMiddleware,
  tenantIsolationMiddleware,
  [
    body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Name is required and must be under 255 characters'),
    body('provider').isIn(['azure_openai', 'openai', 'anthropic', 'custom']).withMessage('Invalid provider'),
    body('model').trim().isLength({ min: 1, max: 100 }).withMessage('Model is required and must be under 100 characters'),
    body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
    body('max_tokens').optional().isInt({ min: 1, max: 32000 }).withMessage('Max tokens must be between 1 and 32000'),
    body('response_format').optional().isIn(['text', 'json_object']).withMessage('Invalid response format'),
    body('api_key').optional().isString().withMessage('API key must be a string'),
    body('endpoint').optional().isURL().withMessage('Endpoint must be a valid URL'),
    body('is_default').optional().isBoolean().withMessage('is_default must be boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const configData: LLMConfigCreateRequest = req.body;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // TODO: Store API key and endpoint in Azure Key Vault
      // const apiKeySecret = await KeyVaultService.storeSecret(tenantId, configData.api_key);
      // const endpointSecret = await KeyVaultService.storeSecret(tenantId, configData.endpoint);

      const sanitizedConfigData = {
        ...configData,
        api_key_vault_secret: configData.api_key ? `llm-${configData.name}-api-key` : undefined,
        endpoint_vault_secret: configData.endpoint ? `llm-${configData.name}-endpoint` : undefined
      };

      // Remove raw secrets from the data
      delete (sanitizedConfigData as any).api_key;
      delete (sanitizedConfigData as any).endpoint;

      const newConfig = await LLMConfigService.createLLMConfig(tenantId, userId, sanitizedConfigData);

      // Log audit event
      console.log('[LLMConfigsAPI] Created LLM config:', newConfig.name, 'for tenant:', tenantId);

      res.status(201).json({
        success: true,
        data: newConfig,
        message: 'LLM configuration created successfully'
      });
    } catch (error) {
      console.error('[LLMConfigsAPI] Error creating config:', error);
      res.status(500).json({ 
        error: 'Failed to create LLM configuration',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * PUT /api/llm-configs/:configId
 * Update existing LLM configuration
 * Replaces: localStorage.setItem with updated configs array
 */
router.put('/:configId',
  authMiddleware,
  tenantIsolationMiddleware,
  [
    param('configId').isUUID().withMessage('Invalid config ID'),
    body('name').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Name must be under 255 characters'),
    body('provider').optional().isIn(['azure_openai', 'openai', 'anthropic', 'custom']).withMessage('Invalid provider'),
    body('model').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Model must be under 100 characters'),
    body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
    body('max_tokens').optional().isInt({ min: 1, max: 32000 }).withMessage('Max tokens must be between 1 and 32000'),
    body('response_format').optional().isIn(['text', 'json_object']).withMessage('Invalid response format'),
    body('api_key').optional().isString().withMessage('API key must be a string'),
    body('endpoint').optional().isURL().withMessage('Endpoint must be a valid URL'),
    body('is_enabled').optional().isBoolean().withMessage('is_enabled must be boolean'),
    body('is_default').optional().isBoolean().withMessage('is_default must be boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { configId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const updates: LLMConfigUpdateRequest = req.body;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Handle secret updates if provided
      if (updates.api_key) {
        // TODO: Update Key Vault secret
        delete (updates as any).api_key; // Remove from updates
      }
      if (updates.endpoint) {
        // TODO: Update Key Vault secret
        delete (updates as any).endpoint; // Remove from updates
      }

      const updatedConfig = await LLMConfigService.updateLLMConfig(tenantId, userId, configId, updates);

      res.json({
        success: true,
        data: updatedConfig,
        message: 'LLM configuration updated successfully'
      });
    } catch (error) {
      console.error('[LLMConfigsAPI] Error updating config:', error);
      
      if (error instanceof Error && error.message === 'LLM configuration not found') {
        return res.status(404).json({
          error: error.message,
          code: 'CONFIG_NOT_FOUND'
        });
      }

      res.status(500).json({ 
        error: 'Failed to update LLM configuration',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/llm-configs/:configId
 * Delete LLM configuration (soft delete)
 */
router.delete('/:configId',
  authMiddleware,
  tenantIsolationMiddleware,
  param('configId').isUUID().withMessage('Invalid config ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { configId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const success = await LLMConfigService.deleteLLMConfig(tenantId, userId, configId);

      if (!success) {
        return res.status(404).json({
          error: 'LLM configuration not found',
          code: 'CONFIG_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: 'LLM configuration deleted successfully'
      });
    } catch (error) {
      console.error('[LLMConfigsAPI] Error deleting config:', error);
      
      if (error instanceof Error && (
        error.message === 'LLM configuration not found' ||
        error.message === 'Cannot delete the last LLM configuration'
      )) {
        return res.status(400).json({
          error: error.message,
          code: 'DELETE_NOT_ALLOWED'
        });
      }

      res.status(500).json({ 
        error: 'Failed to delete LLM configuration',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * POST /api/llm-configs/:configId/test
 * Test LLM configuration connectivity
 */
router.post('/:configId/test',
  authMiddleware,
  tenantIsolationMiddleware,
  param('configId').isUUID().withMessage('Invalid config ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { configId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      const testResult = await LLMConfigService.testLLMConfig(tenantId, configId);

      res.json({
        success: testResult.success,
        data: testResult
      });
    } catch (error) {
      console.error('[LLMConfigsAPI] Error testing config:', error);
      res.status(500).json({ 
        error: 'Failed to test LLM configuration',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/llm-configs/usage/stats
 * Get LLM usage statistics for tenant
 */
router.get('/usage/stats',
  authMiddleware,
  tenantIsolationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      const stats = await LLMConfigService.getLLMUsageStats(tenantId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[LLMConfigsAPI] Error getting usage stats:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve usage statistics',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

export default router;