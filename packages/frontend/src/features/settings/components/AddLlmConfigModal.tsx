import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { Alert } from '@/app/components/ui/Alert';
import { Badge } from '@/app/components/ui/Badge';
import { Textarea } from '@/app/components/ui/Textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/Dialog';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Plus,
  Brain,
  Info,
  Eye,
  EyeOff,
  TestTube,
  Zap
} from 'lucide-react';
import { useAuthStore } from '@/app/store/auth';

interface AddLlmConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (llmConfig: NewLlmConfig) => Promise<void>;
  editMode?: boolean;
  initialConfig?: NewLlmConfig;
}

export interface NewLlmConfig {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  endpoint: string;
  apiKey: string;
  customHeaders?: Record<string, string>;
  maxTokens: number;
  temperature: number;
  isEnabled: boolean;
  createdAt: string;
}

const llmProviders = [
  {
    value: 'azure-openai',
    label: 'Azure OpenAI',
    models: ['your-deployment-name'],
    defaultEndpoint: 'https://your-resource.openai.azure.com',
    requiresKey: true,
    description: 'Microsoft Azure OpenAI Service with enterprise security (enter your deployment name below)'
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultEndpoint: 'https://api.openai.com/v1',
    requiresKey: true,
    description: 'Direct OpenAI API integration'
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    defaultEndpoint: 'https://api.anthropic.com',
    requiresKey: true,
    description: 'Anthropic Claude models with advanced reasoning'
  },
  {
    value: 'custom',
    label: 'Custom Endpoint',
    models: ['custom-model'],
    defaultEndpoint: '',
    requiresKey: true,
    description: 'Custom LLM endpoint with configurable model and parameters'
  },
  {
    value: 'ollama',
    label: 'Ollama',
    models: ['llama2', 'codellama', 'mistral', 'neural-chat'],
    defaultEndpoint: 'http://localhost:11434',
    requiresKey: false,
    description: 'Local Ollama instance for private LLM hosting'
  }
];

