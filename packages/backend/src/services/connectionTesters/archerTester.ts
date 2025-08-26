/**
 * Archer GRC Connection Tester
 * Tests actual authentication and session establishment with Archer GRC platform
 */
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
        console.log(`[Archer Tester] Authentication successful - Session ID: ${authResult.sessionId?.substring(0, 10)}...`);
        
        return {
          success: true,
          message: 'Archer authentication successful - Session established',
          responseTime,
          details: {
            sessionId: authResult.sessionId,
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
   * Authenticate with Archer using the actual REST API endpoint from the MCP server
   */
  private async authenticateAndGetSession(credentials: ArcherCredentials): Promise<{
    success: boolean;
    sessionId?: string;
    userInfo?: any;
    version?: string;
    error?: string;
  }> {
    try {
      // Use the actual Archer REST API authentication endpoint from MCP server implementation
      const authEndpoint = `${credentials.baseUrl.replace(/\/$/, '')}/api/core/security/login`;
      
      const loginData = {
        InstanceName: credentials.instanceId,
        Username: credentials.username,
        UserDomain: credentials.userDomainId || '',
        Password: credentials.password
      };

      console.log(`[Archer Tester] Attempting authentication to: ${authEndpoint}`);
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
        
        console.log(`[Archer Tester] Authentication response:`, {
          IsSuccessful: jsonResponse.IsSuccessful,
          hasSessionToken: !!jsonResponse.RequestedObject?.SessionToken
        });

        if (jsonResponse.IsSuccessful && jsonResponse.RequestedObject?.SessionToken) {
          return {
            success: true,
            sessionId: jsonResponse.RequestedObject.SessionToken,
            userInfo: {
              userName: credentials.username,
              userDomain: credentials.userDomainId || ''
            },
            version: 'Archer 6.x'
          };
        } else {
          const errorMessage = jsonResponse.ValidationMessages?.[0] || 
                              jsonResponse.RequestedObject?.ValidationMessages?.[0] || 
                              'Authentication failed - Invalid credentials';
          return {
            success: false,
            error: errorMessage
          };
        }
      } else {
        const errorText = await response.text();
        return {
          success: false,
          error: `Authentication failed (HTTP ${response.status}): ${errorText.substring(0, 200)}`
        };
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return { success: false, error: 'Authentication timeout - Archer server not responding' };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication request failed'
      };
    }
  }

}