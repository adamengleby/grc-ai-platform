import { Router, Request, Response } from 'express';
import { samlAuthService } from '../services/samlAuthService';

export const samlAuthRouter = Router();

/**
 * SAML Authentication Routes
 * Handles per-tenant SAML authentication flow
 */

/**
 * Initiate SAML authentication for a tenant
 * GET /auth/saml/:tenantSlug/login
 */
samlAuthRouter.get('/:tenantSlug/login', async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { relayState } = req.query;

    const result = await samlAuthService.initiateAuth({
      tenantSlug,
      relayState: relayState as string
    });

    // Redirect user to IdP for authentication
    res.redirect(result.redirectUrl);

  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SAML_INIT_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Handle SAML authentication callback
 * POST /auth/saml/:tenantSlug/callback
 */
samlAuthRouter.post('/:tenantSlug/callback', async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;
    const { SAMLResponse, RelayState } = req.body;

    if (!SAMLResponse) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SAML_RESPONSE',
          message: 'SAML response is required'
        }
      });
    }

    const result = await samlAuthService.handleCallback({
      tenantSlug,
      samlResponse: SAMLResponse,
      relayState: RelayState
    });

    if (result.success) {
      // Set session cookie and redirect to application
      res.cookie('session_token', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });

      // Redirect to frontend dashboard or relay state URL
      const redirectUrl = RelayState || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`;
      res.redirect(redirectUrl);
    } else {
      // Authentication failed
      res.status(401).json(result);
    }

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SAML_CALLBACK_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Generate SAML metadata for a tenant
 * GET /auth/saml/:tenantSlug/metadata
 */
samlAuthRouter.get('/:tenantSlug/metadata', async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;

    const metadata = await samlAuthService.generateMetadata(tenantSlug);

    res.set('Content-Type', 'application/samlmetadata+xml');
    res.send(metadata);

  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'METADATA_GENERATION_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Test SAML configuration for a tenant
 * GET /auth/saml/:tenantSlug/test
 */
samlAuthRouter.get('/:tenantSlug/test', async (req: Request, res: Response) => {
  try {
    const { tenantSlug } = req.params;

    const testResult = await samlAuthService.testConfiguration(tenantSlug);

    res.json({
      success: true,
      data: testResult
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_TEST_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * SAML logout endpoint
 * POST /auth/saml/:tenantSlug/logout
 */
samlAuthRouter.post('/:tenantSlug/logout', async (req: Request, res: Response) => {
  try {
    // Clear session cookie
    res.clearCookie('session_token');

    // For now, just redirect to login
    // In production, implement proper SAML SLO (Single Logout)
    res.json({
      success: true,
      message: 'Logged out successfully',
      redirectUrl: `/auth/saml/${req.params.tenantSlug}/login`
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: error.message
      }
    });
  }
});

export default samlAuthRouter;