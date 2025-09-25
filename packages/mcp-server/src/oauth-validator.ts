/**
 * OAuth Token Validator for MCP Tool Access Control
 * Validates OAuth tokens by calling the backend validation API
 */

export interface OAuthValidationResult {
  valid: boolean;
  user?: string;
  tenant_id?: string;
  allowed_tools?: Array<{
    server_id: string;
    tool_name: string;
    allowed_scopes: string[];
  }>;
  groups?: string[];
}

export class OAuthValidator {
  private backendUrl: string;

  constructor(backendUrl = 'http://localhost:3005') {
    this.backendUrl = backendUrl;
  }

  /**
   * Validate OAuth token and get allowed tools
   */
  async validateToken(token: string): Promise<OAuthValidationResult> {
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/mcp-tool-access/oauth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        console.log(`[OAuth Validator] Token validation failed: HTTP ${response.status}`);
        return { valid: false };
      }

      const data = await response.json() as any;
      return data.data || { valid: false };

    } catch (error) {
      console.log(`[OAuth Validator] Token validation error: ${(error as Error).message}`);
      return { valid: false };
    }
  }

  /**
   * Check if user has permission for a specific tool
   */
  async hasToolPermission(token: string, serverId: string, toolName: string, scope = 'read'): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/mcp-tool-access/oauth/check-permission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token, 
          server_id: serverId, 
          tool_name: toolName, 
          scope 
        }),
      });

      if (!response.ok) {
        console.log(`[OAuth Validator] Permission check failed: HTTP ${response.status}`);
        return false;
      }

      const data = await response.json() as any;
      return data.data?.has_permission || false;

    } catch (error) {
      console.log(`[OAuth Validator] Permission check error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Extract OAuth token from MCP request arguments
   * Looks for token in multiple possible locations
   */
  extractTokenFromArgs(args: any): string | null {
    // Check common token locations
    if (args.oauth_token || args.oauthToken) {
      return args.oauth_token || args.oauthToken;
    }

    if (args.token) {
      return args.token;
    }

    if (args.auth && args.auth.token) {
      return args.auth.token;
    }

    if (args.headers && args.headers.authorization) {
      const auth = args.headers.authorization;
      if (auth.startsWith('Bearer ')) {
        return auth.substring(7);
      }
    }

    return null;
  }
}

// Export singleton instance
export const oauthValidator = new OAuthValidator();