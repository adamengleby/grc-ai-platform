/**
 * Secure Credentials API
 * Handles encryption, storage, and management of sensitive credentials
 */

export interface ArcherCredentials {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  instanceId: string;
  userDomainId: string;
  isDefault: boolean;
  created: string;
  lastTested?: string;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  lastError?: string;
}

export interface EncryptedCredentials {
  id: string;
  name: string;
  baseUrl: string;
  encryptedData: string;
  iv: string;
  salt: string;
  isDefault: boolean;
  created: string;
  lastTested?: string;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  lastError?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    responseTime: number;
    version?: string;
    instanceInfo?: any;
  };
  error?: string;
}

class CredentialsManager {
  private readonly STORAGE_KEY_PREFIX = 'grc_encrypted_credentials';
  private readonly SETTINGS_KEY_PREFIX = 'grc_security_settings';
  private encryptionKey: CryptoKey | null = null;
  private tenantId: string | null = null;

  /**
   * Set tenant context for secure partitioning
   */
  setTenantContext(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Get tenant-specific storage key
   */
  private getTenantStorageKey(): string {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }
    return `${this.STORAGE_KEY_PREFIX}_${this.tenantId}`;
  }

  /**
   * Get tenant-specific settings key
   */
  private getTenantSettingsKey(): string {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }
    return `${this.SETTINGS_KEY_PREFIX}_${this.tenantId}`;
  }

  /**
   * Initialize encryption system
   */
  async initialize(): Promise<void> {
    try {
      // Check if Web Crypto API is available
      if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Web Crypto API not available');
      }

      // Generate or retrieve encryption key
      await this.getOrCreateEncryptionKey();
    } catch (error) {
      console.error('Failed to initialize credentials manager:', error);
      throw error;
    }
  }

  /**
   * Generate or retrieve encryption key from secure storage
   */
  private async getOrCreateEncryptionKey(): Promise<CryptoKey> {
    try {
      // In a production environment, this would use a more secure key derivation
      // For demo purposes, we'll use a key derived from user session + device info
      const keyMaterial = await this.deriveKeyMaterial();
      
      this.encryptionKey = await window.crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );

      return this.encryptionKey;
    } catch (error) {
      console.error('Failed to create encryption key:', error);
      throw error;
    }
  }

  /**
   * Derive key material for encryption
   */
  private async deriveKeyMaterial(): Promise<ArrayBuffer> {
    // Create deterministic key material from session info
    // In production, this should use proper key derivation with user password/PIN
    const sessionInfo = this.getSessionInfo();
    const encoder = new TextEncoder();
    const data = encoder.encode(sessionInfo);
    
    // Hash the session info to create key material
    return await window.crypto.subtle.digest('SHA-256', data);
  }

  /**
   * Get session information for key derivation
   */
  private getSessionInfo(): string {
    // In production, this would include user authentication token, device fingerprint, etc.
    const user = localStorage.getItem('auth_user');
    const deviceId = this.getDeviceIdentifier();
    return `${user || 'default'}:${deviceId}:grc-platform-v1`;
  }

  /**
   * Get or generate device identifier
   */
  private getDeviceIdentifier(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Generate unique device identifier
   */
  private generateDeviceId(): string {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Encrypt credentials
   */
  async encryptCredentials(credentials: ArcherCredentials): Promise<EncryptedCredentials> {
    if (!this.encryptionKey) {
      await this.initialize();
    }

    try {
      // Prepare sensitive data for encryption
      const sensitiveData = {
        username: credentials.username,
        password: credentials.password,
        instanceId: credentials.instanceId,
        userDomainId: credentials.userDomainId
      };

      // Generate random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Generate random salt
      const salt = window.crypto.getRandomValues(new Uint8Array(16));

      // Encrypt the sensitive data
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(sensitiveData));
      
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey!,
        dataBuffer
      );

      // Convert to base64 for storage
      const encryptedData = this.arrayBufferToBase64(encryptedBuffer);
      const ivBase64 = this.arrayBufferToBase64(iv.buffer);
      const saltBase64 = this.arrayBufferToBase64(salt.buffer);

      return {
        id: credentials.id,
        name: credentials.name,
        baseUrl: credentials.baseUrl,
        encryptedData,
        iv: ivBase64,
        salt: saltBase64,
        isDefault: credentials.isDefault,
        created: credentials.created,
        lastTested: credentials.lastTested,
        status: credentials.status,
        lastError: credentials.lastError
      };
    } catch (error) {
      console.error('Failed to encrypt credentials:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt credentials
   */
  async decryptCredentials(encrypted: EncryptedCredentials): Promise<ArcherCredentials> {
    if (!this.encryptionKey) {
      await this.initialize();
    }

    try {
      // Convert from base64
      const encryptedBuffer = this.base64ToArrayBuffer(encrypted.encryptedData);
      const iv = this.base64ToArrayBuffer(encrypted.iv);

      // Decrypt the data
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey!,
        encryptedBuffer
      );

      // Parse decrypted data
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedBuffer);
      const sensitiveData = JSON.parse(decryptedText);

      return {
        id: encrypted.id,
        name: encrypted.name,
        baseUrl: encrypted.baseUrl,
        username: sensitiveData.username,
        password: sensitiveData.password,
        instanceId: sensitiveData.instanceId,
        userDomainId: sensitiveData.userDomainId,
        isDefault: encrypted.isDefault,
        created: encrypted.created,
        lastTested: encrypted.lastTested,
        status: encrypted.status,
        lastError: encrypted.lastError
      };
    } catch (error) {
      console.error('Failed to decrypt credentials:', error);
      throw new Error('Decryption failed - credentials may be corrupted');
    }
  }

  /**
   * Store encrypted credentials
   */
  async storeCredentials(credentials: ArcherCredentials[]): Promise<void> {
    try {
      const encryptedCredentials = await Promise.all(
        credentials.map(cred => this.encryptCredentials(cred))
      );

      localStorage.setItem(this.getTenantStorageKey(), JSON.stringify(encryptedCredentials));
    } catch (error) {
      console.error('Failed to store credentials:', error);
      throw error;
    }
  }

  /**
   * Load and decrypt credentials
   */
  async loadCredentials(): Promise<ArcherCredentials[]> {
    try {
      const stored = localStorage.getItem(this.getTenantStorageKey());
      if (!stored) {
        return [];
      }

      const encryptedCredentials: EncryptedCredentials[] = JSON.parse(stored);
      return await Promise.all(
        encryptedCredentials.map(enc => this.decryptCredentials(enc))
      );
    } catch (error) {
      console.error('Failed to load credentials:', error);
      // If decryption fails, return empty array and clear corrupted data
      localStorage.removeItem(this.getTenantStorageKey());
      return [];
    }
  }

  /**
   * Test connection to Archer instance
   */
  async testConnection(credentials: ArcherCredentials): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      // For demo purposes, simulate connection test
      // In production, this would make actual API calls to Archer
      console.log(`Testing connection to ${credentials.baseUrl}...`);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Simulate validation logic
      const isValid = this.validateCredentials(credentials);
      const responseTime = Date.now() - startTime;

      if (!isValid) {
        return {
          success: false,
          message: 'Authentication failed',
          error: 'Invalid credentials or server unreachable',
          details: { responseTime }
        };
      }

      // Simulate random success/failure for demo
      const success = Math.random() > 0.2; // 80% success rate

      if (success) {
        return {
          success: true,
          message: 'Connection successful',
          details: {
            responseTime,
            version: '6.10.0.1',
            instanceInfo: {
              instanceId: credentials.instanceId,
              userDomain: credentials.userDomainId
            }
          }
        };
      } else {
        return {
          success: false,
          message: 'Connection failed',
          error: 'Server timeout or configuration error',
          details: { responseTime }
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: { responseTime: Date.now() - startTime }
      };
    }
  }

  /**
   * Validate credential format and requirements
   */
  private validateCredentials(credentials: ArcherCredentials): boolean {
    if (!credentials.baseUrl || !credentials.username || !credentials.password) {
      return false;
    }

    // Basic URL validation
    try {
      new URL(credentials.baseUrl);
    } catch {
      return false;
    }

    // Check required fields
    if (!credentials.instanceId || !credentials.userDomainId) {
      return false;
    }

    return true;
  }

  /**
   * Get security settings
   */
  getSecuritySettings(): { encryptionEnabled: boolean; lastKeyRotation?: string } {
    const stored = localStorage.getItem(this.getTenantSettingsKey());
    if (stored) {
      return JSON.parse(stored);
    }
    return { encryptionEnabled: true };
  }

  /**
   * Update security settings
   */
  updateSecuritySettings(settings: { encryptionEnabled: boolean }): void {
    const currentSettings = this.getSecuritySettings();
    const updatedSettings = {
      ...currentSettings,
      ...settings,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(this.getTenantSettingsKey(), JSON.stringify(updatedSettings));
  }

  /**
   * Clear all stored credentials (for logout/reset)
   */
  clearAllCredentials(): void {
    if (this.tenantId) {
      localStorage.removeItem(this.getTenantStorageKey());
      localStorage.removeItem(this.getTenantSettingsKey());
    }
    this.encryptionKey = null;
    this.tenantId = null;
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return buffer;
  }
}

// Export singleton instance
export const credentialsManager = new CredentialsManager();

/**
 * Convenience function to get all credentials for the current tenant
 */
export async function getAllCredentials(): Promise<ArcherCredentials[]> {
  try {
    return await credentialsManager.loadCredentials();
  } catch (error) {
    console.error('Error loading credentials:', error);
    return [];
  }
}

// Export types and utilities
export default credentialsManager;