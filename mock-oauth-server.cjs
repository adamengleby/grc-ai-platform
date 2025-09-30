#!/usr/bin/env node

/**
 * Mock OAuth 2.0 + OIDC Server for Local Development
 * Simulates Azure AD B2C authentication flows for testing
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 8081;
const JWT_SECRET = 'mock-oauth-secret';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock user database
const MOCK_USERS = {
  'user1@acme.com': {
    id: 'user-001',
    email: 'user1@acme.com',
    name: 'Sarah Chen',
    tenantId: 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6',
    roles: ['TenantOwner'],
    groups: ['ACME-TenantOwners', 'ACME-Users']
  },
  'analyst@acme.com': {
    id: 'user-002',
    email: 'analyst@acme.com',
    name: 'Mike Johnson',
    tenantId: 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6',
    roles: ['AgentUser'],
    groups: ['ACME-AgentUsers', 'ACME-Users']
  },
  'admin@platform.com': {
    id: 'user-005',
    email: 'admin@platform.com',
    name: 'Alex Rodriguez',
    tenantId: 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6',
    roles: ['PlatformOwner'],
    groups: ['Platform-Owners', 'Cross-Tenant-Access']
  }
};

// OIDC Discovery endpoint
app.get('/.well-known/openid_configuration', (req, res) => {
  res.json({
    issuer: `http://localhost:${PORT}`,
    authorization_endpoint: `http://localhost:${PORT}/oauth/authorize`,
    token_endpoint: `http://localhost:${PORT}/oauth/token`,
    userinfo_endpoint: `http://localhost:${PORT}/oauth/userinfo`,
    jwks_uri: `http://localhost:${PORT}/.well-known/jwks.json`,
    scopes_supported: ['openid', 'profile', 'email', 'tenant.read', 'mcp.tools'],
    response_types_supported: ['code', 'token', 'id_token'],
    grant_types_supported: ['authorization_code', 'implicit'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256', 'HS256']
  });
});

// Mock JWKS endpoint
app.get('/.well-known/jwks.json', (req, res) => {
  res.json({
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        kid: 'mock-key-1',
        n: 'mock-modulus',
        e: 'AQAB'
      }
    ]
  });
});

// Authorization endpoint (redirects to login page)
app.get('/oauth/authorize', (req, res) => {
  const { 
    client_id, 
    redirect_uri, 
    response_type, 
    scope, 
    state,
    nonce
  } = req.query;

  // In real OAuth, this would show a login form
  // For demo, redirect to a simple login page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mock OAuth Login</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 100px auto; padding: 20px; }
        .user-card { border: 1px solid #ddd; margin: 10px 0; padding: 15px; cursor: pointer; }
        .user-card:hover { background: #f5f5f5; }
        .user-card.selected { background: #e3f2fd; border-color: #2196f3; }
        button { background: #2196f3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #1976d2; }
        button:disabled { background: #ccc; cursor: not-allowed; }
      </style>
    </head>
    <body>
      <h1>Mock OAuth 2.0 + OIDC Login</h1>
      <p>Select a user to authenticate:</p>
      
      <form id="loginForm" action="/oauth/token" method="post">
        <input type="hidden" name="client_id" value="${client_id}">
        <input type="hidden" name="redirect_uri" value="${redirect_uri}">
        <input type="hidden" name="response_type" value="${response_type}">
        <input type="hidden" name="scope" value="${scope}">
        <input type="hidden" name="state" value="${state}">
        <input type="hidden" name="nonce" value="${nonce}">
        <input type="hidden" name="grant_type" value="authorization_code">
        <input type="hidden" name="username" id="selectedUser" value="">
        
        ${Object.entries(MOCK_USERS).map(([email, user]) => `
          <div class="user-card" onclick="selectUser('${email}')">
            <strong>${user.name}</strong><br>
            <small>${email}</small><br>
            <small>Roles: ${user.roles.join(', ')}</small><br>
            <small>Tenant: ${user.tenantId}</small>
          </div>
        `).join('')}
        
        <br>
        <button type="submit" id="loginBtn" disabled>Authenticate</button>
      </form>

      <script>
        let selectedUser = null;
        
        function selectUser(email) {
          // Remove previous selection
          document.querySelectorAll('.user-card').forEach(card => {
            card.classList.remove('selected');
          });
          
          // Select current user
          event.target.classList.add('selected');
          selectedUser = email;
          document.getElementById('selectedUser').value = email;
          document.getElementById('loginBtn').disabled = false;
        }
      </script>
    </body>
    </html>
  `);
});

// Token endpoint
app.post('/oauth/token', (req, res) => {
  const { 
    client_id,
    redirect_uri,
    username,
    grant_type,
    state,
    nonce,
    scope
  } = req.body;

  const user = MOCK_USERS[username];
  if (!user) {
    return res.status(400).json({ error: 'invalid_user', error_description: 'User not found' });
  }

  // Create access token
  const accessToken = jwt.sign({
    iss: `http://localhost:${PORT}`,
    aud: client_id,
    sub: user.id,
    email: user.email,
    name: user.name,
    tenant_id: user.tenantId,
    roles: user.roles,
    groups: user.groups,
    scope: scope || 'openid profile email tenant.read',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    nonce
  }, JWT_SECRET);

  // Create ID token
  const idToken = jwt.sign({
    iss: `http://localhost:${PORT}`,
    aud: client_id,
    sub: user.id,
    email: user.email,
    name: user.name,
    tenant_id: user.tenantId,
    roles: user.roles,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    nonce
  }, JWT_SECRET);

  // For authorization code flow, redirect with code
  if (grant_type === 'authorization_code' && redirect_uri) {
    const code = uuidv4();
    // Store code temporarily (in production, use proper storage)
    global.authCodes = global.authCodes || {};
    global.authCodes[code] = { user, accessToken, idToken };
    
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.append('code', code);
    if (state) redirectUrl.searchParams.append('state', state);
    
    return res.redirect(redirectUrl.toString());
  }

  // Return tokens directly
  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: scope || 'openid profile email tenant.read'
  });
});

// UserInfo endpoint
app.get('/oauth/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      tenant_id: decoded.tenant_id,
      roles: decoded.roles,
      groups: decoded.groups
    });
  } catch (error) {
    res.status(401).json({ error: 'invalid_token' });
  }
});

// Test endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Mock OAuth 2.0 + OIDC Server',
    endpoints: {
      discovery: `http://localhost:${PORT}/.well-known/openid_configuration`,
      authorize: `http://localhost:${PORT}/oauth/authorize`,
      token: `http://localhost:${PORT}/oauth/token`,
      userinfo: `http://localhost:${PORT}/oauth/userinfo`
    }
  });
});

app.listen(PORT, () => {
  console.log(`🔐 Mock OAuth 2.0 + OIDC Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 OIDC Discovery: http://localhost:${PORT}/.well-known/openid_configuration`);
  console.log(`\n🧪 Test OAuth Flow:`);
  console.log(`   1. Visit: http://localhost:${PORT}/oauth/authorize?client_id=test&redirect_uri=http://localhost:5173/auth/callback&response_type=code&scope=openid profile email tenant.read&state=test123`);
  console.log(`   2. Select a user and authenticate`);
  console.log(`   3. Check the redirect URL for the authorization code`);
});