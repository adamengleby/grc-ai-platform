#!/usr/bin/env node
/**
 * Privacy Protector Module for Archer MCP Server
 * Provides data masking, tokenization, and anonymization capabilities
 * to protect sensitive information before sending to LLMs
 */
import crypto from 'crypto';
export class PrivacyProtector {
    tokenStore = new Map();
    config;
    // private _encryptionKey: Buffer; // Reserved for future encryption features
    // Common patterns for sensitive data detection
    SENSITIVE_PATTERNS = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
        guid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
        accountNumber: /\b\d{8,20}\b/g,
        // Name patterns - detect common name formats
        fullName: /\b[A-Z][a-z]{1,15}[,\s]+[A-Z][a-z]{1,15}\b/g, // "Smith, John" or "John Smith"
        nameWithInitial: /\b[A-Z][a-z]{1,15}[,\s]+[A-Z]\.?\s*[A-Z][a-z]{1,15}\b/g, // "Smith, J. John" 
        lastNameFirst: /\b[A-Z][a-z]{1,15},\s*[A-Z][a-z]{1,15}\b/g // "Smith, John"
    };
    // Field names that commonly contain sensitive data
    SENSITIVE_FIELD_NAMES = [
        'password', 'passwd', 'pwd', 'secret', 'token', 'key', 'api_key',
        'ssn', 'social_security', 'tax_id', 'ein', 'sin',
        'email', 'email_address', 'e_mail', 'mail',
        'phone', 'telephone', 'mobile', 'cell',
        'address', 'street', 'city', 'zipcode', 'postal',
        'name', 'first_name', 'last_name', 'full_name', 'surname', 'given_name',
        'owner', 'manager', 'contact', 'person', 'employee', 'user', 'author', 'creator',
        'assignee', 'responsible', 'coordinator', 'lead', 'representative',
        'birth_date', 'dob', 'birthday', 'date_of_birth',
        'account', 'account_number', 'account_id', 'customer_id',
        'credit_card', 'card_number', 'ccn', 'pan',
        'salary', 'wage', 'income', 'compensation',
        'bank', 'routing', 'iban', 'swift', 'bic',
        'ip_address', 'ip', 'host', 'hostname', 'domain',
        'license', 'license_number', 'driver_license', 'dl_number',
        'passport', 'passport_number', 'visa', 'visa_number'
    ];
    constructor(config = {}) {
        this.config = {
            enableMasking: true,
            maskingLevel: 'moderate',
            preserveStructure: true,
            enableTokenization: false,
            customSensitiveFields: [],
            whitelistedFields: [
                'id', 'type', 'status', 'created_date', 'modified_date',
                // Risk assessment fields - critical for risk analysis
                'risk_score', 'risk_rating', 'risk_level', 'severity', 'severity_level',
                'impact', 'impact_score', 'impact_level', 'likelihood', 'likelihood_score',
                'probability', 'inherent_risk', 'residual_risk', 'risk_category',
                'priority', 'criticality', 'exposure', 'threat_level',
                // Financial risk fields
                'actual_annualized_loss_amount', 'estimated_loss', 'potential_loss',
                'financial_impact', 'loss_expectancy',
                // Status and classification fields
                'active', 'is_active', 'record_status', 'state', 'classification',
                'risk_classification', 'risk_type', 'control_effectiveness'
            ],
            ...config
        };
        // Generate or load encryption key for tokenization (reserved for future use)
        // this._encryptionKey = crypto.scryptSync(
        //   process.env.PRIVACY_KEY || 'default-privacy-key-change-me',
        //   'salt',
        //   32
        // );
    }
    /**
     * Main method to protect data before sending to LLM
     */
    protectData(data, context) {
        if (!this.config.enableMasking) {
            return data;
        }
        if (Array.isArray(data)) {
            return data.map(item => this.protectSingleRecord(item, context));
        }
        else if (typeof data === 'object' && data !== null) {
            return this.protectSingleRecord(data, context);
        }
        return this.protectValue(data, 'unknown', context);
    }
    /**
     * Protect a single record/object
     */
    protectSingleRecord(record, context) {
        if (!record || typeof record !== 'object') {
            return record;
        }
        const protectedRecord = {};
        for (const [key, value] of Object.entries(record)) {
            const lowerKey = key.toLowerCase();
            // Skip whitelisted fields
            if (this.config.whitelistedFields.includes(lowerKey)) {
                protectedRecord[key] = value;
                continue;
            }
            // Check if field is sensitive
            if (this.isSensitiveField(key)) {
                protectedRecord[key] = this.protectValue(value, key, context);
            }
            else if (typeof value === 'object' && value !== null) {
                // Recursively protect nested objects
                protectedRecord[key] = this.protectData(value, `${context || ''}.${key}`);
            }
            else if (typeof value === 'string') {
                // Check string content for sensitive patterns
                protectedRecord[key] = this.protectStringContent(value, key);
            }
            else {
                protectedRecord[key] = value;
            }
        }
        return protectedRecord;
    }
    /**
     * Check if a field name indicates sensitive data
     */
    isSensitiveField(fieldName) {
        const lowerName = fieldName.toLowerCase();
        // Check custom sensitive fields
        if (this.config.customSensitiveFields.some(field => lowerName.includes(field.toLowerCase()))) {
            return true;
        }
        // Check standard sensitive field names
        return this.SENSITIVE_FIELD_NAMES.some(sensitiveField => lowerName.includes(sensitiveField));
    }
    /**
     * Enhanced name detection - checks if a value looks like a person's name
     */
    looksLikeName(value) {
        if (!value || typeof value !== 'string' || value.length < 3) {
            return false;
        }
        // Skip obvious non-names
        if (/^\d+$/.test(value) || // pure numbers
            /@/.test(value) || // email addresses
            /^https?:\/\//.test(value) || // URLs
            value.includes('\\') || value.includes('/') || // file paths
            /\.(com|org|net|gov|edu)$/i.test(value) // domain names
        ) {
            return false;
        }
        // Look for name patterns
        return /^[A-Z][a-z]{1,15}([,\s]+[A-Z][a-z]{1,15})+$/.test(value.trim()) || // "First Last" or "Last, First"
            /^[A-Z][a-z]{1,15},\s*[A-Z][a-z]{1,15}$/.test(value.trim()) || // "Last, First"
            /^[A-Z][a-z]{1,15}\s+[A-Z]\.?\s*[A-Z][a-z]{1,15}$/.test(value.trim()); // "First M. Last"
    }
    /**
     * Protect string content by detecting and masking sensitive patterns
     */
    protectStringContent(value, fieldName) {
        if (!value || typeof value !== 'string') {
            return value;
        }
        let protectedValue = value;
        // Check if the entire value looks like a name
        if (this.looksLikeName(value)) {
            return this.maskValue(value, fieldName, 'name');
        }
        // Apply pattern-based masking
        for (const [patternName, pattern] of Object.entries(this.SENSITIVE_PATTERNS)) {
            protectedValue = protectedValue.replace(pattern, (match) => {
                return this.maskValue(match, fieldName, patternName);
            });
        }
        return protectedValue;
    }
    /**
     * Protect a specific value based on masking level
     */
    protectValue(value, fieldName, _context) {
        if (value === null || value === undefined) {
            return value;
        }
        if (this.config.enableTokenization) {
            return this.tokenizeValue(value, fieldName);
        }
        return this.maskValue(value, fieldName);
    }
    /**
     * Mask a value based on the configured masking level
     */
    maskValue(value, fieldName, patternType) {
        if (typeof value !== 'string' && typeof value !== 'number') {
            return '[MASKED_OBJECT]';
        }
        const stringValue = String(value);
        const length = stringValue.length;
        // Handle empty strings
        if (length === 0)
            return '[EMPTY]';
        switch (this.config.maskingLevel) {
            case 'light':
                // Show first and last character, mask middle
                if (length <= 2)
                    return '*'.repeat(length);
                if (length <= 4)
                    return stringValue[0] + '*'.repeat(Math.max(length - 2, 0)) + stringValue[length - 1];
                return stringValue.substring(0, 2) + '*'.repeat(Math.max(length - 4, 1)) + stringValue.substring(length - 2);
            case 'moderate':
                // Show first character only for shorter strings, partial for longer
                if (length <= 4)
                    return stringValue[0] + '*'.repeat(Math.max(length - 1, 0));
                if (length <= 10)
                    return stringValue.substring(0, 2) + '*'.repeat(Math.max(length - 2, 0));
                return stringValue.substring(0, 3) + '*'.repeat(Math.max(length - 6, 1)) + stringValue.substring(length - 3);
            case 'strict':
                // Complete masking with type hint
                const typeHint = this.getTypeHint(stringValue, fieldName, patternType);
                return `[MASKED_${typeHint}]`;
            default:
                return '[MASKED]';
        }
    }
    /**
     * Generate a type hint for masked values
     */
    getTypeHint(value, fieldName, patternType) {
        if (patternType) {
            return patternType.toUpperCase();
        }
        const lowerField = fieldName.toLowerCase();
        if (lowerField.includes('email'))
            return 'EMAIL';
        if (lowerField.includes('phone'))
            return 'PHONE';
        if (lowerField.includes('name') || lowerField.includes('owner') ||
            lowerField.includes('manager') || lowerField.includes('contact') ||
            lowerField.includes('person') || lowerField.includes('employee') ||
            lowerField.includes('user') || lowerField.includes('coordinator') ||
            lowerField.includes('lead') || lowerField.includes('representative'))
            return 'NAME';
        if (lowerField.includes('address'))
            return 'ADDRESS';
        if (lowerField.includes('id'))
            return 'ID';
        // Detect by content
        if (this.looksLikeName(value))
            return 'NAME';
        if (/^\d+$/.test(value))
            return 'NUMBER';
        if (value.includes('@'))
            return 'EMAIL';
        if (/^\d{3}-?\d{2}-?\d{4}$/.test(value))
            return 'SSN';
        return 'TEXT';
    }
    /**
     * Tokenize a value for reversible masking
     */
    tokenizeValue(value, fieldName) {
        const valueString = JSON.stringify(value);
        const hash = crypto.createHash('sha256').update(valueString).digest('hex');
        const shortToken = hash.substring(0, 16);
        const token = `TOKEN_${shortToken}`;
        // Store mapping for potential reversal
        this.tokenStore.set(token, {
            token,
            originalValue: value,
            fieldName,
            timestamp: Date.now()
        });
        return token;
    }
    /**
     * Reverse tokenization (if enabled and token exists)
     */
    detokenizeValue(token) {
        const mapping = this.tokenStore.get(token);
        return mapping ? mapping.originalValue : token;
    }
    /**
     * Clear old tokens to prevent memory leaks
     */
    clearExpiredTokens(maxAgeMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        for (const [token, mapping] of this.tokenStore.entries()) {
            if (now - mapping.timestamp > maxAgeMs) {
                this.tokenStore.delete(token);
            }
        }
    }
    /**
     * Get statistics about current protection activities
     */
    getProtectionStats() {
        return {
            activeTokens: this.tokenStore.size,
            maskingEnabled: this.config.enableMasking,
            maskingLevel: this.config.maskingLevel,
            tokenizationEnabled: this.config.enableTokenization
        };
    }
    /**
     * Update configuration at runtime
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Special method for protecting authentication responses
     */
    protectAuthData(authResponse) {
        const sensitiveAuthFields = ['password', 'token', 'sessionToken', 'secret', 'key'];
        if (typeof authResponse !== 'object' || !authResponse) {
            return authResponse;
        }
        const protected_auth = { ...authResponse };
        for (const field of sensitiveAuthFields) {
            if (protected_auth[field]) {
                protected_auth[field] = '[PROTECTED_AUTH_TOKEN]';
            }
        }
        return protected_auth;
    }
    /**
     * Protect error responses that might contain sensitive info
     */
    protectErrorData(error) {
        if (!error)
            return error;
        const protectedError = { ...error };
        // Protect common error fields that might leak sensitive data
        if (protectedError.response?.data) {
            protectedError.response.data = this.protectData(protectedError.response.data, 'error');
        }
        if (protectedError.config?.headers?.Authorization) {
            protectedError.config.headers.Authorization = '[PROTECTED_AUTH_HEADER]';
        }
        return protectedError;
    }
}
// Default instance with moderate protection
export const defaultPrivacyProtector = new PrivacyProtector({
    enableMasking: process.env.ENABLE_PRIVACY_MASKING !== 'false',
    maskingLevel: process.env.MASKING_LEVEL || 'moderate',
    enableTokenization: process.env.ENABLE_TOKENIZATION === 'true',
    preserveStructure: true
});
//# sourceMappingURL=privacy-protector.js.map