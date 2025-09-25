/**
 * Privacy Settings API Routes
 * Manages LLM data protection and masking settings
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, enforceTenantIsolation } from '../middleware/auth';
import { PrivacySettingsService } from '../services/privacySettingsService';
import { getSQLiteDatabase } from '../config/sqliteDatabase';

const router = Router();
const db = getSQLiteDatabase();
const logger = console; // Use console for logging for now
const privacyService = new PrivacySettingsService(db, logger);

/**
 * GET /api/v1/privacy/settings
 * Get privacy settings for current user or tenant
 */
router.get('/settings',
  authenticateToken,
  enforceTenantIsolation,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const scope = req.query.scope as 'user' | 'tenant' || 'user';

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      let settings;
      if (scope === 'tenant') {
        // Get tenant-wide settings (only for tenant owners)
        if (!req.user?.roles?.includes('TenantOwner')) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions for tenant-wide settings',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
        settings = await privacyService.getPrivacySettings(tenantId);
      } else {
        // Get user-specific settings
        settings = await privacyService.getPrivacySettings(tenantId, userId);
      }

      if (!settings) {
        // Return default settings if none exist
        settings = privacyService.getDefaultPrivacySettings(tenantId, scope === 'user' ? userId : undefined);
      }

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('[PrivacyAPI] Error getting privacy settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve privacy settings',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * PUT /api/v1/privacy/settings
 * Update privacy settings for current user or tenant
 */
router.put('/settings',
  authenticateToken,
  enforceTenantIsolation,
  [
    body('enable_privacy_masking').isBoolean().withMessage('Privacy masking must be boolean'),
    body('masking_level').isIn(['light', 'moderate', 'strict']).withMessage('Invalid masking level'),
    body('enable_tokenization').optional().isBoolean().withMessage('Tokenization must be boolean'),
    body('custom_sensitive_fields').optional().isArray().withMessage('Custom fields must be array'),
    body('privacy_key').optional().isString().withMessage('Privacy key must be string'),
    body('scope').optional().isIn(['user', 'tenant']).withMessage('Invalid scope')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const {
        enable_privacy_masking,
        masking_level,
        enable_tokenization = false,
        custom_sensitive_fields = [],
        privacy_key,
        scope = 'user'
      } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      // Check permissions for tenant-wide settings
      if (scope === 'tenant' && !req.user?.roles?.includes('TenantOwner')) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions for tenant-wide settings',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const settingsData = {
        tenant_id: tenantId,
        user_id: scope === 'user' ? userId : undefined,
        enable_privacy_masking,
        masking_level,
        enable_tokenization,
        custom_sensitive_fields,
        privacy_key,
        scope
      };

      const updatedSettings = await privacyService.upsertPrivacySettings(settingsData);

      // Log privacy setting changes for audit
      logger.info(`[PrivacyAPI] Privacy settings updated`, {
        tenantId,
        userId: scope === 'user' ? userId : 'tenant-wide',
        masking_enabled: enable_privacy_masking,
        masking_level,
        scope
      });

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Privacy settings updated successfully'
      });
    } catch (error) {
      logger.error('[PrivacyAPI] Error updating privacy settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update privacy settings',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/v1/privacy/settings
 * Reset privacy settings to defaults
 */
router.delete('/settings',
  authenticateToken,
  enforceTenantIsolation,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const scope = req.query.scope as 'user' | 'tenant' || 'user';

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      // Check permissions for tenant-wide settings
      if (scope === 'tenant' && !req.user?.roles?.includes('TenantOwner')) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions for tenant-wide settings',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const deleted = await privacyService.deletePrivacySettings(
        tenantId,
        scope === 'user' ? userId : undefined
      );

      if (deleted) {
        const defaultSettings = privacyService.getDefaultPrivacySettings(
          tenantId,
          scope === 'user' ? userId : undefined
        );

        logger.info(`[PrivacyAPI] Privacy settings reset to defaults`, {
          tenantId,
          userId: scope === 'user' ? userId : 'tenant-wide',
          scope
        });

        res.json({
          success: true,
          data: defaultSettings,
          message: 'Privacy settings reset to defaults'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to reset privacy settings',
          code: 'RESET_FAILED'
        });
      }
    } catch (error) {
      logger.error('[PrivacyAPI] Error resetting privacy settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset privacy settings',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/v1/privacy/tenant/settings
 * Get all privacy settings for tenant (admin only)
 */
router.get('/tenant/settings',
  authenticateToken,
  enforceTenantIsolation,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      // Only tenant owners can view all settings
      if (!req.user?.roles?.includes('TenantOwner')) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const allSettings = await privacyService.getTenantPrivacySettings(tenantId);

      res.json({
        success: true,
        data: allSettings
      });
    } catch (error) {
      logger.error('[PrivacyAPI] Error getting tenant privacy settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve tenant privacy settings',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/v1/privacy/test
 * Test privacy masking with sample data
 */
router.post('/test',
  authenticateToken,
  enforceTenantIsolation,
  [
    body('test_data').isString().withMessage('Test data must be string'),
    body('masking_level').optional().isIn(['light', 'moderate', 'strict']).withMessage('Invalid masking level')
  ],
  async (req: Request, res: Response) => {
    try {
      const { test_data, masking_level = 'moderate' } = req.body;
      
      // Simple masking for testing
      let maskedData = test_data;
      
      // Email masking
      maskedData = maskedData.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[MASKED_EMAIL]');
      
      // Phone masking
      maskedData = maskedData.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[MASKED_PHONE]');
      
      // Name masking (basic)
      if (masking_level === 'strict') {
        maskedData = maskedData.replace(/\b[A-Z][a-z]{1,15}[,\s]+[A-Z][a-z]{1,15}\b/g, '[MASKED_NAME]');
        maskedData = maskedData.replace(/\b\d{6,}\b/g, '[MASKED_ID]');
      }

      res.json({
        success: true,
        data: {
          original: test_data,
          masked: maskedData,
          masking_level,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('[PrivacyAPI] Error testing privacy masking:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test privacy masking',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

export default router;