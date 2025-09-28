import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { Alert } from '@/app/components/ui/Alert';
import { Badge } from '@/app/components/ui/Badge';
import { Textarea } from '@/app/components/ui/Textarea';
import {
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  Unlock,
  Key,
  FileText,
  CheckCircle
} from 'lucide-react';
import { MCPPrivacyConfig } from '@/features/settings/pages/SettingsPage';

interface PrivacyConfigProps {
  config: MCPPrivacyConfig;
  onConfigChange: (config: MCPPrivacyConfig) => void;
  canModify: boolean;
  isSaving: boolean;
}

interface MaskingExample {
  original: string;
  light: string;
  moderate: string;
  strict: string;
}

const maskingExamples: MaskingExample[] = [
  {
    original: "Employee john.doe@company.com (ID: EMP-12345) has access",
    light: "Employee j***.doe@company.com (ID: E**-***45) has access",
    moderate: "Employee j***@company.com (ID: ***-***45) has access", 
    strict: "Employee [MASKED_EMAIL] (ID: [MASKED_ID]) has access"
  },
  {
    original: "Contact Sarah Wilson at (555) 123-4567",
    light: "Contact S****W*****n at (555) ***-*567",
    moderate: "Contact S*** W*** at (***) ***-*567",
    strict: "Contact [MASKED_NAME] at [MASKED_PHONE]"
  },
  {
    original: "SSN: 123-45-6789, Account: ACC-998877",
    light: "SSN: ***-**-**89, Account: A***998***",
    moderate: "SSN: ***-**-****, Account: ***-******",
    strict: "SSN: [MASKED_SSN], Account: [MASKED_ACCOUNT]"
  }
];

const sensitiveFieldCategories = [
  {
    category: 'Personal Information',
    fields: ['name', 'email', 'phone', 'address', 'ssn', 'employee_id'],
    description: 'Personal identifiers and contact information'
  },
  {
    category: 'Financial Data',
    fields: ['account_number', 'credit_card', 'salary', 'amount', 'cost'],
    description: 'Financial and monetary information'
  },
  {
    category: 'System Data',
    fields: ['password', 'token', 'api_key', 'ip_address', 'hostname'],
    description: 'System credentials and technical identifiers'
  }
];

