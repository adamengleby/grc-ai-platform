#!/usr/bin/env node
/**
 * Privacy Protector Module for Archer MCP Server
 * Provides data masking, tokenization, and anonymization capabilities
 * to protect sensitive information before sending to LLMs
 */
export interface PrivacyConfig {
    enableMasking: boolean;
    maskingLevel: 'light' | 'moderate' | 'strict';
    preserveStructure: boolean;
    enableTokenization: boolean;
    customSensitiveFields: string[];
    whitelistedFields: string[];
}
export declare class PrivacyProtector {
    private tokenStore;
    private config;
    private readonly SENSITIVE_PATTERNS;
    private readonly SENSITIVE_FIELD_NAMES;
    constructor(config?: Partial<PrivacyConfig>);
    /**
     * Main method to protect data before sending to LLM
     */
    protectData(data: any, context?: string): any;
    /**
     * Protect a single record/object
     */
    private protectSingleRecord;
    /**
     * Check if a field name indicates sensitive data
     */
    private isSensitiveField;
    /**
     * Enhanced name detection - checks if a value looks like a person's name
     */
    private looksLikeName;
    /**
     * Protect string content by detecting and masking sensitive patterns
     */
    private protectStringContent;
    /**
     * Protect a specific value based on masking level
     */
    private protectValue;
    /**
     * Mask a value based on the configured masking level
     */
    private maskValue;
    /**
     * Generate a type hint for masked values
     */
    private getTypeHint;
    /**
     * Tokenize a value for reversible masking
     */
    private tokenizeValue;
    /**
     * Reverse tokenization (if enabled and token exists)
     */
    detokenizeValue(token: string): any;
    /**
     * Clear old tokens to prevent memory leaks
     */
    clearExpiredTokens(maxAgeMs?: number): void;
    /**
     * Get statistics about current protection activities
     */
    getProtectionStats(): {
        activeTokens: number;
        maskingEnabled: boolean;
        maskingLevel: string;
        tokenizationEnabled: boolean;
    };
    /**
     * Update configuration at runtime
     */
    updateConfig(newConfig: Partial<PrivacyConfig>): void;
    /**
     * Special method for protecting authentication responses
     */
    protectAuthData(authResponse: any): any;
    /**
     * Protect error responses that might contain sensitive info
     */
    protectErrorData(error: any): any;
}
export declare const defaultPrivacyProtector: PrivacyProtector;
//# sourceMappingURL=privacy-protector.d.ts.map