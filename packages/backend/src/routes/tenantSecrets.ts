/**
 * Tenant Secrets API Routes
 * Provides endpoints for tenant self-service secret management with Azure Key Vault
 */

import { Router, Request, Response } from 'express';
import { tenantSecretService } from '../services/tenantSecretService';
import winston from 'winston';

const router = Router();

// Logger for this module
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ]
});

/**
 * GET /api/v1/tenant-secrets
 * List all secrets for the current tenant (metadata only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'; // Default for demo

    const secrets = await tenantSecretService.listTenantSecrets(tenantId);

    res.json({
      success: true,
      data: {
        secrets,
        count: secrets.length
      },
      meta: {
        timestamp: new Date().toISOString(),
        tenantId
      }
    });

  } catch (error) {
    logger.error('Failed to list tenant secrets', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_SECRETS_FAILED',
        message: 'Failed to list secrets',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/v1/tenant-secrets
 * Create or update a secret for the tenant
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'; // Default for demo
    const { secretName, secretValue, description, type, contentType, tags } = req.body;

    // Validate required fields
    if (!secretName || !secretValue) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'secretName and secretValue are required',
          details: {
            requiredFields: ['secretName', 'secretValue'],
            providedFields: Object.keys(req.body)
          }
        }
      });
    }

    // Validate secret name format (alphanumeric, hyphens, underscores only)
    const secretNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!secretNameRegex.test(secretName)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SECRET_NAME',
          message: 'Secret name must contain only alphanumeric characters, hyphens, and underscores',
          details: {
            secretName,
            allowedPattern: 'alphanumeric, hyphens, underscores only'
          }
        }
      });
    }

    const secretReference = await tenantSecretService.setTenantSecret(
      tenantId,
      secretName,
      secretValue,
      {
        description,
        type: type || 'custom',
        contentType,
        tags
      }
    );

    res.status(201).json({
      success: true,
      data: {
        secretName,
        secretReference,
        message: 'Secret created/updated successfully'
      },
      meta: {
        timestamp: new Date().toISOString(),
        tenantId,
        operation: 'create_or_update'
      }
    });

  } catch (error) {
    logger.error('Failed to create/update tenant secret', {
      error: error.message,
      stack: error.stack,
      secretName: req.body.secretName
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SET_SECRET_FAILED',
        message: 'Failed to create/update secret',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/v1/tenant-secrets/:secretName
 * Retrieve a secret value (use with caution - only for testing/development)
 */
router.get('/:secretName', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'; // Default for demo
    const { secretName } = req.params;

    // Security warning for production
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Secret value retrieval attempted in production', {
        tenantId,
        secretName,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    const secretValue = await tenantSecretService.getTenantSecret(tenantId, secretName);

    res.json({
      success: true,
      data: {
        secretName,
        secretValue: process.env.NODE_ENV === 'production' ? '[REDACTED]' : secretValue,
        warning: process.env.NODE_ENV === 'production' 
          ? 'Secret values are not returned in production for security' 
          : 'Secret value included for development/testing only'
      },
      meta: {
        timestamp: new Date().toISOString(),
        tenantId,
        environment: process.env.NODE_ENV || 'development'
      }
    });

  } catch (error) {
    logger.error('Failed to retrieve tenant secret', {
      error: error.message,
      stack: error.stack,
      secretName: req.params.secretName
    });

    res.status(404).json({
      success: false,
      error: {
        code: 'SECRET_NOT_FOUND',
        message: 'Secret not found or access denied',
        details: {
          secretName: req.params.secretName,
          hint: 'Check secret name spelling and ensure it exists for this tenant'
        }
      }
    });
  }
});

/**
 * DELETE /api/v1/tenant-secrets/:secretName
 * Delete a secret for the tenant
 */
router.delete('/:secretName', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'; // Default for demo
    const { secretName } = req.params;

    await tenantSecretService.deleteTenantSecret(tenantId, secretName);

    res.json({
      success: true,
      data: {
        secretName,
        message: 'Secret deleted successfully'
      },
      meta: {
        timestamp: new Date().toISOString(),
        tenantId,
        operation: 'delete'
      }
    });

  } catch (error) {
    logger.error('Failed to delete tenant secret', {
      error: error.message,
      stack: error.stack,
      secretName: req.params.secretName
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_SECRET_FAILED',
        message: 'Failed to delete secret',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/v1/tenant-secrets/_health
 * Test Key Vault connectivity for the tenant
 */
router.get('/_health', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'; // Default for demo

    const isHealthy = await tenantSecretService.testTenantKeyVaultAccess(tenantId);

    res.json({
      success: true,
      data: {
        keyVaultAccess: isHealthy,
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy 
          ? 'Key Vault access is working correctly'
          : 'Key Vault access failed - check configuration and permissions'
      },
      meta: {
        timestamp: new Date().toISOString(),
        tenantId,
        testType: 'key_vault_connectivity'
      }
    });

  } catch (error) {
    logger.error('Key Vault health check failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Key Vault health check failed',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/v1/tenant-secrets/_generate-reference
 * Generate a Key Vault reference string for use in configurations
 */
router.post('/_generate-reference', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'; // Default for demo
    const { secretName } = req.body;

    if (!secretName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SECRET_NAME',
          message: 'secretName is required',
          details: {
            requiredFields: ['secretName']
          }
        }
      });
    }

    const reference = tenantSecretService.generateSecretReference(tenantId, secretName);

    res.json({
      success: true,
      data: {
        secretName,
        keyVaultReference: reference,
        usage: 'Use this reference in LLM configurations, MCP configs, or other settings that support Key Vault references'
      },
      meta: {
        timestamp: new Date().toISOString(),
        tenantId
      }
    });

  } catch (error) {
    logger.error('Failed to generate secret reference', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATE_REFERENCE_FAILED',
        message: 'Failed to generate secret reference',
        details: error.message
      }
    });
  }
});

export default router;