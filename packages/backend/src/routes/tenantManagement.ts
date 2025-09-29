/**
 * Tenant Management API Routes
 * Complete REST API for multi-tenant SAML authentication management
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { tenantManagementService } from '../services/tenantManagementService';
import {
  CreateTenantRequest,
  TenantConfigurationRequest,
  SAMLTestRequest,
  TenantManagementError,
  SAMLConfigurationError,
  TenantProvisioningError
} from '../types/tenant-management';

const router = Router();

// =============================================
// Validation Middleware
// =============================================

const validateRequest = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array()
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
  next();
};

const requirePlatformAdmin = (req: Request, res: Response, next: Function) => {
  // In real implementation, this would verify JWT token and check platform admin role
  // For now, we'll simulate this check
  const adminUserId = req.headers['x-admin-user-id'] as string;
  if (!adminUserId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Platform admin authentication required'
      }
    });
  }
  req.user = { id: adminUserId, role: 'SuperAdmin' };
  next();
};

const errorHandler = (error: Error, req: Request, res: Response, next: Function) => {
  console.error('Tenant Management API Error:', error);

  if (error instanceof TenantManagementError) {
    const statusCode = error.code === 'TENANT_NOT_FOUND' ? 404 : 400;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: req.headers['x-request-id'] || 'unknown',
        tenant_id: error.tenant_id
      }
    });
  }

  if (error instanceof SAMLConfigurationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: req.headers['x-request-id'] || 'unknown',
        tenant_id: error.tenant_id
      }
    });
  }

  if (error instanceof TenantProvisioningError) {
    return res.status(500).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: req.headers['x-request-id'] || 'unknown',
        tenant_id: error.tenant_id
      }
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    },
    meta: {
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'] || 'unknown'
    }
  });
};

// =============================================
// Tenant Management Routes
// =============================================

/**
 * GET /api/v1/tenant-management/tenants
 * Get list of all tenants with filtering and pagination
 */
