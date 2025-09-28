/**
 * Authentication Service
 * Handles Azure B2C integration, user management, and session handling
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { 
  AzureB2CToken, 
  User, 
  Tenant, 
  UserRole,
  LoginRequest,
  LoginResponse,
  CallbackRequest,
  AuthTokenResponse,
  TenantSwitchRequest,
  TenantSwitchResponse,
  SecurityEvent
} from '../types/auth';
import { UserService } from './userService';
import { TenantService } from './tenantService';
import { auditLogger } from './auditService';
import { DatabaseService } from './databaseService';

// Azure B2C Configuration
interface AzureB2CConfig {
  tenantName: string;
  tenantId: string;
  policyName: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
}

export class AuthService {
  private db: DatabaseService;
  private userService: UserService;
  private tenantService: TenantService;
  private b2cConfig: AzureB2CConfig;
  private sessionStore: Map<string, any> = new Map(); // In production, use Redis

  constructor() {
    this.db = DatabaseService.getInstance();
    this.userService = new UserService();
    this.tenantService = new TenantService();
    
    // Initialize Azure B2C configuration from environment variables
    const tenantName = process.env.AZURE_B2C_TENANT_NAME || 'grcplatform';
    const tenantId = process.env.AZURE_B2C_TENANT_ID;
    const policyName = process.env.AZURE_B2C_POLICY_NAME || 'B2C_1_signin_signup';
    
    if (!tenantId || !process.env.AZURE_B2C_CLIENT_ID || !process.env.AZURE_B2C_CLIENT_SECRET) {
      throw new Error('Missing required Azure B2C configuration');
    }

    this.b2cConfig = {
      tenantName,
      tenantId,
      policyName,
      clientId: process.env.AZURE_B2C_CLIENT_ID,
      clientSecret: process.env.AZURE_B2C_CLIENT_SECRET,
      redirectUri: process.env.AZURE_B2C_REDIRECT_URI || 'http://localhost:3000/auth/callback',
      scope: 'openid profile email',
      authorizeEndpoint: `https://${tenantName}.b2clogin.com/${tenantName}.onmicrosoft.com/${policyName}/oauth2/v2.0/authorize`,
      tokenEndpoint: `https://${tenantName}.b2clogin.com/${tenantName}.onmicrosoft.com/${policyName}/oauth2/v2.0/token`,
      jwksUri: `https://${tenantName}.b2clogin.com/${tenantName}.onmicrosoft.com/${policyName}/discovery/v2.0/keys`
    };
  }

  /**
   * Initiate Azure B2C login flow
   */
  async initiateLogin(request: LoginRequest, clientIp?: string): Promise<LoginResponse> {
    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');

    // Store state and nonce for verification
    this.sessionStore.set(state, {
      nonce,
      email: request.email,
      redirect_uri: request.redirect_uri,
      created_at: Date.now(),
      client_ip: clientIp
    });

    // Build authorization URL
    const authUrl = new URL(this.b2cConfig.authorizeEndpoint);
    authUrl.searchParams.set('client_id', this.b2cConfig.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', this.b2cConfig.redirectUri);
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('scope', this.b2cConfig.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    
    // Optional: Pre-fill email if provided
    if (request.email) {
      authUrl.searchParams.set('login_hint', request.email);
    }

    await auditLogger.logEvent({
      eventType: 'login_initiated',
      eventCategory: 'authentication',
      severity: 'info',
      details: {
        email: request.email,
        clientIp,
        state
      }
    });

    return {
      redirect_url: authUrl.toString(),
      state
    };
  }

  /**
   * Handle Azure B2C callback and issue application tokens
   */
  async handleCallback(request: CallbackRequest, clientIp?: string, userAgent?: string): Promise<AuthTokenResponse> {
    // Verify state parameter
    const sessionData = this.sessionStore.get(request.state);
    if (!sessionData) {
      await auditLogger.logSecurityEvent({
        eventType: 'authentication_failure',
        details: { reason: 'Invalid state parameter', state: request.state },
        clientIp,
        userAgent
      });
      throw new Error('Invalid state parameter');
    }

    // Check session age (prevent replay attacks)
    const sessionAge = Date.now() - sessionData.created_at;
    if (sessionAge > 10 * 60 * 1000) { // 10 minutes
      this.sessionStore.delete(request.state);
      throw new Error('Session expired');
    }

    try {
      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(request.code);
      
      // Decode and validate ID token
      const idToken = this.decodeIdToken(tokenResponse.id_token);
      await this.validateIdToken(idToken, sessionData.nonce);

      // Find or create user in our database
      const user = await this.findOrCreateUser(idToken, clientIp, userAgent);
      
      // Generate application access token
      const accessToken = await this.generateAccessToken(user, user.primary_tenant_id);
      const refreshToken = await this.generateRefreshToken(user.user_id);

      // Get tenant information
      const tenant = await this.tenantService.getTenantById(user.primary_tenant_id);
      if (!tenant) {
        throw new Error('User primary tenant not found');
      }

      // Update last login
      await this.userService.updateLastLogin(user.user_id, clientIp, userAgent);

      // Get user roles for primary tenant
      const userRoles = await this.userService.getUserRolesForTenant(user.user_id, user.primary_tenant_id);

      // Clean up session
      this.sessionStore.delete(request.state);

      await auditLogger.logEvent({
        eventType: 'authentication_success',
        eventCategory: 'authentication',
        severity: 'info',
        userId: user.user_id,
        tenantId: user.primary_tenant_id,
        details: {
          azureObjectId: idToken.oid,
          clientIp,
          userAgent
        }
      });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
        user: {
          user_id: user.user_id,
          email: user.email,
          name: user.name,
          primary_tenant_id: user.primary_tenant_id,
          roles: userRoles,
          mfa_enabled: user.mfa_enabled,
          last_login_at: new Date().toISOString()
        },
        tenant: {
          tenant_id: tenant.tenant_id,
          name: tenant.name,
          slug: tenant.slug,
          subscription_tier: tenant.subscription_tier,
          status: tenant.status
        }
      };

    } catch (error) {
      this.sessionStore.delete(request.state);
      
      await auditLogger.logSecurityEvent({
        eventType: 'authentication_failure',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          state: request.state
        },
        clientIp,
        userAgent
      });

      throw error;
    }
  }

  /**
   * Get available tenants for a user
   */
  async getAvailableTenants(userId: string): Promise<{ tenant_id: string; name: string; slug: string; subscription_tier: string; user_roles: UserRole[]; status: string }[]> {
    const query = `
      SELECT 
        t.tenant_id,
        t.name,
        t.slug,
        t.subscription_tier,
        t.status,
        STRING_AGG(utr.role, ',') as roles
      FROM tenants t
      JOIN user_tenant_roles utr ON t.tenant_id = utr.tenant_id
      WHERE utr.user_id = ? 
        AND t.status = 'active'
        AND (utr.expires_at IS NULL OR utr.expires_at > GETUTCDATE())
      GROUP BY t.tenant_id, t.name, t.slug, t.subscription_tier, t.status
      ORDER BY t.name
    `;

    const results = await this.db.query(query, [userId]);
    
    return results.map(row => ({
      tenant_id: row.tenant_id,
      name: row.name,
      slug: row.slug,
      subscription_tier: row.subscription_tier,
      user_roles: row.roles ? row.roles.split(',') as UserRole[] : [],
      status: row.status
    }));
  }

  /**
   * Switch user to a different tenant
   */
  async switchTenant(userId: string, request: TenantSwitchRequest, clientIp?: string, userAgent?: string): Promise<TenantSwitchResponse> {
    // Verify user has access to the requested tenant
    const hasAccess = await this.userService.userHasAccessToTenant(userId, request.tenant_id);
    if (!hasAccess) {
      await auditLogger.logSecurityEvent({
        eventType: 'unauthorized_tenant_access',
        userId,
        details: { requestedTenant: request.tenant_id },
        clientIp,
        userAgent
      });
      throw new Error('User does not have access to the requested tenant');
    }

    // Get tenant information
    const tenant = await this.tenantService.getTenantById(request.tenant_id);
    if (!tenant || tenant.status !== 'active') {
      throw new Error('Tenant is not active');
    }

    // Generate new access token with tenant context
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const accessToken = await this.generateAccessToken(user, request.tenant_id);

    await auditLogger.logEvent({
      eventType: 'tenant_switch',
      eventCategory: 'authentication',
      severity: 'info',
      userId,
      tenantId: request.tenant_id,
      details: {
        previousTenant: user.primary_tenant_id,
        newTenant: request.tenant_id,
        clientIp,
        userAgent
      }
    });

    return {
      access_token: accessToken,
      tenant: {
        tenant_id: tenant.tenant_id,
        name: tenant.name,
        subscription_tier: tenant.subscription_tier,
        status: tenant.status
      }
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshTokenValue: string, clientIp?: string, userAgent?: string): Promise<AuthTokenResponse> {
    // Validate refresh token
    const tokenData = await this.validateRefreshToken(refreshTokenValue);
    if (!tokenData) {
      await auditLogger.logSecurityEvent({
        eventType: 'authentication_failure',
        details: { reason: 'Invalid refresh token' },
        clientIp,
        userAgent
      });
      throw new Error('Invalid refresh token');
    }

    const user = await this.userService.getUserById(tokenData.userId);
    if (!user || user.status !== 'active') {
      throw new Error('User not found or inactive');
    }

    const tenant = await this.tenantService.getTenantById(tokenData.tenantId);
    if (!tenant || tenant.status !== 'active') {
      throw new Error('Tenant not found or inactive');
    }

    // Generate new tokens
    const accessToken = await this.generateAccessToken(user, tokenData.tenantId);
    const newRefreshToken = await this.generateRefreshToken(user.user_id);

    // Invalidate old refresh token
    await this.invalidateRefreshToken(refreshTokenValue);

    const userRoles = await this.userService.getUserRolesForTenant(user.user_id, tokenData.tenantId);

    await auditLogger.logEvent({
      eventType: 'token_refresh',
      eventCategory: 'authentication',
      severity: 'info',
      userId: user.user_id,
      tenantId: tokenData.tenantId,
      details: { clientIp, userAgent }
    });

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        primary_tenant_id: user.primary_tenant_id,
        roles: userRoles,
        mfa_enabled: user.mfa_enabled,
        last_login_at: user.last_login_at
      },
      tenant: {
        tenant_id: tenant.tenant_id,
        name: tenant.name,
        slug: tenant.slug,
        subscription_tier: tenant.subscription_tier,
        status: tenant.status
      }
    };
  }

  /**
   * Logout user and invalidate tokens
   */
  async logout(userId: string, tenantId: string, refreshToken?: string, clientIp?: string, userAgent?: string): Promise<void> {
    // Invalidate refresh token if provided
    if (refreshToken) {
      await this.invalidateRefreshToken(refreshToken);
    }

    // In a production system, you might also maintain a blacklist of access tokens
    // or use short-lived tokens with a token introspection endpoint

    await auditLogger.logEvent({
      eventType: 'logout',
      eventCategory: 'authentication',
      severity: 'info',
      userId,
      tenantId,
      details: { clientIp, userAgent }
    });
  }

  // Private helper methods

  /**
   * Exchange authorization code for tokens with Azure B2C
   */
  private async exchangeCodeForTokens(code: string): Promise<any> {
    const tokenData = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.b2cConfig.clientId,
      client_secret: this.b2cConfig.clientSecret,
      code,
      redirect_uri: this.b2cConfig.redirectUri,
      scope: this.b2cConfig.scope
    });

    const response = await axios.post(this.b2cConfig.tokenEndpoint, tokenData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.status !== 200) {
      throw new Error('Failed to exchange code for tokens');
    }

    return response.data;
  }

  /**
   * Decode ID token (JWT) without verification (verification done separately)
   */
  private decodeIdToken(idToken: string): AzureB2CToken {
    const [header, payload] = idToken.split('.');
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  }

  /**
   * Validate ID token claims
   */
  private async validateIdToken(token: AzureB2CToken, expectedNonce: string): Promise<void> {
    // Check expiration
    if (token.exp < Date.now() / 1000) {
      throw new Error('ID token expired');
    }

    // Check audience
    if (token.aud !== this.b2cConfig.clientId) {
      throw new Error('Invalid audience');
    }

    // Check issuer
    const expectedIssuer = `https://${this.b2cConfig.tenantName}.b2clogin.com/${this.b2cConfig.tenantId}/v2.0/`;
    if (!token.iss.startsWith(expectedIssuer)) {
      throw new Error('Invalid issuer');
    }

    // Note: In production, you should also verify the signature using JWKS
  }

  /**
   * Find existing user or create new user from Azure B2C token
   */
  private async findOrCreateUser(token: AzureB2CToken, clientIp?: string, userAgent?: string): Promise<User> {
    const azureObjectId = token.oid || token.sub;
    const email = token.email || token.emails?.[0];
    const name = token.name || `${token.given_name} ${token.family_name}`.trim();

    if (!email) {
      throw new Error('Email is required from Azure B2C token');
    }

    // Try to find existing user
    let user = await this.userService.getUserByAzureObjectId(azureObjectId);

    if (!user) {
      // Create new user
      // First, determine which tenant this user should belong to
      // This could be based on email domain, invitation, etc.
      const primaryTenant = await this.determinePrimaryTenant(email);

      user = await this.userService.createUser({
        azure_b2c_object_id: azureObjectId,
        email,
        name,
        primary_tenant_id: primaryTenant.tenant_id,
        status: 'active',
        mfa_enabled: false // Will be updated based on Azure B2C policy
      });

      // Assign default role for new users
      await this.userService.assignUserRole(user.user_id, primaryTenant.tenant_id, 'AgentUser');

      await auditLogger.logEvent({
        eventType: 'user_created',
        eventCategory: 'authentication',
        severity: 'info',
        userId: user.user_id,
        tenantId: primaryTenant.tenant_id,
        details: {
          email,
          azureObjectId,
          source: 'azure_b2c',
          clientIp,
          userAgent
        }
      });
    } else {
      // Update existing user information if needed
      if (user.email !== email || user.name !== name) {
        await this.userService.updateUser(user.user_id, {
          email,
          name
        });
      }
    }

    return user;
  }

  /**
   * Determine primary tenant for new user
   * This is a simplified implementation - in production you might have more complex logic
   */
  private async determinePrimaryTenant(email: string): Promise<Tenant> {
    const domain = email.split('@')[1];
    
    // Try to find tenant by email domain
    let tenant = await this.tenantService.getTenantByDomain(domain);
    
    if (!tenant) {
      // Use default tenant or create one
      // For this example, we'll use the first active tenant
      const tenants = await this.tenantService.getActiveTenants();
      if (tenants.length === 0) {
        throw new Error('No active tenants available');
      }
      tenant = tenants[0];
    }

    return tenant;
  }

  /**
   * Generate application access token (JWT)
   */
  private async generateAccessToken(user: User, tenantId: string): Promise<string> {
    const payload = {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      tenantId,
      azureObjectId: user.azure_b2c_object_id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      aud: 'grc-ai-platform',
      iss: 'grc-ai-platform-auth'
    };

    // In production, use proper JWT signing with RS256
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'dev-secret-key';
    
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  /**
   * Generate refresh token
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store refresh token in database
    const query = `
      INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
      VALUES (?, ?, ?, GETUTCDATE())
    `;

    await this.db.execute(query, [refreshToken, userId, expiresAt.toISOString()]);

    return refreshToken;
  }

  /**
   * Validate refresh token
   */
  private async validateRefreshToken(token: string): Promise<{ userId: string; tenantId: string } | null> {
    const query = `
      SELECT rt.user_id, u.primary_tenant_id as tenant_id
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.user_id
      WHERE rt.token = ? 
        AND rt.expires_at > GETUTCDATE()
        AND rt.revoked_at IS NULL
    `;

    const results = await this.db.query(query, [token]);
    
    if (results.length === 0) {
      return null;
    }

    return {
      userId: results[0].user_id,
      tenantId: results[0].tenant_id
    };
  }

  /**
   * Invalidate refresh token
   */
  private async invalidateRefreshToken(token: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens 
      SET revoked_at = GETUTCDATE()
      WHERE token = ?
    `;

    await this.db.execute(query, [token]);
  }
}