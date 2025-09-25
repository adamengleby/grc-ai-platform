/**
 * User Preferences API Routes
 * Replaces localStorage preferences and settings with secure, tenant-isolated database storage
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { tenantIsolationMiddleware } from '../middleware/authz';
import TenantConfigService from '../services/tenantConfigService';

const router = Router();

// Types for request validation
interface PreferencesUpdateRequest {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  ui_preferences?: Record<string, any>;
  notification_preferences?: Record<string, any>;
  privacy_settings?: Record<string, any>;
  advanced_settings?: Record<string, any>;
}

interface TenantSettingsUpdateRequest {
  organization_name?: string;
  organization_logo_url?: string;
  branding_colors?: Record<string, any>;
  default_llm_config_id?: string;
  default_retention_days?: number;
  enabled_features?: string[];
  security_policies?: Record<string, any>;
  compliance_frameworks?: string[];
  byollm_enabled?: boolean;
  byollm_allowed_providers?: string[];
}

/**
 * GET /api/preferences/user
 * Get user preferences
 * Replaces: localStorage.getItem('theme'), localStorage.getItem('ui_preferences'), etc.
 */
router.get('/user',
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

      const preferences = await TenantConfigService.getUserPreferences(tenantId, userId);

      if (!preferences) {
        // Return default preferences if none exist
        const defaultPreferences = {
          theme: 'light' as const,
          language: 'en-US',
          timezone: 'UTC',
          ui_preferences: {
            sidebar_collapsed: false,
            default_dashboard: 'executive',
            compact_mode: false
          },
          notification_preferences: {
            email_notifications: true,
            push_notifications: false,
            audit_alerts: true,
            weekly_digest: true
          },
          privacy_settings: {
            share_usage_data: false,
            enable_analytics_tracking: true,
            store_chat_history: true
          },
          advanced_settings: {
            debug_mode: false,
            api_timeout_seconds: 30,
            auto_save_interval: 60
          }
        };

        return res.json({
          success: true,
          data: defaultPreferences,
          message: 'Default preferences returned'
        });
      }

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('[PreferencesAPI] Error getting user preferences:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve user preferences',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * PUT /api/preferences/user
 * Update user preferences
 * Replaces: localStorage.setItem('theme', ...), localStorage.setItem('ui_preferences', ...), etc.
 */
router.put('/user',
  authMiddleware,
  tenantIsolationMiddleware,
  [
    body('theme').optional().isIn(['light', 'dark', 'system']).withMessage('Invalid theme'),
    body('language').optional().isLength({ min: 2, max: 10 }).withMessage('Invalid language code'),
    body('timezone').optional().isLength({ min: 3, max: 50 }).withMessage('Invalid timezone'),
    body('ui_preferences').optional().isObject().withMessage('UI preferences must be an object'),
    body('notification_preferences').optional().isObject().withMessage('Notification preferences must be an object'),
    body('privacy_settings').optional().isObject().withMessage('Privacy settings must be an object'),
    body('advanced_settings').optional().isObject().withMessage('Advanced settings must be an object')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const updates: PreferencesUpdateRequest = req.body;

      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const updatedPreferences = await TenantConfigService.updateUserPreferences(tenantId, userId, updates);

      console.log('[PreferencesAPI] Updated user preferences for user:', userId);

      res.json({
        success: true,
        data: updatedPreferences,
        message: 'User preferences updated successfully'
      });
    } catch (error) {
      console.error('[PreferencesAPI] Error updating user preferences:', error);
      res.status(500).json({ 
        error: 'Failed to update user preferences',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * POST /api/preferences/user/reset
 * Reset user preferences to defaults
 */
router.post('/user/reset',
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

      const resetPreferences = await TenantConfigService.resetUserPreferences(tenantId, userId);

      console.log('[PreferencesAPI] Reset user preferences for user:', userId);

      res.json({
        success: true,
        data: resetPreferences,
        message: 'User preferences reset to defaults'
      });
    } catch (error) {
      console.error('[PreferencesAPI] Error resetting user preferences:', error);
      res.status(500).json({ 
        error: 'Failed to reset user preferences',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/preferences/tenant
 * Get tenant settings (for tenant owners/admins)
 * Replaces: Various localStorage tenant-level settings
 */
router.get('/tenant',
  authMiddleware,
  tenantIsolationMiddleware,
  // TODO: Add role-based access control middleware (TenantOwner role required)
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      const tenantSettings = await TenantConfigService.getTenantSettings(tenantId);

      if (!tenantSettings) {
        return res.status(404).json({
          error: 'Tenant settings not found',
          code: 'SETTINGS_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: tenantSettings
      });
    } catch (error) {
      console.error('[PreferencesAPI] Error getting tenant settings:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve tenant settings',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * PUT /api/preferences/tenant
 * Update tenant settings (for tenant owners/admins)
 */
router.put('/tenant',
  authMiddleware,
  tenantIsolationMiddleware,
  // TODO: Add role-based access control middleware (TenantOwner role required)
  [
    body('organization_name').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Organization name must be under 255 characters'),
    body('organization_logo_url').optional().isURL().withMessage('Organization logo must be a valid URL'),
    body('branding_colors').optional().isObject().withMessage('Branding colors must be an object'),
    body('default_llm_config_id').optional().isUUID().withMessage('Invalid LLM config ID'),
    body('default_retention_days').optional().isInt({ min: 1, max: 3650 }).withMessage('Retention days must be between 1 and 3650'),
    body('enabled_features').optional().isArray().withMessage('Enabled features must be an array'),
    body('security_policies').optional().isObject().withMessage('Security policies must be an object'),
    body('compliance_frameworks').optional().isArray().withMessage('Compliance frameworks must be an array'),
    body('byollm_enabled').optional().isBoolean().withMessage('BYOLLM enabled must be boolean'),
    body('byollm_allowed_providers').optional().isArray().withMessage('BYOLLM providers must be an array')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.user?.tenantId;
      const updates: TenantSettingsUpdateRequest = req.body;

      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      const updatedSettings = await TenantConfigService.updateTenantSettings(tenantId, updates);

      console.log('[PreferencesAPI] Updated tenant settings for tenant:', tenantId);

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Tenant settings updated successfully'
      });
    } catch (error) {
      console.error('[PreferencesAPI] Error updating tenant settings:', error);
      res.status(500).json({ 
        error: 'Failed to update tenant settings',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/preferences/tenant/features
 * Get enabled features for tenant
 */
router.get('/tenant/features',
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

      const features = await TenantConfigService.getTenantFeatures(tenantId);

      res.json({
        success: true,
        data: {
          enabled_features: features
        }
      });
    } catch (error) {
      console.error('[PreferencesAPI] Error getting tenant features:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve tenant features',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * GET /api/preferences/tenant/features/:feature
 * Check if specific feature is enabled for tenant
 */
router.get('/tenant/features/:feature',
  authMiddleware,
  tenantIsolationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { feature } = req.params;

      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID required',
          code: 'MISSING_TENANT'
        });
      }

      const isEnabled = await TenantConfigService.hasFeature(tenantId, feature);

      res.json({
        success: true,
        data: {
          feature: feature,
          enabled: isEnabled
        }
      });
    } catch (error) {
      console.error('[PreferencesAPI] Error checking feature:', error);
      res.status(500).json({ 
        error: 'Failed to check feature status',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

export default router;