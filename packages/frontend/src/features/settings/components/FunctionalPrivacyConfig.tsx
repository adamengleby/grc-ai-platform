/**
 * Functional Privacy Configuration
 * Only includes settings that actually work and affect LLM data protection
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Label } from '@/app/components/ui/Label';
import { Alert } from '@/app/components/ui/Alert';
import { Badge } from '@/app/components/ui/Badge';
import { Textarea } from '@/app/components/ui/Textarea';
import { useAuthStore } from '@/app/store/auth';
import {
  Shield,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle,
  Save,
  RotateCcw
} from 'lucide-react';

interface FunctionalPrivacySettings {
  enable_privacy_masking: boolean;
  masking_level: 'light' | 'moderate' | 'strict';
  custom_sensitive_fields: string[];
}

interface FunctionalPrivacyConfigProps {
  tenantId: string;
  userId?: string;
  scope: 'user' | 'tenant';
  canModify: boolean;
}

export default function FunctionalPrivacyConfig({
  tenantId,
  userId,
  scope,
  canModify
}: FunctionalPrivacyConfigProps) {
  const { token, tenant } = useAuthStore();
  const [settings, setSettings] = useState<FunctionalPrivacySettings>({
    enable_privacy_masking: true,
    masking_level: 'strict',
    custom_sensitive_fields: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [customFieldsText, setCustomFieldsText] = useState('');

  // Get auth headers for API requests
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token?.access_token) {
      headers['Authorization'] = `Bearer ${token.access_token}`;
    }
    
    if (tenant?.id) {
      headers['X-Tenant-ID'] = tenant.id;
    }
    
    return headers;
  };

  // Load privacy settings from backend
  useEffect(() => {
    console.log('🔍 Privacy Config - Auth Context:', { 
      token: !!token, 
      tenant: tenant?.id, 
      tenantName: tenant?.name 
    });
    
    if (tenant?.id || tenantId) {
      console.log('📥 Loading privacy settings...');
      loadPrivacySettings();
    } else {
      console.warn('⚠️ No tenant context available for privacy settings');
      // Set default settings and stop loading
      setSettings({
        enable_privacy_masking: true,
        masking_level: 'strict',
        custom_sensitive_fields: ['employee_id', 'ssn', 'account_number', 'phone', 'email']
      });
      setIsLoading(false);
    }
  }, [tenant?.id, tenantId, userId, scope]);

  const loadPrivacySettings = async () => {
    try {
      setIsLoading(true);
      
      // Use fallback headers if auth context is not available
      const headers = token?.access_token && tenant?.id 
        ? getAuthHeaders() 
        : {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            'X-Tenant-ID': 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'
          };
      
      console.log('🌐 Making privacy API request with headers:', { 
        hasAuth: !!headers.Authorization, 
        hasTenant: !!headers['X-Tenant-ID'] 
      });
      
      const response = await fetch(`http://localhost:3005/api/v1/privacy/settings?scope=${scope}`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setSettings({
            enable_privacy_masking: result.data.enable_privacy_masking,
            masking_level: result.data.masking_level,
            custom_sensitive_fields: result.data.custom_sensitive_fields || []
          });
          setCustomFieldsText(result.data.custom_sensitive_fields?.join(', ') || '');
        }
      }
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
      setMessage({ type: 'error', text: 'Failed to load privacy settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const savePrivacySettings = async () => {
    try {
      setIsSaving(true);
      setMessage(null);

      const customFields = customFieldsText
        .split(',')
        .map(field => field.trim())
        .filter(field => field.length > 0);

      const payload = {
        ...settings,
        custom_sensitive_fields: customFields,
        scope
      };

      // Use fallback headers if auth context is not available  
      const headers = token?.access_token && tenant?.id 
        ? getAuthHeaders() 
        : {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            'X-Tenant-ID': 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'
          };
      
      const response = await fetch('http://localhost:3005/api/v1/privacy/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSettings({ ...settings, custom_sensitive_fields: customFields });
          setMessage({ type: 'success', text: 'Privacy settings saved successfully' });
          
          // Clear message after 3 seconds
          setTimeout(() => setMessage(null), 3000);
        }
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
      setMessage({ type: 'error', text: 'Failed to save privacy settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = async () => {
    try {
      setIsSaving(true);
      // Use fallback headers if auth context is not available  
      const headers = token?.access_token && tenant?.id 
        ? getAuthHeaders() 
        : {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            'X-Tenant-ID': 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6'
          };
      
      const response = await fetch(`http://localhost:3005/api/v1/privacy/settings?scope=${scope}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        await loadPrivacySettings();
        setMessage({ type: 'success', text: 'Settings reset to secure defaults' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setMessage({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const getMaskingLevelDescription = (level: string) => {
    switch (level) {
      case 'light':
        return {
          summary: 'Minimal masking - preserves readability while protecting obvious PII',
          masked: ['Email addresses', 'Phone numbers', 'Social Security Numbers'],
          notMasked: ['Names', 'Addresses', 'Record IDs', 'Job titles', 'Department names', 'Most business context'],
          useCase: 'Best for internal analysis where context is critical'
        };
      case 'moderate':
        return {
          summary: 'Balanced protection - masks most sensitive data while maintaining context',
          masked: ['Email addresses', 'Phone numbers', 'SSN/Tax IDs', 'Names (partial)', 'Account numbers', 'Large numeric IDs'],
          notMasked: ['Record types', 'Department names', 'Job titles', 'Addresses (partial)', 'Business process context'],
          useCase: 'Recommended for most AI analysis tasks'
        };
      case 'strict':
        return {
          summary: 'Maximum security - replaces all sensitive data with tokens (RECOMMENDED)',
          masked: ['All email addresses', 'All phone numbers', 'All names', 'All addresses', 'SSN/Tax IDs', 'Account numbers', 'Record IDs (6+ digits)', 'All custom sensitive fields'],
          notMasked: ['Record types', 'Status fields', 'Category classifications', 'Date/time stamps', 'Business process flows'],
          useCase: 'Required for compliance and external LLM analysis'
        };
      default:
        return {
          summary: '',
          masked: [],
          notMasked: [],
          useCase: ''
        };
    }
  };

  const getMaskingLevelColor = (level: string) => {
    switch (level) {
      case 'light':
        return 'bg-yellow-100 text-yellow-800';
      case 'moderate':
        return 'bg-blue-100 text-blue-800';
      case 'strict':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={`border-l-4 ${settings.enable_privacy_masking ? 'border-l-green-500' : 'border-l-red-500'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center">
                {settings.enable_privacy_masking ? (
                  <Shield className="h-5 w-5 text-green-600 mr-2" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                )}
                LLM Data Protection Status
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {settings.enable_privacy_masking 
                  ? `✅ PROTECTED - ${settings.masking_level} level masking applied before data reaches external LLMs`
                  : '❌ UNPROTECTED - Confidential data may be sent to external LLMs'
                }
              </p>
            </div>
            <Badge className={getMaskingLevelColor(settings.masking_level)}>
              {settings.masking_level.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Protection Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>How Privacy Protection Works</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">🔒 Critical Protection Point</h4>
            <p className="text-sm text-blue-800">
              Privacy protection is applied exactly when MCP tool results are sent to external LLMs (OpenAI, Anthropic, etc.). 
              Confidential Archer data is masked before leaving your infrastructure.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <h5 className="font-medium text-gray-900 mb-2">📋 Always Protected (All Levels)</h5>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Credit card numbers</li>
                <li>• Social Security Numbers</li>
                <li>• Passport numbers</li>
                <li>• License numbers</li>
                <li>• Custom sensitive field patterns</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <h5 className="font-medium text-gray-900 mb-2">📊 Never Masked</h5>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Record status (Open, Closed, etc.)</li>
                <li>• Risk categories (High, Medium, Low)</li>
                <li>• Incident types</li>
                <li>• Timestamps and dates</li>
                <li>• Business process context</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Functional Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Privacy Protection Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Privacy Masking */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Enable LLM Data Protection</h4>
              <p className="text-sm text-gray-600 mt-1">
                🚨 CRITICAL: Prevents confidential data from being sent to external LLM providers
              </p>
            </div>
            <Button
              variant={settings.enable_privacy_masking ? "default" : "outline"}
              size="sm"
              onClick={() => setSettings({ ...settings, enable_privacy_masking: !settings.enable_privacy_masking })}
              disabled={!canModify}
              className="ml-4"
            >
              {settings.enable_privacy_masking ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  PROTECTED
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  VULNERABLE
                </>
              )}
            </Button>
          </div>

          {/* Masking Level Selection */}
          {settings.enable_privacy_masking && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Protection Level</Label>
              <div className="grid gap-4">
                {(['light', 'moderate', 'strict'] as const).map((level) => (
                  <div
                    key={level}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      settings.masking_level === level 
                        ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/50' 
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => canModify && setSettings({ ...settings, masking_level: level })}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          settings.masking_level === level 
                            ? 'border-blue-500 bg-blue-500' 
                            : 'border-gray-300'
                        }`}>
                          {settings.masking_level === level && (
                            <CheckCircle className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <h4 className="font-semibold capitalize">{level}</h4>
                        {level === 'strict' && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                            RECOMMENDED
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="ml-7 space-y-3">
                      <p className="text-sm text-gray-600">
                        {getMaskingLevelDescription(level).summary}
                      </p>
                      <div className="text-xs space-y-2">
                        <div>
                          <span className="font-medium text-red-700">🔒 Will be masked:</span>
                          <ul className="list-disc list-inside ml-3 text-gray-600">
                            {getMaskingLevelDescription(level).masked.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="font-medium text-green-700">👁️ Will remain visible:</span>
                          <ul className="list-disc list-inside ml-3 text-gray-600">
                            {getMaskingLevelDescription(level).notMasked.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="pt-1">
                          <span className="font-medium text-blue-700">💡 Best for:</span>
                          <span className="text-gray-600 ml-1">{getMaskingLevelDescription(level).useCase}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Example Data Masking */}
          {settings.enable_privacy_masking && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">Example: Before and After Masking</Label>
              <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-1">📄 Original Archer Data:</div>
                  <div className="bg-white border rounded p-2 text-xs font-mono">
                    Employee: John Smith, john.smith@company.com<br/>
                    Phone: (555) 123-4567, ID: 343910<br/>
                    Incident: Database access denied for user john.smith@company.com
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-blue-700 mb-1">🔒 After {settings.masking_level.toUpperCase()} masking:</div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs font-mono">
                    {settings.masking_level === 'light' && (
                      <>
                        Employee: John Smith, [MASKED_EMAIL]<br/>
                        Phone: [MASKED_PHONE], ID: 343910<br/>
                        Incident: Database access denied for user [MASKED_EMAIL]
                      </>
                    )}
                    {settings.masking_level === 'moderate' && (
                      <>
                        Employee: [MASKED_NAME], [MASKED_EMAIL]<br/>
                        Phone: [MASKED_PHONE], ID: [MASKED_ID]<br/>
                        Incident: Database access denied for user [MASKED_EMAIL]
                      </>
                    )}
                    {settings.masking_level === 'strict' && (
                      <>
                        Employee: [MASKED_NAME], [MASKED_EMAIL]<br/>
                        Phone: [MASKED_PHONE], ID: [MASKED_ID]<br/>
                        Incident: Database access denied for user [MASKED_EMAIL]
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Sensitive Fields */}
          {settings.enable_privacy_masking && (
            <div className="space-y-2">
              <Label htmlFor="customFields">Additional Sensitive Field Patterns</Label>
              <Textarea
                id="customFields"
                value={customFieldsText}
                onChange={(e) => setCustomFieldsText(e.target.value)}
                placeholder="contract_number, vendor_id, internal_code, proprietary_data"
                disabled={!canModify}
                className="font-mono text-sm"
                rows={3}
              />
              <div className="text-xs text-gray-500 space-y-2">
                <p>
                  Enter field patterns that should be masked (comma-separated). 
                  Default patterns include: email, phone, ssn, account_number, employee_id
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="font-medium text-yellow-800 mb-1">💡 Custom Field Examples:</div>
                  <div className="space-y-1">
                    <div><code className="bg-white px-1 rounded">contract_number</code> - Will mask "contract_number: ABC123"</div>
                    <div><code className="bg-white px-1 rounded">vendor_id</code> - Will mask "vendor_id: VENDOR-001"</div>
                    <div><code className="bg-white px-1 rounded">internal_code</code> - Will mask "internal_code: PROJ-XYZ"</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              disabled={!canModify || isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Secure Defaults
            </Button>
            
            <Button
              onClick={savePrivacySettings}
              disabled={!canModify || isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
            )}
            {message.text}
          </div>
        </Alert>
      )}

      {/* Critical Notice */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <div>
          <h4 className="font-semibold mb-1">🚨 CRITICAL PRIVACY NOTICE</h4>
          <div className="text-sm space-y-1">
            <p>• These settings directly control what data is sent to external LLM providers</p>
            <p>• When disabled, confidential Archer data will be sent unmasked to OpenAI/Anthropic/etc.</p>
            <p>• Settings take effect immediately for all new AI requests</p>
            <p>• For maximum security, keep "Enable LLM Data Protection" ON with "STRICT" level</p>
          </div>
        </div>
      </Alert>
    </div>
  );
}