export default function SecurityConfig({
  config,
  onConfigChange,
  canModify,
  isSaving: _isSaving
}: PrivacyConfigProps) {
  const [showTokenizationKey, setShowTokenizationKey] = useState(false);
  const [customFieldsText, setCustomFieldsText] = useState(
    config.customSensitiveFields.join(', ')
  );
  const [previewLevel, setPreviewLevel] = useState<'light' | 'moderate' | 'strict'>(
    config.maskingLevel
  );

  // Handle masking level change
  const handleMaskingLevelChange = (level: 'light' | 'moderate' | 'strict') => {
    const updatedConfig = {
      ...config,
      maskingLevel: level
    };
    onConfigChange(updatedConfig);
    setPreviewLevel(level);
  };

  // Handle privacy masking toggle
  const handlePrivacyMaskingToggle = (enabled: boolean) => {
    const updatedConfig = {
      ...config,
      enablePrivacyMasking: enabled
    };
    onConfigChange(updatedConfig);
  };

  // Handle tokenization toggle
  const handleTokenizationToggle = (enabled: boolean) => {
    const updatedConfig = {
      ...config,
      enableTokenization: enabled
    };
    onConfigChange(updatedConfig);
  };

  // Handle custom sensitive fields update
  const handleCustomFieldsUpdate = () => {
    const fields = customFieldsText
      .split(',')
      .map(field => field.trim())
      .filter(field => field.length > 0);
    
    const updatedConfig = {
      ...config,
      customSensitiveFields: fields
    };
    onConfigChange(updatedConfig);
  };

  // Get privacy level description
  const getPrivacyLevelDescription = (level: 'light' | 'moderate' | 'strict') => {
    switch (level) {
      case 'light':
        return 'Minimal masking - masks emails, SSNs, and obvious PII while preserving readability';
      case 'moderate':
        return 'Standard protection - masks all PII, financial data, and potentially sensitive information';
      case 'strict':
        return 'Maximum security - replaces all sensitive data with descriptive tokens';
      default:
        return '';
    }
  };

  // Get privacy level color
  const getPrivacyLevelColor = (level: 'light' | 'moderate' | 'strict') => {
    switch (level) {
      case 'light':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'moderate':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'strict':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Privacy Status Card */}
      <Card className={`border-l-4 ${config.enablePrivacyMasking ? 'border-l-green-500' : 'border-l-yellow-500'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center">
                {config.enablePrivacyMasking ? (
                  <Shield className="h-5 w-5 text-green-600 mr-2" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                )}
                Privacy Protection Status
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {config.enablePrivacyMasking 
                  ? `Active - ${config.maskingLevel} level protection` 
                  : 'Disabled - No data masking applied'
                }
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getPrivacyLevelColor(config.maskingLevel)}>
                {config.maskingLevel}
              </Badge>
              <Badge variant={config.enableTokenization ? "default" : "secondary"}>
                {config.enableTokenization ? 'Tokenization ON' : 'Tokenization OFF'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Privacy Protection Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Privacy Masking */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Enable Privacy Masking</h4>
              <p className="text-sm text-gray-600 mt-1">
                Automatically mask sensitive data in AI responses and system outputs
              </p>
            </div>
            <Button
              variant={config.enablePrivacyMasking ? "default" : "outline"}
              size="sm"
              onClick={() => handlePrivacyMaskingToggle(!config.enablePrivacyMasking)}
              disabled={!canModify}
              className="ml-4"
            >
              {config.enablePrivacyMasking ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Enabled
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Disabled
                </>
              )}
            </Button>
          </div>

          {/* Masking Level Selection */}
          {config.enablePrivacyMasking && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Masking Level</Label>
              <div className="grid gap-4">
                {(['light', 'moderate', 'strict'] as const).map((level) => (
                  <div
                    key={level}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      config.maskingLevel === level 
                        ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/50' 
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => canModify && handleMaskingLevelChange(level)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          config.maskingLevel === level 
                            ? 'border-blue-500 bg-blue-500' 
                            : 'border-gray-300'
                        }`}>
                          {config.maskingLevel === level && (
                            <CheckCircle className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <h4 className="font-semibold capitalize">{level}</h4>
                      </div>
                      <Badge className={getPrivacyLevelColor(level)}>
                        {level}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 ml-7">
                      {getPrivacyLevelDescription(level)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tokenization Setting */}
          {config.enablePrivacyMasking && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Enable Tokenization</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Use reversible tokens for secure data handling (requires encryption key)
                </p>
              </div>
              <Button
                variant={config.enableTokenization ? "default" : "outline"}
                size="sm"
                onClick={() => handleTokenizationToggle(!config.enableTokenization)}
                disabled={!canModify}
                className="ml-4"
              >
                {config.enableTokenization ? (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Enabled
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Disabled
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Tokenization Key (if enabled) */}
          {config.enablePrivacyMasking && config.enableTokenization && (
            <div className="space-y-2">
              <Label htmlFor="tokenizationKey">Tokenization Encryption Key</Label>
              <div className="relative">
                <Input
                  id="tokenizationKey"
                  type={showTokenizationKey ? 'text' : 'password'}
                  value={config.privacyKey || ''}
                  onChange={(e) => onConfigChange({ ...config, privacyKey: e.target.value })}
                  placeholder="Enter encryption key for tokenization"
                  disabled={!canModify}
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowTokenizationKey(!showTokenizationKey)}
                >
                  {showTokenizationKey ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Leave empty to use default key. Use a strong, unique key for production.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Sensitive Fields */}
      {config.enablePrivacyMasking && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Custom Sensitive Fields</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customFields">Additional Field Patterns</Label>
              <Textarea
                id="customFields"
                value={customFieldsText}
                onChange={(e) => setCustomFieldsText(e.target.value)}
                onBlur={handleCustomFieldsUpdate}
                placeholder="employee_id, contract_number, vendor_code, custom_field"
                disabled={!canModify}
                className="font-mono text-sm"
                rows={3}
              />
              <p className="text-xs text-gray-500">
                Enter additional field patterns to protect (comma-separated). These will be masked in addition to standard sensitive fields.
              </p>
            </div>

            {/* Predefined Field Categories */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Built-in Sensitive Field Categories</h4>
              <div className="grid gap-3">
                {sensitiveFieldCategories.map((category) => (
                  <div key={category.category} className="border rounded-lg p-3">
                    <h5 className="font-semibold text-sm mb-1">{category.category}</h5>
                    <p className="text-xs text-gray-600 mb-2">{category.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {category.fields.map((field) => (
                        <Badge key={field} variant="outline" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Masking Preview */}
      {config.enablePrivacyMasking && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <span>Data Masking Preview</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4 mb-4">
              <Label>Preview Level:</Label>
              <select
                value={previewLevel}
                onChange={(e) => setPreviewLevel(e.target.value as 'light' | 'moderate' | 'strict')}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="strict">Strict</option>
              </select>
            </div>

            <div className="space-y-4">
              {maskingExamples.map((example, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700">Original:</span>
                      <div className="bg-gray-50 p-2 rounded mt-1 font-mono text-sm">
                        {example.original}
                      </div>
                    </div>
                    
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700">With {previewLevel} masking:</span>
                      <div className="bg-blue-50 p-2 rounded mt-1 font-mono text-sm">
                        {example[previewLevel]}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <div>
          <h4 className="font-semibold mb-1">Security Notice</h4>
          <div className="text-sm space-y-1">
            <p>• Privacy settings affect how data is processed by AI models</p>
            <p>• Higher security levels may impact response quality and readability</p>
            <p>• Configuration changes require re-authentication of active sessions</p>
            <p>• Tokenization keys should be stored securely and never shared</p>
          </div>
        </div>
      </Alert>
    </div>
  );
}