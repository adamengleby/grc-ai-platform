import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Settings,
  Plus,
  Trash2,
  Brain,
  ExternalLink,
  Zap,
  Globe,
  Calendar
} from 'lucide-react';
import AddLlmConfigModal, { NewLlmConfig } from './AddLlmConfigModal';
import { useAuthStore } from '@/store/auth';

interface UserLlmConfig {
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
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  isEnabled: boolean;
  createdAt: string;
  lastTested?: string;
  errorMessage?: string;
}

interface LLMConfigSectionProps {
  canModify?: boolean;
  isSaving?: boolean;
}

export default function LLMConfigSection({ 
  canModify = true, 
  isSaving = false 
}: LLMConfigSectionProps) {
  const { tenant } = useAuthStore();
  const [llmConfigs, setLlmConfigs] = useState<UserLlmConfig[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user's LLM configurations from storage
  useEffect(() => {
    loadLlmConfigs();
  }, [tenant?.id]);

  const loadLlmConfigs = () => {
    setIsLoading(true);
    try {
      const storageKey = `user_llm_configs_${tenant?.id}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const userConfigs: UserLlmConfig[] = JSON.parse(stored);
        setLlmConfigs(userConfigs);
      } else {
        setLlmConfigs([]);
      }
    } catch (error) {
      console.error('Error loading LLM configurations:', error);
      setLlmConfigs([]);
    }
    setIsLoading(false);
  };

  const saveLlmConfigs = (updatedConfigs: UserLlmConfig[]) => {
    try {
      const storageKey = `user_llm_configs_${tenant?.id}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedConfigs));
      setLlmConfigs(updatedConfigs);
    } catch (error) {
      console.error('Error saving LLM configurations:', error);
    }
  };

  const handleAddLlmConfig = async (llmConfig: NewLlmConfig) => {
    const newConfig: UserLlmConfig = {
      ...llmConfig,
      status: 'disconnected',
      lastTested: new Date().toISOString()
    };

    const updatedConfigs = [...llmConfigs, newConfig];
    saveLlmConfigs(updatedConfigs);
  };

  const handleEditLlmConfig = (configId: string) => {
    setEditModalOpen(configId);
  };

  const handleUpdateLlmConfig = async (configId: string, updatedConfig: Partial<NewLlmConfig>) => {
    const updatedConfigs = llmConfigs.map(config => 
      config.id === configId ? { 
        ...config, 
        ...updatedConfig,
        lastTested: new Date().toISOString()
      } : config
    );
    saveLlmConfigs(updatedConfigs);
    setEditModalOpen(null);
  };

  const handleDeleteLlmConfig = async (configId: string) => {
    if (!canModify) return;

    const updatedConfigs = llmConfigs.filter(c => c.id !== configId);
    saveLlmConfigs(updatedConfigs);
  };

  const handleToggleLlmConfig = async (configId: string, enabled: boolean) => {
    if (!canModify) return;

    const updatedConfigs = llmConfigs.map(c => 
      c.id === configId ? { ...c, isEnabled: enabled } : c
    );
    saveLlmConfigs(updatedConfigs);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'azure-openai': return <Zap className="h-4 w-4" />;
      case 'openai': return <Brain className="h-4 w-4" />;
      case 'anthropic': return <ExternalLink className="h-4 w-4" />;
      case 'ollama': return <Settings className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'azure-openai': return 'Azure OpenAI';
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Anthropic';
      case 'ollama': return 'Ollama Local';
      case 'custom': return 'Custom Endpoint';
      default: return 'Unknown Provider';
    }
  };

  const getStatusIcon = (status: UserLlmConfig['status']) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'disconnected': return <AlertTriangle className="h-4 w-4 text-gray-400" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'testing': return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (config: UserLlmConfig) => {
    switch (config.status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge>;
      case 'disconnected':
        return <Badge variant="secondary">Disconnected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'testing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Testing</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading LLM configurations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">LLM Configuration Management</h3>
          <p className="text-sm text-gray-600">
            Add and configure Large Language Model providers for AI agent assignment
          </p>
        </div>
        {canModify && (
          <Button onClick={() => setAddModalOpen(true)} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add LLM Configuration</span>
          </Button>
        )}
      </div>

      {/* LLM Configurations List */}
      {llmConfigs.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No LLM Configurations</h3>
            <p className="text-gray-600 text-center max-w-md">
              Add your first LLM configuration using the "Add LLM Configuration" button above to enable AI agents with various language models for different use cases.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {llmConfigs.map((config) => {
            return (
              <Card 
                key={config.id}
                className={`transition-all hover:shadow-md ${
                  config.isEnabled ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <CardTitle className="text-base">{config.name}</CardTitle>
                        {getStatusIcon(config.status)}
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className="text-xs flex items-center space-x-1">
                          {getProviderIcon(config.provider)}
                          <span>{getProviderLabel(config.provider)}</span>
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {config.model}
                        </Badge>
                      </div>
                    </div>
                    {getStatusBadge(config)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-600">
                    {config.description}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">Endpoint:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono truncate max-w-48">
                        {config.endpoint}
                      </code>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Zap className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">Max Tokens:</span>
                        <span className="font-medium">{config.maxTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Settings className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">Temp:</span>
                        <span className="font-medium">{config.temperature}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">Added:</span>
                      <span>{new Date(config.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {config.errorMessage && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-red-800 text-xs">{config.errorMessage}</span>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.isEnabled}
                          onChange={(e) => handleToggleLlmConfig(config.id, e.target.checked)}
                          disabled={!canModify || isSaving}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">
                          {config.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {canModify && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditLlmConfig(config.id)}
                            className="flex items-center space-x-1"
                          >
                            <Settings className="h-3 w-3" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteLlmConfig(config.id)}
                            className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary Footer */}
      {llmConfigs.length > 0 && (
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    {llmConfigs.length} configuration{llmConfigs.length !== 1 ? 's' : ''} available
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">
                    {llmConfigs.filter(c => c.isEnabled).length} enabled
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="bg-white">
                {llmConfigs.filter(c => c.status === 'connected').length} connected
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add LLM Configuration Modal */}
      <AddLlmConfigModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddLlmConfig}
      />

      {/* Edit LLM Configuration Modal */}
      {editModalOpen && (() => {
        const configToEdit = llmConfigs.find(c => c.id === editModalOpen);
        return configToEdit ? (
          <AddLlmConfigModal
            isOpen={!!editModalOpen}
            onClose={() => setEditModalOpen(null)}
            onSave={(config) => handleUpdateLlmConfig(editModalOpen, config)}
            editMode={true}
            initialConfig={{
              id: configToEdit.id,
              name: configToEdit.name,
              description: configToEdit.description,
              provider: configToEdit.provider,
              model: configToEdit.model,
              endpoint: configToEdit.endpoint,
              apiKey: configToEdit.apiKey,
              customHeaders: configToEdit.customHeaders,
              maxTokens: configToEdit.maxTokens,
              temperature: configToEdit.temperature,
              isEnabled: configToEdit.isEnabled,
              createdAt: configToEdit.createdAt
            }}
          />
        ) : null;
      })()}
    </div>
  );
}