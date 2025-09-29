import { Router, Request, Response } from 'express';
import https from 'https';
import { archerSessionService } from '../services/archerSessionService';
import { oauthMcpService } from '../services/oauthMcpService';

/**
 * SOAP authentication fallback for Archer Web Services API
 */
async function authenticateWithSOAP(baseUrl: string, loginData: any, httpsAgent?: https.Agent): Promise<{
  success: boolean;
  sessionToken?: string;
  error?: string;
}> {
  try {
    const soapEndpoint = `${baseUrl.replace(/\/$/, '')}/ws/general.asmx`;
    
    // Build SOAP envelope based on the provided specification
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <CreateDomainUserSessionFromInstance xmlns="http://archer-tech.com/webservices/">
      <instanceName>${loginData.InstanceName}</instanceName>
      <userName>${loginData.Username}</userName>
      <userDomain>${loginData.UserDomain}</userDomain>
      <password>${loginData.Password}</password>
    </CreateDomainUserSessionFromInstance>
  </soap12:Body>
</soap12:Envelope>`;

    console.log(`[Auth SOAP] Attempting SOAP authentication to: ${soapEndpoint}`);

    const response = await fetch(soapEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://archer-tech.com/webservices/CreateDomainUserSessionFromInstance'
      },
      body: soapEnvelope,
      // @ts-ignore - Node.js fetch supports agent
      agent: baseUrl.startsWith('https:') ? httpsAgent : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `SOAP authentication failed: ${response.status} ${response.statusText}`
      };
    }

    const soapResponse = await response.text();
    console.log(`[Auth SOAP] SOAP response received`);

    // Parse SOAP response to extract session token
    const sessionTokenMatch = soapResponse.match(/<CreateDomainUserSessionFromInstanceResult>(.*?)<\/CreateDomainUserSessionFromInstanceResult>/);
    
    if (!sessionTokenMatch || !sessionTokenMatch[1]) {
      // Check for SOAP fault
      const faultMatch = soapResponse.match(/<soap:Fault>.*?<faultstring>(.*?)<\/faultstring>/);
      const errorMessage = faultMatch ? faultMatch[1] : 'Invalid SOAP response - no session token found';
      
      return {
        success: false,
        error: `SOAP authentication failed: ${errorMessage}`
      };
    }

    const sessionToken = sessionTokenMatch[1].trim();
    
    if (sessionToken && sessionToken !== '') {
      console.log(`[Auth SOAP] SOAP authentication successful`);
      return {
        success: true,
        sessionToken
      };
    } else {
      return {
        success: false,
        error: 'SOAP authentication failed: Empty session token returned'
      };
    }

  } catch (error) {
    console.error('[Auth SOAP] SOAP authentication error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SOAP authentication request failed'
    };
  }
}

const router = Router();

/**
 * Authenticate with Archer through backend proxy
 * Solves CORS issues by routing authentication through backend
 */
router.post('/archer/authenticate', async (req: Request, res: Response) => {
  const { baseUrl, username, password, instanceId, userDomainId } = req.body;

  if (!baseUrl || !username || !password || !instanceId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required authentication parameters'
    });
  }

  try {
    console.log(`[Auth] Authenticating user ${username} with Archer at ${baseUrl}`);

    const loginData = {
      InstanceName: instanceId,
      Username: username,
      UserDomain: userDomainId || '1',
      Password: password
    };

    // Create HTTPS agent that accepts self-signed certificates
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false // Accept self-signed certificates for UAT environments
    });

    const loginUrl = `${baseUrl}/api/core/security/login`;

    let sessionToken: string | null = null;
    let authMethod = 'REST';

    // Try REST API first
    try {
      console.log(`[Auth] Attempting REST authentication to: ${loginUrl}`);
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(loginData),
        // @ts-ignore - Node.js fetch supports agent
        agent: baseUrl.startsWith('https:') ? httpsAgent : undefined
      });

      if (response.ok) {
        const authData = await response.json();
        sessionToken = authData.RequestedObject?.SessionToken || authData.SessionToken;
        
        if (sessionToken) {
          console.log(`[Auth] REST authentication successful for ${username}`);
        } else {
          console.log(`[Auth] REST authentication failed - no session token in response`);
        }
      } else {
        console.log(`[Auth] REST authentication failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`[Auth] REST authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // If REST failed, try SOAP fallback
    if (!sessionToken) {
      console.log(`[Auth] Attempting SOAP fallback authentication for ${username}`);
      
      const soapResult = await authenticateWithSOAP(baseUrl, loginData, httpsAgent);
      
      if (soapResult.success && soapResult.sessionToken) {
        sessionToken = soapResult.sessionToken;
        authMethod = 'SOAP';
        console.log(`[Auth] SOAP fallback authentication successful for ${username}`);
      } else {
        console.error(`[Auth] Both REST and SOAP authentication failed for ${username}`);
        console.error(`[Auth] SOAP error: ${soapResult.error}`);
        
        return res.status(401).json({
          success: false,
          error: 'Authentication failed with both REST and SOAP methods',
          details: {
            restError: 'REST API authentication failed',
            soapError: soapResult.error
          }
        });
      }
    }

    // Verify we have a session token
    if (!sessionToken) {
      return res.status(500).json({
        success: false,
        error: 'Authentication failed - no session token obtained',
        details: 'Both REST and SOAP authentication methods failed to return a valid session token'
      });
    }

    console.log(`[Auth] Successfully authenticated ${username} with Archer using ${authMethod}`);

    // Store session token securely on backend
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes from now
    const tenantId = req.headers['x-tenant-id'] as string || 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'; // Extract from headers or use sample tenant ID
    
    const { sessionId } = await archerSessionService.storeSession({
      tenant_id: tenantId,
      username,
      session_token: sessionToken,
      instance_id: instanceId,
      base_url: baseUrl,
      user_domain_id: userDomainId,
      expires_at: expiresAt
    });

    // Generate OAuth token for MCP tool access (optional - fallback if DB schema missing)
    let oauthResult = null;
    try {
      const samlAssertion = {
        username,
        groups: [], // OAuth permissions bypassed in development mode
        tenantId,
        sessionExpiresAt: expiresAt
      };

      oauthResult = await oauthMcpService.generateOAuthTokenFromSAML(samlAssertion);
      console.log(`[Auth] Generated OAuth token for ${username} with ${oauthResult.allowed_tools.length} tools`);
    } catch (error: any) {
      console.warn(`[Auth] OAuth token generation failed (DB schema may be missing): ${error.message}`);
      console.log(`[Auth] Continuing without OAuth token - Archer authentication still successful`);
    }

    // Return session reference WITH OAuth token for MCP access (if available)
    res.json({
      success: true,
      sessionData: {
        sessionId, // Secure session reference instead of token
        expiresAt,
        authMethod, // Include which method was used for debugging
        oauthToken: oauthResult?.oauth_token, // Include OAuth token for MCP tool calls (optional)
        userInfo: {
          username,
          instanceId,
          baseUrl
        }
      }
    });

  } catch (error: any) {
    console.error(`[Auth] Archer authentication error:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Authentication service error',
      details: error.message
    });
  }
});

/**
 * Check session status
 */
router.get('/archer/session/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  try {
    const session = await archerSessionService.getValidSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired'
      });
    }
    
    res.json({
      success: true,
      sessionData: {
        sessionId,
        expiresAt: session.expires_at,
        userInfo: {
          username: session.username,
          instanceId: session.instance_id,
          baseUrl: session.base_url
        }
      }
    });
    
  } catch (error: any) {
    console.error(`[Auth] Session check error:`, error);
    res.status(500).json({
      success: false,
      error: 'Session check failed',
      details: error.message
    });
  }
});

/**
 * Refresh expired session by re-authenticating
 */
router.post('/archer/session/:sessionId/refresh', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      error: 'Password is required for session refresh'
    });
  }
  
  try {
    // Get expired session data first
    const expiredSession = await archerSessionService.getExpiredSessionData(sessionId);
    
    if (!expiredSession) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    console.log(`[Auth] Refreshing session for ${expiredSession.username}@${expiredSession.instance_id}`);
    
    // Re-authenticate with Archer
    const loginData = {
      InstanceName: expiredSession.instance_id,
      Username: expiredSession.username,
      UserDomain: expiredSession.user_domain_id || '1',
      Password: password
    };
    
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
    
    let sessionToken: string | null = null;
    let authMethod = 'REST';
    
    // Try REST API first
    try {
      const loginUrl = `${expiredSession.base_url}/api/core/security/login`;
      console.log(`[Auth Refresh] Attempting REST authentication to: ${loginUrl}`);
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(loginData),
        // @ts-ignore - Node.js fetch supports agent
        agent: expiredSession.base_url.startsWith('https:') ? httpsAgent : undefined
      });
      
      if (response.ok) {
        const authData = await response.json();
        sessionToken = authData.RequestedObject?.SessionToken || authData.SessionToken;
        
        if (sessionToken) {
          console.log(`[Auth Refresh] REST authentication successful for ${expiredSession.username}`);
        }
      } else {
        console.log(`[Auth Refresh] REST authentication failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`[Auth Refresh] REST authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // If REST failed, try SOAP fallback
    if (!sessionToken) {
      console.log(`[Auth Refresh] Attempting SOAP fallback authentication`);
      const soapResult = await authenticateWithSOAP(expiredSession.base_url, loginData, httpsAgent);
      
      if (soapResult.success && soapResult.sessionToken) {
        sessionToken = soapResult.sessionToken;
        authMethod = 'SOAP';
        console.log(`[Auth Refresh] SOAP authentication successful`);
      } else {
        console.error(`[Auth Refresh] Both REST and SOAP authentication failed`);
        return res.status(401).json({
          success: false,
          error: 'Session refresh failed - authentication rejected',
          details: soapResult.error
        });
      }
    }
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Session refresh failed - no session token obtained'
      });
    }
    
    // Update the session with new token and expiration
    const newExpiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes from now
    
    const updated = await archerSessionService.updateSessionToken(sessionId, sessionToken, newExpiresAt);
    
    if (!updated) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update session with new token'
      });
    }
    
    console.log(`[Auth Refresh] Session refreshed successfully for ${expiredSession.username} using ${authMethod}`);
    
    res.json({
      success: true,
      message: 'Session refreshed successfully',
      sessionData: {
        sessionId,
        expiresAt: newExpiresAt,
        authMethod,
        userInfo: {
          username: expiredSession.username,
          instanceId: expiredSession.instance_id,
          baseUrl: expiredSession.base_url
        }
      }
    });
    
  } catch (error: any) {
    console.error(`[Auth Refresh] Session refresh error:`, error);
    res.status(500).json({
      success: false,
      error: 'Session refresh service error',
      details: error.message
    });
  }
});

/**
 * Logout - remove session
 */
router.delete('/archer/session/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  try {
    await archerSessionService.removeSession(sessionId);
    
    res.json({
      success: true,
      message: 'Session removed successfully'
    });
    
  } catch (error: any) {
    console.error(`[Auth] Logout error:`, error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      details: error.message
    });
  }
});

export default router;