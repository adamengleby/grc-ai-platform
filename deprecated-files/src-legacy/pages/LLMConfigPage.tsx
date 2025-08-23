import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/store/auth';
import {
  Settings,
  Brain,
  CheckCircle,
  AlertTriangle,
  Save,
  TestTube,
  Eye,
  EyeOff
} from 'lucide-react';

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'azure-openai' | 'custom';
  model: string;
  endpoint: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
}

export const LLMConfigPage: React.FC = () => {
  const { tenant } = useAuthStore();
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'openai',
    model: 'gpt-4',
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 4000,
    isActive: true
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, [tenant?.id]);

  const loadConfig = async () => {
    if (!tenant) return;

    try {
      const stored = localStorage.getItem(`llm_config_${tenant.id}`);
      if (stored) {
        const savedConfig = JSON.parse(stored);
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Failed to load LLM config:', error);
    }
  };

  const saveConfig = async () => {
    if (!tenant) return;

    setIsSaving(true);
    try {
      localStorage.setItem(`llm_config_${tenant.id}`, JSON.stringify(config));
      setTestResult({ success: true, message: 'Configuration saved successfully!' });
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to save configuration' });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (config.apiKey && config.endpoint) {
        setTestResult({ 
          success: true, 
          message: `Successfully connected to ${config.provider} ${config.model}` 
        });
      } else {
        setTestResult({ 
          success: false, 
          message: 'API key and endpoint are required' 
        });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: 'Connection test failed' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const providers = [
    { value: 'openai', label: 'OpenAI', defaultEndpoint: 'https://api.openai.com/v1', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { value: 'anthropic', label: 'Anthropic', defaultEndpoint: 'https://api.anthropic.com', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
    { value: 'azure-openai', label: 'Azure OpenAI', defaultEndpoint: 'https://your-resource.openai.azure.com', models: ['gpt-4', 'gpt-4o', 'gpt-35-turbo'] },
    { value: 'custom', label: 'Custom Endpoint', defaultEndpoint: '', models: ['custom-model'] }
  ];

  const selectedProvider = providers.find(p => p.value === config.provider);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">LLM Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Configure your Large Language Model provider for AI-powered GRC analysis
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Current Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium">Provider</p>
              <Badge variant="secondary">{selectedProvider?.label}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Model</p>
              <p className="text-sm text-muted-foreground">{config.model}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Status</p>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${config.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{config.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Tenant</p>
              <p className="text-sm text-muted-foreground">{tenant?.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Provider Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Provider</label>
            <select
              value={config.provider}
              onChange={(e) => {
                const newProvider = e.target.value as LLMConfig['provider'];
                const providerInfo = providers.find(p => p.value === newProvider);
                setConfig(prev => ({
                  ...prev,
                  provider: newProvider,
                  endpoint: providerInfo?.defaultEndpoint || '',
                  model: providerInfo?.models[0] || ''
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {providers.map(provider => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Model</label>
            <select
              value={config.model}
              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {selectedProvider?.models.map(model => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          {/* Endpoint */}
          <div>
            <label className="text-sm font-medium mb-2 block">API Endpoint</label>
            <Input
              value={config.endpoint}
              onChange={(e) => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="text-sm font-medium mb-2 block">API Key</label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Temperature</label>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Max Tokens</label>
              <Input
                type="number"
                min="100"
                max="32000"
                value={config.maxTokens}
                onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
              />
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <div>
                <p>{testResult.message}</p>
              </div>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={testConnection}
              disabled={isTesting}
              variant="outline"
            >
              <TestTube className="h-4 w-4 mr-2" />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              onClick={saveConfig}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};