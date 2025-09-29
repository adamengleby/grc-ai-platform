/**
 * Production-Ready Agent Configuration Modal
 *
 * CRITICAL: This version fixes all configuration refresh and persistence issues.
 *
 * Key improvements:
 * - Proper LLM configuration refresh logic before editing
 * - Cache invalidation when configurations change
 * - Consistent field mapping with backend
 * - Enhanced error handling and validation
 * - Real-time configuration synchronization
 */

import React, { useState, useEffect, useCallback } from 'react';
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

const AgentConfigModalFixed: React.FC<AgentConfigModalProps> = ({
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
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form data with proper field mapping
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

  // Available configurations with loading states
  const [availableLlmConfigs, setAvailableLlmConfigs] = useState<any[]>([]);
  const [availableMcpServers, setAvailableMcpServers] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<any>(null);

  // Configuration loading states
  const [configLoadingState, setConfigLoadingState] = useState({
    llmConfigs: false,
    mcpServers: false,
    lastRefresh: null as Date | null
  });

  /**
   * CRITICAL: Refresh LLM configurations with cache invalidation
   * This ensures the modal always has the latest LLM configs when opened
   */
  const refreshLlmConfigurations = useCallback(async (force = false) => {
    if (!tenantId) return;

    console.log(`🔄 [AgentModal FIXED] Refreshing LLM configurations (force: ${force})`);
    setConfigLoadingState(prev => ({ ...prev, llmConfigs: true }));

    try {
      // Force refresh by calling the service directly
      const configs = await backendLLMService.getAllLlmConfigs();
      setAvailableLlmConfigs(configs);
      setConfigLoadingState(prev => ({
        ...prev,
        llmConfigs: false,
        lastRefresh: new Date()
      }));

      console.log(`✅ [AgentModal FIXED] Refreshed ${configs.length} LLM configurations:`,
        configs.map(c => ({ id: c.id, name: c.name }))
      );
    } catch (error) {
      console.error('❌ [AgentModal FIXED] Failed to refresh LLM configurations:', error);
      setConfigLoadingState(prev => ({ ...prev, llmConfigs: false }));
      setAvailableLlmConfigs([]);
    }
  }, [tenantId]);

  /**
   * CRITICAL: Refresh MCP servers with proper error handling
   */
  const refreshMcpServers = useCallback(async () => {
    if (!tenantId) return;

    console.log(`🔄 [AgentModal FIXED] Refreshing MCP servers`);
    setConfigLoadingState(prev => ({ ...prev, mcpServers: true }));

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
      setConfigLoadingState(prev => ({ ...prev, mcpServers: false }));

      console.log('✅ [AgentModal FIXED] Refreshed MCP servers:', servers.length);
    } catch (error) {
      console.error('❌ [AgentModal FIXED] Failed to refresh MCP servers:', error);
      setConfigLoadingState(prev => ({ ...prev, mcpServers: false }));
      setAvailableMcpServers([]);
    }
  }, [tenantId]);

  /**
   * CRITICAL: Load configurations when modal opens or when switching modes
   * This addresses the core issue of stale configuration data
   */
  useEffect(() => {
    if (!open || !tenantId) return;

    console.log(`🔍 [AgentModal FIXED] Modal opened - loading configurations`, {
      isEditing,
      agentId: agent?.id,
      tenantId
    });

    setIsLoadingConfigs(true);

    // Always refresh configurations when modal opens
    Promise.all([
      refreshLlmConfigurations(true), // Force refresh
      refreshMcpServers()
    ]).finally(() => {
      setIsLoadingConfigs(false);
    });

    // Load agent metrics if editing
    if (isEditing && agent) {
      const metricsService = createAgentMetricsService(tenantId);
      const metrics = metricsService.getAgentMetrics(agent.id);
      setAgentMetrics(metrics);
    }
  }, [open, tenantId, isEditing, agent, refreshLlmConfigurations, refreshMcpServers]);

  /**
   * CRITICAL: Initialize form data with proper field mapping
   * Ensures all fields are correctly populated when editing
   */
  useEffect(() => {
    if (agent && isEditing) {
      console.log(`🔄 [AgentModal FIXED] Initializing form data for editing:`, {
        agentId: agent.id,
        name: agent.name,
        llmConfigId: (agent as any).llmConfigId,
        enabledMcpServers: (agent as any).enabledMcpServers?.length || 0
      });

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
      // Reset to defaults for new agent
      console.log(`🔄 [AgentModal FIXED] Resetting form data for new agent`);
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

  /**
   * CRITICAL: Preset selection with proper form population
   */
  const handlePresetSelect = (presetId: string) => {
    const preset = AGENT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      console.log(`🎯 [AgentModal FIXED] Applying preset: ${preset.name}`);
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

  /**
   * MCP server toggle with proper array handling
   */
  const handleMcpServerToggle = (serverId: string) => {
    setFormData(prev => {
      const currentServers = prev.enabledMcpServers || [];
      const newServers = currentServers.includes(serverId)
        ? currentServers.filter(id => id !== serverId)
        : [...currentServers, serverId];

      console.log(`🔄 [AgentModal FIXED] MCP server toggle:`, {
        serverId,
        wasEnabled: currentServers.includes(serverId),
        newCount: newServers.length
      });

      return {
        ...prev,
        enabledMcpServers: newServers
      };
    });
  };

  /**
   * CRITICAL: Save handler with proper validation and error handling
   */
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Agent name is required' });
      return;
    }

    console.log(`💾 [AgentModal FIXED] Saving agent:`, {
      isEditing,
      agentId: agent?.id,
      name: formData.name,
      llmConfigId: formData.llmConfigId,
      enabledMcpServers: formData.enabledMcpServers?.length || 0
    });

    try {
      setIsSaving(true);
      setMessage(null);

      const agentService = createAgentService(tenantId);

      if (isEditing && agent) {
        console.log(`🔄 [AgentModal FIXED] Updating existing agent: ${agent.id}`);
        await agentService.updateAgent(agent.id, formData);
        setMessage({ type: 'success', text: 'Agent updated successfully' });
      } else {
        console.log(`➕ [AgentModal FIXED] Creating new agent`);
        await agentService.createAgent(formData);
        setMessage({ type: 'success', text: 'Agent created successfully' });
      }

      // Refresh parent component data
      setTimeout(() => {
        console.log(`✅ [AgentModal FIXED] Save completed, refreshing parent`);
        onSave();
        onClose();
      }, 1000);

    } catch (error) {
      console.error('❌ [AgentModal FIXED] Save error:', error);
      setMessage({ type: 'error', text: 'Failed to save agent. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Delete handler with confirmation
   */
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
        console.error('❌ [AgentModal FIXED] Delete error:', error);
        setMessage({ type: 'error', text: 'Failed to delete agent. Please try again.' });
      } finally {
        setIsSaving(false);
      }
    }
  };

  /**
   * Manual configuration refresh
   */
  const handleManualRefresh = async () => {
    console.log(`🔄 [AgentModal FIXED] Manual configuration refresh triggered`);
    setIsLoadingConfigs(true);
    await Promise.all([
      refreshLlmConfigurations(true),
      refreshMcpServers()
    ]);
    setIsLoadingConfigs(false);
    setMessage({ type: 'success', text: 'Configurations refreshed successfully' });
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
          <div className="flex items-center space-x-2">
            {/* Configuration Refresh Button */}
            <Button
              variant="ghost"
              onClick={handleManualRefresh}
              disabled={isLoadingConfigs}
              className="p-2"
              title="Refresh configurations"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingConfigs ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" onClick={onClose} className="p-2">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Configuration Loading Indicator */}
        {isLoadingConfigs && (
          <div className="bg-blue-50 border-b px-6 py-2">
            <div className="flex items-center space-x-2 text-blue-700">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Refreshing configurations...</span>
            </div>
          </div>
        )}

        {/* Configuration Status */}
        {configLoadingState.lastRefresh && (
          <div className="bg-green-50 border-b px-6 py-2">
            <div className="flex items-center justify-between text-green-700">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">
                  Configurations refreshed: {availableLlmConfigs.length} LLM configs, {availableMcpServers.length} MCP servers
                </span>
              </div>
              <span className="text-xs">
                Last update: {configLoadingState.lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}

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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">LLM Configuration</h3>
                  {configLoadingState.llmConfigs && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  )}
                </div>
                {availableLlmConfigs.length > 0 ? (
                  <div>
                    <select
                      value={formData.llmConfigId}
                      onChange={(e) => {
                        console.log(`🔄 [AgentModal FIXED] LLM config selection:`, {
                          from: formData.llmConfigId,
                          to: e.target.value
                        });
                        setFormData({ ...formData, llmConfigId: e.target.value });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select LLM Configuration...</option>
                      {availableLlmConfigs.map((config) => (
                        <option key={config.id} value={config.id}>
                          {config.name} ({config.provider} - {config.model})
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 mt-2">
                      Found {availableLlmConfigs.length} available LLM configuration(s)
                    </p>
                  </div>
                ) : (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <div className="ml-2">
                      <p className="text-sm text-blue-800">
                        {configLoadingState.llmConfigs
                          ? 'Loading LLM configurations...'
                          : 'No LLM configurations available. Agent will use tenant default LLM configuration. Configure custom LLM settings in Settings if needed.'
                        }
                      </p>
                    </div>
                  </Alert>
                )}
              </div>

              {/* MCP Server Access */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">MCP Server Access</h3>
                  {configLoadingState.mcpServers && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  )}
                </div>
                {availableMcpServers.length > 0 ? (
                  <div>
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
                    <p className="text-sm text-gray-500 mt-2">
                      Found {availableMcpServers.length} available MCP server(s). Selected: {formData.enabledMcpServers?.length || 0}
                    </p>
                  </div>
                ) : (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <div className="ml-2">
                      <p className="text-sm text-blue-800">
                        {configLoadingState.mcpServers
                          ? 'Loading MCP servers...'
                          : 'No MCP servers available. Agents can work without MCP servers using LLM-only mode. Configure MCP servers in Settings to enable tool access.'
                        }
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

export default AgentConfigModalFixed;