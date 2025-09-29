// OAuth 2.0 + OIDC Routes for Multi-tenant GRC Platform
import express, { Request, Response } from 'express';
import { auth, requiresAuth } from 'express-openid-connect';
import { oauthManager, getDefaultOAuthConfig } from '../config/oauth';
import { 
  discoverTenant, 
  createTenantOAuthMiddleware, 
  oauthHealthCheck,
  extractUserContext,
  devSimulateAuth
} from '../middleware/oauth';

const router = express.Router();

// Apply tenant discovery to all OAuth routes
router.use(discoverTenant);

// OAuth health check
router.get('/health', oauthHealthCheck);

// Default OAuth setup (fallback for non-tenant routes)
const defaultConfig = getDefaultOAuthConfig();
router.use('/default', auth(defaultConfig));

// Tenant-specific OAuth routes
router.get('/tenants', (req: Request, res: Response) => {
  const tenantSlugs = oauthManager.getTenantSlugs();
  const tenants = tenantSlugs.map(slug => {
    const config = oauthManager.getTenantConfig(slug);
    return {
      slug,
      id: config?.tenantId,
      loginUrl: `/auth/${slug}/login`,
      logoutUrl: `/auth/${slug}/logout`
    };
  });
  
  res.json({ tenants });
});

// Dynamic tenant OAuth middleware setup
const setupTenantAuth = (tenantSlug: string) => {
  const tenantRouter = express.Router();
  
  try {
    const tenantMiddleware = createTenantOAuthMiddleware(tenantSlug);
    
    // Apply OAuth middleware to all tenant routes
    tenantRouter.use(tenantMiddleware);
    tenantRouter.use(extractUserContext);
    tenantRouter.use(devSimulateAuth);
    
    // Tenant-specific login (redirects to Auth0)
    tenantRouter.get('/login', (req: Request, res: Response) => {
      // The auth middleware handles the redirect
      res.redirect(`/auth/${tenantSlug}/login`);
    });

    // Tenant-specific callback
    tenantRouter.get('/callback', (req: Request, res: Response) => {
      // After successful auth, redirect to frontend with tenant context
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/dashboard?tenant=${tenantSlug}`);
    });

    // Tenant-specific logout
    tenantRouter.get('/logout', (req: Request, res: Response) => {
      // The auth middleware handles logout
      res.redirect(`/auth/${tenantSlug}/logout`);
    });

    // Get current user info for this tenant
    tenantRouter.get('/me', requiresAuth(), (req: Request, res: Response) => {
      try {
        const user = req.oidc?.user;
        const claims = req.oidc?.idTokenClaims;
        
        if (!user) {
          return res.status(401).json({ error: 'No user information available' });
        }

        res.json({
          user: {
            id: user.sub,
            email: user.email,
            name: user.name,
            picture: user.picture,
          },
          tenant: {
            id: req.tenantId,
            slug: tenantSlug,
          },
          roles: req.userRoles || [],
          permissions: req.userPermissions || [],
          claims: claims ? {
            iss: claims.iss,
            aud: claims.aud,
            exp: claims.exp,
            iat: claims.iat,
          } : null,
          accessToken: req.oidc?.accessToken ? {
            hasToken: true,
            expiresIn: req.oidc.accessToken.expires_in,
            scope: req.oidc.accessToken.scope
          } : null
        });
      } catch (error) {
        console.error(`OAuth: Error getting user info for ${tenantSlug}:`, error);
        res.status(500).json({ error: 'Failed to get user information' });
      }
    });

    // Get access token for API calls
    tenantRouter.get('/token', requiresAuth(), (req: Request, res: Response) => {
      const accessToken = req.oidc?.accessToken;
      
      if (!accessToken) {
        return res.status(401).json({ error: 'No access token available' });
      }

      res.json({
        access_token: accessToken.access_token,
        token_type: accessToken.token_type,
        expires_in: accessToken.expires_in,
        scope: accessToken.scope
      });
    });

    return tenantRouter;
  } catch (error) {
    console.error(`OAuth: Failed to setup tenant auth for ${tenantSlug}:`, error);
    
    // Return error router
    const errorRouter = express.Router();
    errorRouter.use('*', (req: Request, res: Response) => {
      res.status(500).json({ 
        error: 'OAuth configuration error',
        tenant: tenantSlug,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
    return errorRouter;
  }
};

// Register all configured tenants
const registerTenantRoutes = () => {
  const tenantSlugs = oauthManager.getTenantSlugs();
  
  tenantSlugs.forEach(tenantSlug => {
    const tenantRouter = setupTenantAuth(tenantSlug);
    router.use(`/${tenantSlug}`, tenantRouter);
    console.log(`OAuth: Registered routes for tenant: ${tenantSlug}`);
  });
};

// Initialize tenant routes
registerTenantRoutes();

// Generic login endpoint (discovers tenant)
router.get('/login', (req: Request, res: Response) => {
  const tenantSlug = req.tenantSlug || req.query.tenant as string;
  
  if (tenantSlug && oauthManager.getTenantConfig(tenantSlug)) {
    return res.redirect(`/auth/${tenantSlug}/login`);
  }
  
  // Default login
  return res.redirect('/auth/default/login');
});

// Generic logout endpoint
router.get('/logout', (req: Request, res: Response) => {
  const tenantSlug = req.tenantSlug || req.query.tenant as string;
  
  if (tenantSlug && oauthManager.getTenantConfig(tenantSlug)) {
    return res.redirect(`/auth/${tenantSlug}/logout`);
  }
  
  // Default logout
  return res.redirect('/auth/default/logout');
});

// Development endpoints for testing
if (process.env.NODE_ENV === 'development') {
  router.get('/dev/simulate/:tenant/:user', (req: Request, res: Response) => {
    const { tenant, user } = req.params;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    res.redirect(`${frontendUrl}/dashboard?tenant=${tenant}&dev_user=${user}`);
  });

  router.get('/dev/config/:tenant?', (req: Request, res: Response) => {
    const tenantSlug = req.params.tenant;
    
    if (tenantSlug) {
      const config = oauthManager.getAuth0ConfigForTenant(tenantSlug);
      res.json({
        tenant: tenantSlug,
        config: config ? {
          issuerBaseURL: config.issuerBaseURL,
          clientID: config.clientID,
          routes: config.routes,
          authorizationParams: config.authorizationParams
        } : null
      });
    } else {
      res.json({
        tenants: oauthManager.getTenantSlugs(),
        defaultConfig: {
          issuerBaseURL: defaultConfig.issuerBaseURL,
          clientID: defaultConfig.clientID,
          routes: defaultConfig.routes
        }
      });
    }
  });
}

// Error handling for OAuth routes
router.use((error: Error, req: Request, res: Response, next: any) => {
  console.error('OAuth Route Error:', error);
  
  res.status(500).json({
    error: 'OAuth authentication error',
    message: error.message,
    tenant: req.tenantSlug
  });
});

export default router;