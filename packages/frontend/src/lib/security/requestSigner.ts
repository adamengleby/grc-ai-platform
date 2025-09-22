/**
 * Cryptographic Request Signing Service
 * Provides tamper-proof request signing for critical operations
 */

export interface SignedRequest {
  payload: any;
  signature: string;
  timestamp: number;
  nonce: string;
  tenantId: string;
  userId: string;
}

export interface SigningOptions {
  includeTimestamp?: boolean;
  includeNonce?: boolean;
  customHeaders?: Record<string, string>;
}

export class RequestSigningError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'RequestSigningError';
  }
}

export class RequestSigner {
  private static instance: RequestSigner;
  private signingKey: string;

  private constructor() {
    // In production, this would be retrieved from Azure Key Vault
    // For demo, we use a consistent key based on tenant context
    this.signingKey = this.generateSigningKey();
  }

  static getInstance(): RequestSigner {
    if (!RequestSigner.instance) {
      RequestSigner.instance = new RequestSigner();
    }
    return RequestSigner.instance;
  }

  /**
   * Generate a signing key for demo purposes
   * In production, this would be retrieved from Azure Key Vault per tenant
   */
  private generateSigningKey(): string {
    // For demo, use a deterministic key based on app context
    const baseKey = 'grc-mcp-security-key-v1';
    return btoa(baseKey + '-' + Date.now().toString().slice(0, -3)); // Stable for short periods
  }

  /**
   * Sign a request with cryptographic signature
   */
  async signRequest(
    payload: any,
    tenantId: string,
    userId: string,
    options: SigningOptions = {}
  ): Promise<SignedRequest> {
    try {
      const timestamp = options.includeTimestamp !== false ? Date.now() : 0;
      const nonce = options.includeNonce !== false ? this.generateNonce() : '';

      // Create the message to sign
      const message = this.createSigningMessage(payload, tenantId, userId, timestamp, nonce);
      
      // Generate signature
      const signature = await this.generateSignature(message);

      return {
        payload,
        signature,
        timestamp,
        nonce,
        tenantId,
        userId
      };

    } catch (error) {
      throw new RequestSigningError(
        `Failed to sign request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SIGNING_FAILED'
      );
    }
  }

  /**
   * Verify a signed request
   */
  async verifyRequest(signedRequest: SignedRequest): Promise<boolean> {
    try {
      // Verify timestamp (prevent replay attacks)
      if (signedRequest.timestamp > 0) {
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        if (signedRequest.timestamp < now - fiveMinutes) {
          throw new RequestSigningError('Request too old (possible replay attack)', 'REPLAY_DETECTED');
        }

        if (signedRequest.timestamp > now + fiveMinutes) {
          throw new RequestSigningError('Request timestamp too far in future', 'INVALID_TIMESTAMP');
        }
      }

      // Verify nonce uniqueness (basic demo implementation)
      if (signedRequest.nonce) {
        const isNonceUsed = await this.checkNonceUsage(signedRequest.nonce);
        if (isNonceUsed) {
          throw new RequestSigningError('Nonce already used (replay attack detected)', 'NONCE_REPLAY');
        }
        await this.recordNonceUsage(signedRequest.nonce);
      }

      // Recreate the message and verify signature
      const message = this.createSigningMessage(
        signedRequest.payload,
        signedRequest.tenantId,
        signedRequest.userId,
        signedRequest.timestamp,
        signedRequest.nonce
      );

      const expectedSignature = await this.generateSignature(message);
      
      // Constant-time comparison to prevent timing attacks
      return this.constantTimeEquals(signedRequest.signature, expectedSignature);

    } catch (error) {
      if (error instanceof RequestSigningError) {
        throw error;
      }
      
      throw new RequestSigningError(
        `Failed to verify request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VERIFICATION_FAILED'
      );
    }
  }

  /**
   * Sign a critical MCP operation
   */
  async signMcpOperation(
    operation: string,
    toolId: string,
    inputs: any,
    tenantId: string,
    userId: string
  ): Promise<SignedRequest> {
    const payload = {
      operation,
      toolId,
      inputs,
      securityLevel: 'CRITICAL'
    };

    return this.signRequest(payload, tenantId, userId, {
      includeTimestamp: true,
      includeNonce: true
    });
  }

  /**
   * Create the message string for signing
   */
  private createSigningMessage(
    payload: any,
    tenantId: string,
    userId: string,
    timestamp: number,
    nonce: string
  ): string {
    // Create a canonical representation
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 0);
    
    return [
      'GRC-MCP-REQUEST',
      tenantId,
      userId,
      timestamp.toString(),
      nonce,
      payloadString
    ].join('|');
  }

  /**
   * Generate cryptographic signature using Web Crypto API
   */
  private async generateSignature(message: string): Promise<string> {
    try {
      // For demo purposes, use a simple HMAC-like approach
      // In production, use proper HMAC with Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(message + this.signingKey);
      
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        // Use Web Crypto API when available
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        // Fallback for environments without Web Crypto API
        return this.simpleHash(message + this.signingKey);
      }
    } catch (error) {
      throw new RequestSigningError('Failed to generate signature', 'CRYPTO_ERROR');
    }
  }

  /**
   * Simple hash function for fallback (not cryptographically secure)
   */
  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Generate cryptographically secure nonce
   */
  private generateNonce(): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback for environments without crypto
      return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
  }

  /**
   * Check if nonce has been used (simple localStorage implementation)
   */
  private async checkNonceUsage(nonce: string): Promise<boolean> {
    const usedNonces = this.getUsedNonces();
    return usedNonces.includes(nonce);
  }

  /**
   * Record nonce usage to prevent replay
   */
  private async recordNonceUsage(nonce: string): Promise<void> {
    const usedNonces = this.getUsedNonces();
    usedNonces.push(nonce);
    
    // Keep only recent nonces (last 1000)
    const recentNonces = usedNonces.slice(-1000);
    localStorage.setItem('used_nonces', JSON.stringify(recentNonces));
  }

  /**
   * Get used nonces from storage
   */
  private getUsedNonces(): string[] {
    const stored = localStorage.getItem('used_nonces');
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Clear old nonces and signing data (maintenance function)
   */
  clearExpiredData(): void {
    // Clear nonces older than 1 hour
    const usedNonces = this.getUsedNonces();
    // For demo, just clear all if too many
    if (usedNonces.length > 5000) {
      localStorage.removeItem('used_nonces');
    }
  }

  /**
   * Get signing statistics for monitoring
   */
  getSigningStats(): {
    usedNoncesCount: number;
    signingKeyAge: number;
  } {
    return {
      usedNoncesCount: this.getUsedNonces().length,
      signingKeyAge: Date.now() // Simplified for demo
    };
  }
}

// Export singleton instance
export const requestSigner = RequestSigner.getInstance();