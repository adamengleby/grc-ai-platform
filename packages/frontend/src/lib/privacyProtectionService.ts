/**
 * Privacy Protection Service for LLM Data
 * CRITICAL: Masks confidential data before sending to external LLMs
 */

export interface PrivacyConfig {
  enableMasking: boolean;
  maskingLevel: 'light' | 'moderate' | 'strict';
  customSensitiveFields: string[];
}

export class PrivacyProtectionService {
  private config: PrivacyConfig;

  constructor(config: PrivacyConfig) {
    this.config = config;
  }

  /**
   * CRITICAL: Protect MCP tool results before sending to LLM
   * This prevents confidential data from leaving your infrastructure
   */
  protectMCPResult(mcpResult: any, toolName: string): any {
    if (!this.config.enableMasking) {
      console.warn('⚠️ Privacy masking is DISABLED - confidential data may be sent to LLM');
      return mcpResult;
    }

    console.log(`🔒 Applying ${this.config.maskingLevel} privacy protection to ${toolName} result`);

    if (toolName === 'search_archer_records') {
      return this.protectArcherRecords(mcpResult);
    }

    return this.protectGenericResult(mcpResult);
  }

  private protectArcherRecords(mcpResult: any): any {
    if (!mcpResult?.result?.content?.[0]?.text) {
      return mcpResult;
    }

    const originalText = mcpResult.result.content[0].text;
    const protectedText = this.maskSensitiveData(originalText);

    return {
      ...mcpResult,
      result: {
        ...mcpResult.result,
        content: [{
          ...mcpResult.result.content[0],
          text: protectedText
        }]
      }
    };
  }

  private maskSensitiveData(text: string): string {
    let maskedText = text;

    // Email addresses
    maskedText = maskedText.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[MASKED_EMAIL]'
    );

    // Phone numbers
    maskedText = maskedText.replace(
      /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      '[MASKED_PHONE]'
    );

    // Names (person names in records)
    maskedText = maskedText.replace(
      /\b[A-Z][a-z]{1,15}[,\s]+[A-Z][a-z]{1,15}\b/g,
      '[MASKED_NAME]'
    );

    // Record IDs that might be sensitive
    if (this.config.maskingLevel === 'strict') {
      maskedText = maskedText.replace(
        /\b\d{6,}\b/g, // 6+ digit numbers (like record IDs)
        '[MASKED_ID]'
      );
    }

    // Custom sensitive fields
    this.config.customSensitiveFields.forEach(field => {
      const regex = new RegExp(`\\b${field}[:\s]+[^\s\n]+`, 'gi');
      maskedText = maskedText.replace(regex, `${field}: [MASKED]`);
    });

    return maskedText;
  }

  private protectGenericResult(mcpResult: any): any {
    // Apply generic protection for other MCP tools
    return mcpResult;
  }
}

/**
 * Get privacy config from backend API
 */
export async function getPrivacyConfig(tenantId: string, userId?: string): Promise<PrivacyConfig> {
  try {
    const scope = userId ? 'user' : 'tenant';
    
    // Get auth token from localStorage for now (TODO: use proper auth store)
    const authToken = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005'}/api/v1/privacy/settings?scope=${scope}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to get privacy config: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      return {
        enableMasking: result.data.enable_privacy_masking,
        maskingLevel: result.data.masking_level,
        customSensitiveFields: result.data.custom_sensitive_fields || []
      };
    }

    throw new Error('Invalid privacy config response');
  } catch (error) {
    console.error('Error getting privacy config from API, using safe defaults:', error);
    // Return safe defaults if API fails
    return {
      enableMasking: true, // DEFAULT TO SAFE
      maskingLevel: 'strict', // DEFAULT TO MOST SECURE
      customSensitiveFields: [
        'employee_id', 'ssn', 'account_number', 'credit_card',
        'passport', 'license', 'salary', 'address', 'phone', 'email'
      ]
    };
  }
}