router.get('/tenants',
  requirePlatformAdmin,
  [
    query('status').optional().isIn(['active', 'suspended', 'provisioning', 'failed']),
    query('subscription_tier').optional().isIn(['starter', 'professional', 'enterprise']),
    query('region').optional().isString(),
    query('search').optional().isString().isLength({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      const filters = {
        status: req.query.status as string,
        subscription_tier: req.query.subscription_tier as string,
        region: req.query.region as string,
        search: req.query.search as string
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50
      };

      const result = await tenantManagementService.getTenants(filters, pagination);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tenant-management/tenants/:tenantId
 * Get detailed information for a specific tenant
 */
router.get('/tenants/:tenantId',
  requirePlatformAdmin,
  [
    param('tenantId').isUUID().withMessage('Valid tenant ID required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      const result = await tenantManagementService.getTenantDetails(req.params.tenantId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/tenant-management/tenants
 * Create a new tenant
 */
router.post('/tenants',
  requirePlatformAdmin,
  [
    body('organization_name').isString().isLength({ min: 1, max: 255 }).withMessage('Organization name required'),
    body('organization_domain').isString().isLength({ min: 1, max: 255 }).withMessage('Organization domain required'),
    body('primary_contact_email').isEmail().withMessage('Valid primary contact email required'),
    body('primary_contact_name').isString().isLength({ min: 1, max: 255 }).withMessage('Primary contact name required'),
    body('subscription_tier').isIn(['starter', 'professional', 'enterprise']).withMessage('Valid subscription tier required'),
    body('region').optional().isString().isLength({ min: 1, max: 50 }),
    body('saml_config').optional().isObject(),
    body('group_mappings').optional().isArray()
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      const createRequest: CreateTenantRequest = req.body;
      const adminUserId = req.user.id;

      const result = await tenantManagementService.createTenant(createRequest, adminUserId);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/tenant-management/tenants/:tenantId/status
 * Update tenant status (activate, suspend, etc.)
 */
router.put('/tenants/:tenantId/status',
  requirePlatformAdmin,
  [
    param('tenantId').isUUID().withMessage('Valid tenant ID required'),
    body('status').isIn(['active', 'suspended', 'deleted']).withMessage('Valid status required'),
    body('reason').optional().isString().isLength({ min: 1, max: 500 })
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      // Implementation would update tenant status
      res.json({
        success: true,
        data: {
          tenant_id: req.params.tenantId,
          status: req.body.status,
          updated_at: new Date().toISOString()
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.headers['x-request-id'] || 'unknown',
          tenant_id: req.params.tenantId
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// SAML Configuration Routes
// =============================================

/**
 * GET /api/v1/tenant-management/tenants/:tenantId/saml
 * Get SAML configuration for a tenant
 */
router.get('/tenants/:tenantId/saml',
  requirePlatformAdmin,
  [
    param('tenantId').isUUID().withMessage('Valid tenant ID required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      // Implementation would get SAML config
      res.json({
        success: true,
        data: {
          tenant_id: req.params.tenantId,
          // SAML configuration would be returned here
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.headers['x-request-id'] || 'unknown',
          tenant_id: req.params.tenantId
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/tenant-management/tenants/:tenantId/saml
 * Configure SAML for a tenant
 */
router.post('/tenants/:tenantId/saml',
  requirePlatformAdmin,
  [
    param('tenantId').isUUID().withMessage('Valid tenant ID required'),
    body('saml_config').isObject().withMessage('SAML configuration required'),
    body('saml_config.idp_entity_id').isString().withMessage('IdP Entity ID required'),
    body('saml_config.idp_sso_url').isURL().withMessage('Valid IdP SSO URL required'),
    body('saml_config.idp_x509_certificate').isString().withMessage('IdP X.509 certificate required'),
    body('group_mappings').optional().isArray(),
    body('test_configuration').optional().isBoolean()
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      const configRequest: TenantConfigurationRequest = {
        tenant_id: req.params.tenantId,
        saml_config: req.body.saml_config,
        group_mappings: req.body.group_mappings,
        test_configuration: req.body.test_configuration
      };

      const adminUserId = req.user.id;
      const result = await tenantManagementService.configureSAML(configRequest, adminUserId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/tenant-management/tenants/:tenantId/saml/test
 * Test SAML configuration
 */
router.post('/tenants/:tenantId/saml/test',
  requirePlatformAdmin,
  [
    param('tenantId').isUUID().withMessage('Valid tenant ID required'),
    body('test_assertion').optional().isString(),
    body('dry_run').optional().isBoolean()
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      const testRequest: SAMLTestRequest = {
        tenant_id: req.params.tenantId,
        test_assertion: req.body.test_assertion,
        dry_run: req.body.dry_run
      };

      const result = await tenantManagementService.testSAMLConfiguration(testRequest);
      res.json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.headers['x-request-id'] || 'unknown',
          tenant_id: req.params.tenantId
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tenant-management/tenants/:tenantId/saml/metadata
 * Get SAML metadata for tenant (for IdP configuration)
 */
router.get('/tenants/:tenantId/saml/metadata',
  [
    param('tenantId').isUUID().withMessage('Valid tenant ID required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      // Generate SAML metadata XML for tenant
      const baseUrl = process.env.PLATFORM_BASE_URL || 'https://grc-platform.example.com';
      const tenantId = req.params.tenantId;
      
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${baseUrl}/saml/metadata/${tenantId}">
  <md:SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true"
                      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                Location="${baseUrl}/saml/acs/${tenantId}"
                                index="1" isDefault="true"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                           Location="${baseUrl}/saml/sls/${tenantId}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

      res.set('Content-Type', 'application/xml');
      res.send(metadata);
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// Configuration Template Routes
// =============================================

/**
 * GET /api/v1/tenant-management/saml/templates
 * Get available SAML configuration templates
 */
router.get('/saml/templates',
  requirePlatformAdmin,
  async (req: Request, res: Response, next: Function) => {
    try {
      const templates = tenantManagementService.getSAMLConfigurationTemplates();
      res.json({
        success: true,
        data: templates,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.headers['x-request-id'] || 'unknown'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tenant-management/saml/templates/:provider
 * Get specific SAML configuration template
 */
router.get('/saml/templates/:provider',
  requirePlatformAdmin,
  [
    param('provider').isIn(['azure-ad', 'okta', 'ping', 'adfs', 'google', 'generic']).withMessage('Valid provider required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      const templates = tenantManagementService.getSAMLConfigurationTemplates();
      const template = templates.find(t => t.provider === req.params.provider);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'SAML configuration template not found'
          }
        });
      }

      res.json({
        success: true,
        data: template,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.headers['x-request-id'] || 'unknown'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// Tenant Onboarding Routes
// =============================================

/**
 * GET /api/v1/tenant-management/onboarding/requests
 * Get tenant onboarding requests
 */
router.get('/onboarding/requests',
  requirePlatformAdmin,
  [
    query('status').optional().isIn(['submitted', 'reviewing', 'approved', 'provisioning', 'configuring', 'testing', 'completed', 'rejected', 'cancelled']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      // Implementation would get onboarding requests
      res.json({
        success: true,
        data: {
          requests: [],
          total_count: 0,
          pagination: {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 50,
            total_pages: 0
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.headers['x-request-id'] || 'unknown'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/tenant-management/onboarding/requests/:requestId/approve
 * Approve tenant onboarding request
 */
router.post('/onboarding/requests/:requestId/approve',
  requirePlatformAdmin,
  [
    param('requestId').isUUID().withMessage('Valid request ID required'),
    body('approval_notes').optional().isString().isLength({ max: 1000 })
  ],
  validateRequest,
  async (req: Request, res: Response, next: Function) => {
    try {
      // Implementation would approve onboarding request and trigger provisioning
      res.json({
        success: true,
        data: {
          request_id: req.params.requestId,
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: req.user.id
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.headers['x-request-id'] || 'unknown'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// Health and Status Routes
// =============================================

/**
 * GET /api/v1/tenant-management/health
 * Health check for tenant management service
 */
router.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'tenant-management',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * GET /api/v1/tenant-management/stats
 * Get platform-wide tenant statistics
 */
router.get('/stats',
  requirePlatformAdmin,
  async (req: Request, res: Response, next: Function) => {
    try {
      // Implementation would calculate platform statistics
      res.json({
        success: true,
        data: {
          total_tenants: 0,
          active_tenants: 0,
          tenants_with_saml: 0,
          total_users: 0,
          active_users_30d: 0,
          api_calls_30d: 0,
          subscription_distribution: {
            starter: 0,
            professional: 0,
            enterprise: 0
          },
          regional_distribution: {},
          provisioning_success_rate: 0
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.headers['x-request-id'] || 'unknown'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

export default router;