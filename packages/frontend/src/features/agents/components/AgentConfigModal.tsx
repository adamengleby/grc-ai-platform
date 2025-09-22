import React, { useState, useEffect } from 'react';
import { Button } from '../../../app/components/ui/Button';
import { Badge } from '../../../app/components/ui/Badge';
import { Alert } from '../../../app/components/ui/Alert';
import {
  X,
  Bot,
  Database,
  User,
  Sparkles,
  CheckCircle,
  Activity,
  Trash2,
  AlertCircle,
  Save,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../../../app/store/auth';
import { AIAgent, AGENT_PRESETS } from '../../../types/agent';
import { createAgentService } from '../../../lib/backendAgentService';
import { createAgentMetricsService } from '../../../lib/agentMetricsService';
import { backendLLMService } from '../../../lib/backendLLMService';
import { mcpConfigsManager } from '../../../lib/backendMcpConfigsApi';

interface AgentConfigModalProps {
  open: boolean;
  onClose: () => void;
  agent?: AIAgent | null;
  isEditing?: boolean;
  tenantId: string;
  onSave: () => void;
}

type TabType = 'general' | 'persona' | 'integrations' | 'performance';

const AgentConfigModal: React.FC<AgentConfigModalProps> = ({
  open,
  onClose,
  agent,
  isEditing = false,
  tenantId,
  onSave
}) => {
  const { tenant: _tenant } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    persona: '',
    systemPrompt: '',
    llmConfigId: '',
    enabledMcpServers: [] as string[],
    capabilities: [] as string[],
    useCase: '',
    avatar: '🤖',
    color: '#2563eb',
    isEnabled: true
  });

  // Available configurations
  const [availableLlmConfigs, setAvailableLlmConfigs] = useState<any[]>([]);
  const [availableMcpServers, setAvailableMcpServers] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<any>(null);

  // Load available configurations
  useEffect(() => {
    if (!tenantId || !open) return;

    // Load LLM configurations
    const loadLlmConfigs = async () => {
      try {
        const configs = await backendLLMService.getAllLlmConfigs();
        setAvailableLlmConfigs(configs);
      } catch (error) {
        console.error('Error loading LLM configurations:', error);
      }
    };
    loadLlmConfigs();

    // Load MCP servers from database
    const loadMcpServers = async () => {
      try {
        mcpConfigsManager.setTenantContext(tenantId);
        const mcpConfigs = await mcpConfigsManager.getAllMcpConfigs();
        
        // Transform database format to match existing interface
        const servers = mcpConfigs.map(config => ({
          id: config.server_id,
          name: config.display_name || config.custom_name || config.server_name,
          description: config.description,
          isEnabled: config.is_enabled,
          category: config.category,
          server_type: config.server_type,
          available_tools: config.available_tools || [],
          tenant_server_id: config.tenant_server_id
        }));
        
        setAvailableMcpServers(servers);
        console.log('✅ [AgentConfigModal] Loaded MCP servers from database:', servers);
      } catch (error) {
        console.error('❌ [AgentConfigModal] Failed to load MCP servers from database:', error);
        setAvailableMcpServers([]);
      }
    };
    loadMcpServers();

    // Load agent metrics if editing
    if (isEditing && agent) {
      const metricsService = createAgentMetricsService(tenantId);
      const metrics = metricsService.getAgentMetrics(agent.id);
      setAgentMetrics(metrics);
    }
  }, [tenantId, open, isEditing, agent]);

  // Initialize form data
  useEffect(() => {
    if (agent && isEditing) {
      setFormData({
        name: agent.name,
        description: agent.description,
        persona: (agent as any).persona || '',
        systemPrompt: agent.systemPrompt,
        llmConfigId: (agent as any).llmConfigId || '',
        enabledMcpServers: (agent as any).enabledMcpServers || [],
        capabilities: (agent as any).capabilities || [],
        useCase: (agent as any).useCase || '',
        avatar: (agent as any).avatar || '🤖',
        color: (agent as any).color || '#2563eb',
        isEnabled: agent.isEnabled
      });
    } else {
      // Reset to defaults
      setFormData({
        name: '',
        description: '',
        persona: '',
        systemPrompt: '',
        llmConfigId: '',
        enabledMcpServers: [],
        capabilities: [],
        useCase: '',
        avatar: '🤖',
        color: '#2563eb',
        isEnabled: true
      });
      setSelectedPreset(null);
    }
  }, [agent, isEditing, open]);

  const handlePresetSelect = (presetId: string) => {
    const preset = AGENT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedPreset(presetId);
      setFormData({
        ...formData,
        name: preset.name,
        description: preset.description,
        persona: preset.persona,
        systemPrompt: preset.systemPrompt,
        avatar: preset.avatar,
        color: preset.color
      });
    }
  };


  const handleMcpServerToggle = (serverId: string) => {
    setFormData(prev => {
      const currentServers = prev.enabledMcpServers || [];
      return {
        ...prev,
        enabledMcpServers: currentServers.includes(serverId)
          ? currentServers.filter(id => id !== serverId)
          : [...currentServers, serverId]
      };
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Agent name is required' });
      return;
    }

    if (!formData.llmConfigId) {
      setMessage({ type: 'error', text: 'LLM configuration is required' });
      return;
    }

    if ((formData.enabledMcpServers || []).length === 0) {
      setMessage({ type: 'error', text: 'At least one MCP server must be enabled' });
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      
      const agentService = createAgentService(tenantId);
      
      if (isEditing && agent) {
        await agentService.updateAgent(agent.id, formData);
        setMessage({ type: 'success', text: 'Agent updated successfully' });
      } else {
        await agentService.createAgent(formData);
        setMessage({ type: 'success', text: 'Agent created successfully' });
      }
      
      setTimeout(() => {
        onSave();
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('Error saving agent:', error);
      setMessage({ type: 'error', text: 'Failed to save agent. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agent || !isEditing) return;
    
    if (confirm(`Are you sure you want to delete the agent "${agent.name}"? This action cannot be undone.`)) {
      try {
        setIsSaving(true);
        const agentService = createAgentService(tenantId);
        await agentService.deleteAgent(agent.id);
        setMessage({ type: 'success', text: 'Agent deleted successfully' });
        
        setTimeout(() => {
          onSave();
          onClose();
        }, 1000);
        
      } catch (error) {
        console.error('Error deleting agent:', error);
        setMessage({ type: 'error', text: 'Failed to delete agent. Please try again.' });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const tabs = [
    { id: 'general' as TabType, label: 'General', icon: Bot },
    { id: 'persona' as TabType, label: 'Persona', icon: User },
    { id: 'integrations' as TabType, label: 'Integrations', icon: Database },
    { id: 'performance' as TabType, label: 'Performance', icon: Activity }
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {isEditing ? `Configure ${agent?.name}` : 'Create AI Agent'}
              </h2>
              <p className="text-sm text-gray-600">
                {isEditing ? 'Modify agent settings and capabilities' : 'Set up a new AI agent with custom configuration'}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="p-2">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b bg-gray-50">
          <div className="flex space-x-0 px-6">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Message */}
          {message && (
            <Alert className={`mb-4 ${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <div className="ml-2">
                <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {message.text}
                </p>
              </div>
            </Alert>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Agent Presets (only show when creating new agents) */}
              {!isEditing && (
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    <h3 className="text-lg font-medium">Start with a Preset</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {AGENT_PRESETS.map((preset) => (
                      <div
                        key={preset.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedPreset === preset.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handlePresetSelect(preset.id)}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-2xl">{preset.avatar}</span>
                          <div className="flex-1">
                            <h4 className="font-medium">{preset.name}</h4>
                            <p className="text-sm text-gray-600">{preset.description}</p>
                          </div>
                          {selectedPreset === preset.id && (
                            <CheckCircle className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">
                            {preset.avatar} {preset.name}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agent Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Risk Analysis Specialist"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Avatar
                    </label>
                    <div className="flex space-x-2">
                      {['🤖', '🛡️', '⚠️', '📋', '👔', '🔍', '⚡', '🎯'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setFormData({ ...formData, avatar: emoji })}
                          className={`p-2 border rounded-md text-xl hover:bg-gray-50 ${
                            formData.avatar === emoji ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief description of what this agent specializes in..."
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Use Case
                  </label>
                  <input
                    type="text"
                    value={formData.useCase}
                    onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., comprehensive-grc-analysis, risk-management"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Persona Tab */}
          {activeTab === 'persona' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Agent Persona & Behavior</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Persona Description
                    </label>
                    <textarea
                      value={formData.persona}
                      onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe the agent's personality and expertise (e.g., Professional, analytical, detail-oriented GRC expert with deep regulatory knowledge)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      System Prompt
                    </label>
                    <textarea
                      value={formData.systemPrompt}
                      onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Detailed instructions for how the agent should behave, its role, and response structure..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* LLM Configuration */}
              <div>
                <h3 className="text-lg font-medium mb-4">LLM Configuration</h3>
                {availableLlmConfigs.length > 0 ? (
                  <select
                    value={formData.llmConfigId}
                    onChange={(e) => setFormData({ ...formData, llmConfigId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select LLM Configuration...</option>
                    {availableLlmConfigs.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.name} ({config.provider} - {config.model})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <div className="ml-2">
                      <p className="text-sm text-yellow-800">
                        No LLM configurations available. Please configure at least one LLM in Settings first.
                      </p>
                    </div>
                  </Alert>
                )}
              </div>

              {/* MCP Server Access */}
              <div>
                <h3 className="text-lg font-medium mb-4">MCP Server Access</h3>
                {availableMcpServers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableMcpServers.map((server) => (
                      <div
                        key={server.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          (formData.enabledMcpServers || []).includes(server.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleMcpServerToggle(server.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{server.name}</h4>
                            <p className="text-sm text-gray-600">{server.description}</p>
                          </div>
                          {(formData.enabledMcpServers || []).includes(server.id) && (
                            <CheckCircle className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <div className="ml-2">
                      <p className="text-sm text-yellow-800">
                        No MCP servers available. Please configure at least one MCP server in Settings first.
                      </p>
                    </div>
                  </Alert>
                )}
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Performance Metrics</h3>
                {isEditing && agentMetrics ? (
                  <div className="space-y-4">
                    {/* Performance Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {agentMetrics.successRate}%
                        </div>
                        <div className="text-sm text-gray-600">Success Rate</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {agentMetrics.totalExecutions}
                        </div>
                        <div className="text-sm text-gray-600">Total Executions</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {agentMetrics.averageExecutionTime}s
                        </div>
                        <div className="text-sm text-gray-600">Avg Execution Time</div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div>
                      <h4 className="font-medium mb-3">Recent Activity</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {agentMetrics.executionHistory.slice(-10).reverse().map((execution: any) => (
                          <div key={execution.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center space-x-2">
                              {execution.success ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="text-sm">
                                {execution.success ? 'Success' : 'Failed'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(execution.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tools Used */}
                    <div>
                      <h4 className="font-medium mb-3">Frequently Used Tools</h4>
                      <div className="flex flex-wrap gap-2">
                        {agentMetrics.toolsUsed.map((tool: string, index: number) => (
                          <Badge key={`agent-tools-${tool}-${index}`} variant="outline" className="text-xs">
                            {tool.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="font-medium text-gray-600 mb-2">No Performance Data</h4>
                    <p className="text-sm text-gray-500">
                      Performance metrics will be available after the agent has been used.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isEditing && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={isSaving}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Agent
              </Button>
            )}
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>{isEditing ? 'Update Agent' : 'Create Agent'}</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentConfigModal;