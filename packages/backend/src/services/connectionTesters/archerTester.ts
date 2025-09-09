/**
 * Archer GRC Connection Tester
 * Tests actual authentication and session establishment with Archer GRC platform
 */

/**
 * SOAP authentication fallback for Archer Web Services API
 */
async function authenticateWithSOAP(baseUrl: string, loginData: any, timeout: number): Promise<{
  success: boolean;
  sessionId?: string;
  error?: string;
}> {
  try {
    const soapEndpoint = `${baseUrl.replace(/\/$/, '')}/ws/general.asmx`;
    
    // Build SOAP envelope
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

    const response = await fetch(soapEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://archer-tech.com/webservices/CreateDomainUserSessionFromInstance'
      },
      body: soapEnvelope,
      signal: AbortSignal.timeout(timeout)
    });

    if (!response.ok) {
      return {
        success: false,
        error: `SOAP authentication failed (HTTP ${response.status}): ${response.statusText}`
      };
    }

    const soapResponse = await response.text();

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
      return {
        success: true,
        sessionId: sessionToken
      };
    } else {
      return {
        success: false,
        error: 'SOAP authentication failed: Empty session token returned'
      };
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { success: false, error: 'SOAP authentication timeout - Archer server not responding' };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SOAP authentication request failed'
    };
  }
}
export interface ArcherCredentials {
  baseUrl: string;
  username: string;
  password: string;
  instanceId: string;
  userDomainId?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTime: number;
  details?: {
    sessionId?: string;
    userInfo?: any;
    instanceInfo?: any;
    version?: string;
  };
  error?: string;
}

export class ArcherConnectionTester {
  private readonly timeout = 15000; // 15 seconds

  /**
   * Test Archer GRC connection by attempting authentication
   * @param credentials Archer connection parameters
   */
  async testConnection(credentials: ArcherCredentials): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Archer Tester] Testing connection to: ${credentials.baseUrl}`);
      console.log(`[Archer Tester] Instance: ${credentials.instanceId}, User Domain: ${credentials.userDomainId || '1'}`);

      // Step 1: Test basic connectivity to Archer platform
      const connectivityTest = await this.testConnectivity(credentials.baseUrl);
      if (!connectivityTest.success) {
        return {
          success: false,
          message: 'Failed to reach Archer platform',
          responseTime: Date.now() - startTime,
          error: connectivityTest.error
        };
      }

      // Step 2: Attempt authentication and get session
      const authResult = await this.authenticateAndGetSession(credentials);
      
      const responseTime = Date.now() - startTime;
      
      if (authResult.success) {
        console.log(`[Archer Tester] Authentication successful using ${authResult.authMethod} - Session ID: ${authResult.sessionId?.substring(0, 10)}...`);
        
        return {
          success: true,
          message: `Archer authentication successful using ${authResult.authMethod} - Session established`,
          responseTime,
          details: {
            sessionId: authResult.sessionId,
            authMethod: authResult.authMethod,
            userInfo: authResult.userInfo,
            instanceInfo: {
              instanceId: credentials.instanceId,
              userDomainId: credentials.userDomainId || '1',
              baseUrl: credentials.baseUrl
            },
            version: authResult.version || 'Unknown'
          }
        };
      } else {
        return {
          success: false,
          message: authResult.error || 'Authentication failed',
          responseTime,
          error: authResult.error
        };
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('[Archer Tester] Connection test failed:', error);
      
      return {
        success: false,
        message: 'Connection test failed',
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Test basic connectivity to Archer platform
   */
  private async testConnectivity(baseUrl: string): Promise<{success: boolean, error?: string}> {
    try {
      // Try to reach the Archer platform root or health endpoint
      const testUrl = `${baseUrl.replace(/\/$/, '')}/`;
      
      console.log(`[Archer Tester] Testing connectivity to: ${testUrl}`);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'GRC-Platform-Connection-Test/1.0'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.status === 200 || response.status === 302 || response.status === 401) {
        // 200 = OK, 302 = Redirect (expected for Archer), 401 = Unauthorized but server is responding
        console.log(`[Archer Tester] Connectivity test passed (HTTP ${response.status})`);
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return { success: false, error: 'Connection timeout - Archer server not responding' };
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network connectivity failed' 
      };
    }
  }

  /**
   * Authenticate with Archer using REST API first, then SOAP fallback
   */
  private async authenticateAndGetSession(credentials: ArcherCredentials): Promise<{
    success: boolean;
    sessionId?: string;
    userInfo?: any;
    version?: string;
    error?: string;
    authMethod?: string;
  }> {
    const loginData = {
      InstanceName: credentials.instanceId,
      Username: credentials.username,
      UserDomain: credentials.userDomainId || '',
      Password: credentials.password
    };

    let sessionId: string | null = null;
    let authMethod = 'REST';

    // Try REST API first
    try {
      const authEndpoint = `${credentials.baseUrl.replace(/\/$/, '')}/api/core/security/login`;
      
      console.log(`[Archer Tester] Attempting REST authentication to: ${authEndpoint}`);
      console.log(`[Archer Tester] Login data:`, {
        InstanceName: credentials.instanceId,
        Username: credentials.username,
        UserDomain: credentials.userDomainId || ''
        // Password not logged for security
      });

      const response = await fetch(authEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'GRC-Platform-Connection-Test/1.0'
        },
        body: JSON.stringify(loginData),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.ok) {
        const jsonResponse = await response.json();
        
        console.log(`[Archer Tester] REST authentication response:`, {
          IsSuccessful: jsonResponse.IsSuccessful,
          hasSessionToken: !!jsonResponse.RequestedObject?.SessionToken
        });

        if (jsonResponse.IsSuccessful && jsonResponse.RequestedObject?.SessionToken) {
          sessionId = jsonResponse.RequestedObject.SessionToken;
          console.log(`[Archer Tester] REST authentication successful`);
        } else {
          console.log(`[Archer Tester] REST authentication failed - no session token in response`);
        }
      } else {
        console.log(`[Archer Tester] REST authentication failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`[Archer Tester] REST authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // If REST failed, try SOAP fallback
    if (!sessionId) {
      console.log(`[Archer Tester] Attempting SOAP fallback authentication`);
      
      const soapResult = await authenticateWithSOAP(credentials.baseUrl, loginData, this.timeout);
      
      if (soapResult.success && soapResult.sessionId) {
        sessionId = soapResult.sessionId;
        authMethod = 'SOAP';
        console.log(`[Archer Tester] SOAP fallback authentication successful`);
      } else {
        console.error(`[Archer Tester] Both REST and SOAP authentication failed`);
        console.error(`[Archer Tester] SOAP error: ${soapResult.error}`);
        
        return {
          success: false,
          error: `Both REST and SOAP authentication failed. SOAP error: ${soapResult.error}`
        };
      }
    }

    // Return successful result
    if (sessionId) {
      return {
        success: true,
        sessionId,
        authMethod,
        userInfo: {
          userName: credentials.username,
          userDomain: credentials.userDomainId || ''
        },
        version: 'Archer 6.x'
      };
    }

    return {
      success: false,
      error: 'Authentication failed - no session token obtained from either REST or SOAP'
    };
  }

}