export default function AddLlmConfigModal({
  isOpen,
  onClose,
  onSave,
  editMode = false,
  initialConfig
}: AddLlmConfigModalProps) {
  const { tenant: _tenant } = useAuthStore();
  const [formData, setFormData] = useState({
    name: initialConfig?.name || '',
    description: initialConfig?.description || '',
    provider: initialConfig?.provider || 'azure-openai',
    model: initialConfig?.model || 'gpt-4o',
    endpoint: initialConfig?.endpoint || '',
    apiKey: initialConfig?.apiKey || '',
    customHeaders: initialConfig?.customHeaders || {} as Record<string, string>,
    maxTokens: initialConfig?.maxTokens || 4000,
    temperature: initialConfig?.temperature || 0.7
  });
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [_isLoading, _setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [headerPairs, setHeaderPairs] = useState<Array<{ key: string; value: string }>>([]);

  const selectedProvider = llmProviders.find(p => p.value === formData.provider);

  // Initialize form when modal opens (only for new configs, not edits)
  useEffect(() => {
    if (isOpen && selectedProvider && !editMode) {
      setFormData(prev => ({
        ...prev,
        endpoint: selectedProvider.defaultEndpoint,
        model: selectedProvider.models[0]
      }));
    }
  }, [isOpen, selectedProvider, editMode]);

  // Reset form data when initialConfig changes (for edit mode)
  useEffect(() => {
    if (editMode && initialConfig) {
      setFormData({
        name: initialConfig.name || '',
        description: initialConfig.description || '',
        provider: initialConfig.provider || 'azure-openai',
        model: initialConfig.model || 'gpt-4o',
        endpoint: initialConfig.endpoint || '',
        apiKey: initialConfig.apiKey || '',
        customHeaders: initialConfig.customHeaders || {},
        maxTokens: initialConfig.maxTokens || 4000,
        temperature: initialConfig.temperature || 0.7
      });

      // Set header pairs for custom headers
      if (initialConfig.customHeaders) {
        const pairs = Object.entries(initialConfig.customHeaders).map(([key, value]) => ({ key, value }));
        setHeaderPairs(pairs);
      }
    }
  }, [editMode, initialConfig]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTestResult(null); // Clear test result when form changes
  };

  const handleProviderChange = (providerId: string) => {
    const provider = llmProviders.find(p => p.value === providerId);
    if (provider) {
      setFormData(prev => ({
        ...prev,
        provider: providerId,
        endpoint: provider.defaultEndpoint,
        model: providerId === 'azure-openai' ? '' : provider.models[0], // Clear model for Azure OpenAI
        apiKey: provider.requiresKey ? prev.apiKey : ''
      }));
    }
  };

  const handleHeadersChange = (pairs: Array<{ key: string; value: string }>) => {
    setHeaderPairs(pairs);
    const headers: Record<string, string> = {};
    pairs.forEach(pair => {
      if (pair.key.trim() && pair.value.trim()) {
        headers[pair.key.trim()] = pair.value.trim();
      }
    });
    handleInputChange('customHeaders', headers);
  };

  const validateForm = () => {
    if (!formData.name.trim()) return 'LLM configuration name is required';
    if (!formData.endpoint.trim()) return 'Endpoint URL is required';
    if (!formData.endpoint.startsWith('http://') && !formData.endpoint.startsWith('https://')) {
      return 'Endpoint must be a valid HTTP/HTTPS URL';
    }
    if (selectedProvider?.requiresKey && !formData.apiKey.trim()) {
      return 'API key is required for this provider';
    }
    if (formData.maxTokens < 100 || formData.maxTokens > 32000) {
      return 'Max tokens must be between 100 and 32,000';
    }
    if (formData.temperature < 0 || formData.temperature > 2) {
      return 'Temperature must be between 0 and 2';
    }
    return null;
  };

  const testConfiguration = async () => {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setMessage({ type: 'info', text: `Testing ${formData.provider} connection...` });

    try {
      // Test the actual LLM endpoint
      await testLLMConnection();

      setTestResult({ 
        success: true, 
        message: `Connection successful! Endpoint and deployment verified.` 
      });
      setMessage({ 
        type: 'success', 
        text: 'Connection test passed - configuration is working correctly' 
      });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
      setMessage({ type: 'error', text: `Connection failed: ${error.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const testLLMConnection = async () => {
    let endpoint = formData.endpoint;
    if (!endpoint.startsWith('https://')) endpoint = 'https://' + endpoint;
    if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);

    let apiUrl: string;
    let headers: Record<string, string>;
    let requestBody: any;

    if (formData.provider === 'azure-openai') {
      // Test Azure OpenAI with a minimal request
      const deploymentName = formData.model;
      apiUrl = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-08-01-preview`;
      headers = {
        'Content-Type': 'application/json',
        'api-key': formData.apiKey
      };
      requestBody = {
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        temperature: 0
      };
      
      console.log(`[LLM Test] Testing Azure OpenAI: ${apiUrl}`);
      
    } else if (formData.provider === 'openai') {
      // Test OpenAI
      apiUrl = `${endpoint}/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${formData.apiKey}`
      };
      requestBody = {
        model: formData.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        temperature: 0
      };
      
    } else if (formData.provider === 'anthropic') {
      // Test Anthropic
      apiUrl = `${endpoint}/v1/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': formData.apiKey,
        'anthropic-version': '2023-06-01'
      };
      requestBody = {
        model: formData.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      };
      
    } else {
      throw new Error('Provider testing not yet implemented for custom endpoints');
    }

    // Add custom headers if any
    if (formData.customHeaders) {
      Object.assign(headers, formData.customHeaders);
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[LLM Test] API error:`, {
        status: response.status,
        statusText: response.statusText,
        url: apiUrl,
        errorText
      });
      
      if (formData.provider === 'azure-openai' && response.status === 404) {
        throw new Error(`Deployment '${formData.model}' not found. Check your deployment name in Azure AI Studio.`);
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Check your API key.');
      } else if (response.status === 403) {
        throw new Error('Access forbidden. Check your API key permissions.');
      } else {
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
    }

    // Try to parse response to verify it's working
    const data = await response.json();
    console.log(`[LLM Test] Success:`, { status: response.status, hasChoices: !!data.choices || !!data.content });
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const llmConfig: NewLlmConfig = {
        id: editMode ? initialConfig!.id : `llm-${crypto.randomUUID()}`,
        name: formData.name.trim(),
        description: formData.description.trim() || `${selectedProvider?.label} configuration: ${formData.model}`,
        provider: formData.provider,
        model: formData.model,
        endpoint: formData.endpoint.trim(),
        apiKey: formData.apiKey.trim(),
        customHeaders: Object.keys(formData.customHeaders).length > 0 ? formData.customHeaders : undefined,
        maxTokens: formData.maxTokens,
        temperature: formData.temperature,
        isEnabled: editMode ? initialConfig!.isEnabled : true,
        createdAt: editMode ? initialConfig!.createdAt : new Date().toISOString()
      };

      await onSave(llmConfig);
      
      // Reset form and close modal
      setFormData({
        name: '',
        description: '',
        provider: 'azure-openai',
        model: 'gpt-4o',
        endpoint: '',
        apiKey: '',
        customHeaders: {},
        maxTokens: 4000,
        temperature: 0.7
      });
      setHeaderPairs([]);
      setTestResult(null);
      setMessage(null);
      onClose();
      
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to add LLM configuration: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5 text-blue-600" />
            <span>{editMode ? 'Edit LLM Configuration' : 'Add LLM Configuration'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {/* Progress Steps Indicator */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  1
                </div>
                <span className="text-sm font-medium text-blue-900">Basic Info</span>
              </div>
              <div className="w-8 h-px bg-blue-200"></div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  2
                </div>
                <span className="text-sm font-medium text-blue-900">Configuration</span>
              </div>
              <div className="w-8 h-px bg-blue-200"></div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  3
                </div>
                <span className="text-sm font-medium text-blue-900">Parameters</span>
              </div>
            </div>
            <Badge variant="outline" className="bg-white border-blue-200 text-blue-700">
              <Zap className="h-3 w-3 mr-1" />
              LLM Setup
            </Badge>
          </div>

          {/* Section 1: Basic Information */}
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Info className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Basic Information</h3>
                  <p className="text-sm text-gray-500">Name and provider selection for your LLM configuration</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="llmName" className="text-sm font-medium text-gray-700">
                    Configuration Name *
                  </Label>
                  <Input
                    id="llmName"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Production GPT-4o, Claude Sonnet Dev"
                    disabled={isSaving}
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500">Choose a descriptive name to identify this configuration</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider" className="text-sm font-medium text-gray-700">
                    Provider *
                  </Label>
                  <select
                    id="provider"
                    value={formData.provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    disabled={isSaving}
                  >
                    {llmProviders.map(provider => (
                      <option key={provider.value} value={provider.value}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">{selectedProvider?.description}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Brief description of when to use this LLM configuration..."
                  rows={3}
                  disabled={isSaving}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">Help team members understand when to use this configuration</p>
              </div>
            </div>
          </div>

          {/* Section 2: Model Configuration */}
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Brain className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Model Configuration</h3>
                  <p className="text-sm text-gray-500">API endpoint, model selection, and authentication settings</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="model" className="text-sm font-medium text-gray-700">
                    {formData.provider === 'azure-openai' ? 'Deployment Name *' : 'Model *'}
                  </Label>
                  {formData.provider === 'custom' || formData.provider === 'azure-openai' ? (
                    <Input
                      id="model"
                      type="text"
                      value={formData.model}
                      onChange={(e) => handleInputChange('model', e.target.value)}
                      placeholder={
                        formData.provider === 'azure-openai' 
                          ? "e.g., my-gpt4-deployment, gpt-35-turbo-prod" 
                          : "e.g., llama-2-70b, mistral-7b-instruct"
                      }
                      disabled={isSaving}
                      className="h-11 font-mono text-sm"
                    />
                  ) : (
                    <select
                      id="model"
                      value={formData.model}
                      onChange={(e) => handleInputChange('model', e.target.value)}
                      className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      disabled={isSaving}
                    >
                      {selectedProvider?.models.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-gray-500">
                    {formData.provider === 'azure-openai' 
                      ? 'Enter your Azure OpenAI deployment name (not the model name)'
                      : 'Select the specific model variant to use'
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endpoint" className="text-sm font-medium text-gray-700">
                    API Endpoint *
                  </Label>
                  <Input
                    id="endpoint"
                    type="url"
                    value={formData.endpoint}
                    onChange={(e) => handleInputChange('endpoint', e.target.value)}
                    placeholder={selectedProvider?.defaultEndpoint}
                    disabled={isSaving}
                    className="h-11 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">Full URL to the API endpoint including protocol</p>
                </div>
              </div>

              {selectedProvider?.requiresKey && (
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
                    API Key *
                  </Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.apiKey}
                      onChange={(e) => handleInputChange('apiKey', e.target.value)}
                      placeholder="Enter your API key..."
                      disabled={isSaving}
                      className="h-11 pr-12 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                      disabled={isSaving}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">API key will be securely stored and encrypted</p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Advanced Configuration */}
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Zap className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Advanced Configuration</h3>
                    <p className="text-sm text-gray-500">Model parameters and custom headers</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-700">
                  <Info className="h-3 w-3 mr-1" />
                  Optional
                </Badge>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Model Parameters */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 text-sm">Model Parameters</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="maxTokens" className="text-sm font-medium text-gray-700">
                      Max Tokens
                    </Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      value={formData.maxTokens}
                      onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value) || 4000)}
                      min={100}
                      max={32000}
                      disabled={isSaving}
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500">Maximum tokens in model response (100-32,000)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="temperature" className="text-sm font-medium text-gray-700">
                      Temperature
                    </Label>
                    <Input
                      id="temperature"
                      type="number"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value) || 0.7)}
                      min={0}
                      max={2}
                      disabled={isSaving}
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500">Randomness of model responses (0=deterministic, 2=very random)</p>
                  </div>
                </div>
              </div>

              {/* Custom Headers */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 text-sm">Custom Headers</h4>
                  <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200 text-gray-600">
                    <Info className="h-3 w-3 mr-1" />
                    Advanced
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">Add custom HTTP headers for specialized authentication or routing</p>
                
                <div className="space-y-3">
                  {headerPairs.map((pair, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Input
                        placeholder="Header name (e.g., Authorization)"
                        value={pair.key}
                        onChange={(e) => {
                          const newPairs = [...headerPairs];
                          newPairs[index].key = e.target.value;
                          handleHeadersChange(newPairs);
                        }}
                        disabled={isSaving}
                        className="flex-1 font-mono text-sm bg-white"
                      />
                      <Input
                        placeholder="Header value"
                        value={pair.value}
                        onChange={(e) => {
                          const newPairs = [...headerPairs];
                          newPairs[index].value = e.target.value;
                          handleHeadersChange(newPairs);
                        }}
                        disabled={isSaving}
                        className="flex-1 font-mono text-sm bg-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newPairs = headerPairs.filter((_, i) => i !== index);
                          handleHeadersChange(newPairs);
                        }}
                        disabled={isSaving}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleHeadersChange([...headerPairs, { key: '', value: '' }])}
                    disabled={isSaving}
                    className="w-full mt-3 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Add Custom Header
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Configuration Testing */}
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <TestTube className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Test Configuration</h3>
                  <p className="text-sm text-gray-500">Verify connectivity and authentication before saving</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-start justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-green-900 text-sm mb-1">Connection Test</h4>
                  <p className="text-sm text-green-700">
                    Test your configuration to ensure the LLM provider is accessible with your settings
                  </p>
                </div>
                <Button
                  onClick={testConfiguration}
                  disabled={isTesting || isSaving}
                  variant="outline"
                  className="ml-4 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>

              {testResult && (
                <div className="mt-4">
                  <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                      </p>
                      <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                        {testResult.message}
                      </p>
                    </div>
                  </Alert>
                </div>
              )}
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <Alert className={`${
              message.type === 'success' ? 'border-green-200 bg-green-50' :
              message.type === 'error' ? 'border-red-200 bg-red-50' :
              'border-blue-200 bg-blue-50'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : message.type === 'error' ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : (
                <Info className="h-4 w-4 text-blue-600" />
              )}
              <span className={
                message.type === 'success' ? 'text-green-800' :
                message.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }>
                {message.text}
              </span>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || !!validateForm()}
            className="flex items-center space-x-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                <span>{editMode ? 'Update Configuration' : 'Add LLM Configuration'}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}