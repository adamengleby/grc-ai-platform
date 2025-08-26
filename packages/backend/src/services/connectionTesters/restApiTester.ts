/**
 * REST API Connection Tester
 * Tests REST API connectivity and authentication
 */
export interface RestApiCredentials {
  baseUrl: string;
  authType?: 'none' | 'apikey' | 'bearer' | 'basic';
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTime: number;
  details?: {
    statusCode?: number;
    headers?: Record<string, string>;
    apiInfo?: any;
  };
  error?: string;
}

export class RestApiConnectionTester {
  private readonly timeout = 10000; // 10 seconds

  /**
   * Test REST API connection
   */
  async testConnection(credentials: RestApiCredentials): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[REST API Tester] Testing connection to: ${credentials.baseUrl}`);
      console.log(`[REST API Tester] Auth type: ${credentials.authType || 'none'}`);

      // Prepare headers based on auth type
      const headers = this.buildAuthHeaders(credentials);
      
      // Try to reach the API endpoint
      const testUrl = credentials.baseUrl.replace(/\/$/, '') + '/';
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.timeout)
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        return {
          success: true,
          message: 'REST API connection successful',
          responseTime,
          details: {
            statusCode: response.status,
            headers: responseHeaders,
            apiInfo: {
              url: testUrl,
              authType: credentials.authType || 'none'
            }
          }
        };
      } else {
        return {
          success: false,
          message: `API returned ${response.status} ${response.statusText}`,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (error instanceof Error && error.name === 'TimeoutError') {
        return {
          success: false,
          message: 'Connection timeout',
          responseTime,
          error: 'API server not responding within timeout period'
        };
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[REST API Tester] Connection test failed:', error);
      
      return {
        success: false,
        message: 'REST API connection failed',
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Build authentication headers based on auth type
   */
  private buildAuthHeaders(credentials: RestApiCredentials): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'GRC-Platform-Connection-Test/1.0',
      'Accept': 'application/json'
    };

    switch (credentials.authType) {
      case 'apikey':
        if (credentials.apiKey) {
          headers['X-API-Key'] = credentials.apiKey;
        }
        break;
        
      case 'bearer':
        if (credentials.bearerToken) {
          headers['Authorization'] = `Bearer ${credentials.bearerToken}`;
        }
        break;
        
      case 'basic':
        if (credentials.username && credentials.password) {
          const basicAuth = btoa(`${credentials.username}:${credentials.password}`);
          headers['Authorization'] = `Basic ${basicAuth}`;
        }
        break;
        
      case 'none':
      default:
        // No authentication headers needed
        break;
    }

    return headers;
  }
}