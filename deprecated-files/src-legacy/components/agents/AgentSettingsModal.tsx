import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import {
  Settings,
  User,
  Database,
  Activity,
  Clock,
  X,
  Check,
  AlertCircle,
  Shield
} from 'lucide-react';
import { AIAgent, AGENT_CAPABILITIES } from '@/types/agent';
import { createAgentService } from '@/lib/agentService';

interface AgentSettingsModalProps {
  agent: AIAgent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: AIAgent) => void;
  tenantId: string;
}

export const AgentSettingsModal: React.FC<AgentSettingsModalProps> = ({
  agent,
  isOpen,
  onClose,
  onSave,
  tenantId
}) => {
  const [editedAgent, setEditedAgent] = useState<AIAgent | null>(null);
  const [availableLlmConfigs, setAvailableLlmConfigs] = useState<any[]>([]);
  const [availableMcpServers, setAvailableMcpServers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (agent && isOpen) {
      setEditedAgent({ ...agent });
      loadAvailableConfigs();
    }
  }, [agent, isOpen, tenantId]);

  const loadAvailableConfigs = async () => {
    try {
      // Load available LLM configs
      const llmStorageKey = `user_llm_configs_${tenantId}`;
      const llmConfigs = JSON.parse(localStorage.getItem(llmStorageKey) || '[]');
      setAvailableLlmConfigs(llmConfigs);

      // Load available MCP servers
      const mcpStorageKey = `user_mcp_servers_${tenantId}`;
      const mcpServers = JSON.parse(localStorage.getItem(mcpStorageKey) || '[]');
      setAvailableMcpServers(mcpServers);
    } catch (error) {
      console.error('Error loading configurations:', error);
    }
  };

  const handleSave = async () => {
    if (!editedAgent) return;

    try {
      setIsSaving(true);
      const agentService = createAgentService(tenantId);
      const updatedAgent = await agentService.updateAgent(editedAgent.id, editedAgent);
      
      if (updatedAgent) {
        onSave(updatedAgent);
        onClose();
      }
    } catch (error) {
      console.error('Error saving agent:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCapabilityToggle = (capabilityId: string) => {
    if (!editedAgent) return;

    const updatedCapabilities = editedAgent.capabilities.includes(capabilityId)
      ? editedAgent.capabilities.filter(id => id !== capabilityId)
      : [...editedAgent.capabilities, capabilityId];

    setEditedAgent({
      ...editedAgent,
      capabilities: updatedCapabilities
    });
  };

  const handleMcpServerToggle = (serverId: string) => {
    if (!editedAgent) return;

    const updatedServers = editedAgent.enabledMcpServers.includes(serverId)
      ? editedAgent.enabledMcpServers.filter(id => id !== serverId)
      : [...editedAgent.enabledMcpServers, serverId];

    setEditedAgent({
      ...editedAgent,
      enabledMcpServers: updatedServers
    });
  };

  if (!agent || !editedAgent) {
    return null;
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'persona', label: 'Persona', icon: User },
    { id: 'capabilities', label: 'Capabilities', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Database },
    { id: 'performance', label: 'Performance', icon: Activity }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl" showClose={false}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{agent.avatar || '🤖'}</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Agent Settings</h2>
              <p className="text-sm text-gray-600">{agent.name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1">
          {/* Sidebar Tabs */}
          <div className="w-64 border-r border-gray-200 bg-gray-50">
            <nav className="p-4 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Agent Name</Label>
                        <Input
                          id="name"
                          value={editedAgent.name}
                          onChange={(e) => setEditedAgent({ ...editedAgent, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="avatar">Avatar (Emoji)</Label>
                        <Input
                          id="avatar"
                          value={editedAgent.avatar || ''}
                          onChange={(e) => setEditedAgent({ ...editedAgent, avatar: e.target.value })}
                          placeholder="🤖"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={editedAgent.description}
                        onChange={(e) => setEditedAgent({ ...editedAgent, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Persona Tab */}
              {activeTab === 'persona' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Agent Persona</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="persona">Personality Description</Label>
                        <Textarea
                          id="persona"
                          value={editedAgent.persona}
                          onChange={(e) => setEditedAgent({ ...editedAgent, persona: e.target.value })}
                          rows={4}
                          placeholder="Describe the agent's personality and approach..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="systemPrompt">System Prompt</Label>
                        <Textarea
                          id="systemPrompt"
                          value={editedAgent.systemPrompt}
                          onChange={(e) => setEditedAgent({ ...editedAgent, systemPrompt: e.target.value })}
                          rows={8}
                          placeholder="Define how the agent should behave and respond..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Capabilities Tab */}
              {activeTab === 'capabilities' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Agent Capabilities</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {AGENT_CAPABILITIES.map((capability) => (
                        <div
                          key={capability.id}
                          className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                            editedAgent.capabilities.includes(capability.id)
                              ? 'border-blue-200 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleCapabilityToggle(capability.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded ${
                                  editedAgent.capabilities.includes(capability.id)
                                    ? 'bg-blue-100' : 'bg-gray-100'
                                }`}>
                                  <Shield className={`h-4 w-4 ${
                                    editedAgent.capabilities.includes(capability.id)
                                      ? 'text-blue-600' : 'text-gray-600'
                                  }`} />
                                </div>
                                <div>
                                  <h4 className="font-medium">{capability.name}</h4>
                                  <p className="text-sm text-gray-600">{capability.description}</p>
                                </div>
                              </div>
                            </div>
                            {editedAgent.capabilities.includes(capability.id) && (
                              <Check className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">LLM Configuration</h3>
                    <div className="space-y-3">
                      {availableLlmConfigs.map((config) => (
                        <div
                          key={config.id}
                          className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                            editedAgent.llmConfigId === config.id
                              ? 'border-blue-200 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setEditedAgent({ ...editedAgent, llmConfigId: config.id })}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{config.name}</h4>
                              <p className="text-sm text-gray-600">{config.provider} - {config.model}</p>
                            </div>
                            {editedAgent.llmConfigId === config.id && (
                              <Check className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">MCP Servers</h3>
                    <div className="space-y-3">
                      {availableMcpServers.map((server) => (
                        <div
                          key={server.id}
                          className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                            editedAgent.enabledMcpServers.includes(server.id)
                              ? 'border-green-200 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleMcpServerToggle(server.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{server.name}</h4>
                              <p className="text-sm text-gray-600">{server.description}</p>
                              <Badge 
                                variant={server.isEnabled ? 'default' : 'secondary'} 
                                className="mt-2"
                              >
                                {server.isEnabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </div>
                            {editedAgent.enabledMcpServers.includes(server.id) && (
                              <Check className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Performance Overview</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Activity className="h-4 w-4 text-green-500" />
                          <span className="font-medium">Success Rate</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                          {agent.metrics?.successRate.toFixed(1) || '0.0'}%
                        </p>
                        <p className="text-sm text-gray-600">
                          {agent.metrics?.successfulExecutions || 0} of {agent.metrics?.totalExecutions || 0} executions
                        </p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Average Time</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                          {agent.metrics?.averageExecutionTime.toFixed(1) || '0.0'}s
                        </p>
                        <p className="text-sm text-gray-600">
                          Last execution: {agent.metrics?.lastExecutionTime?.toFixed(1) || '0.0'}s
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Recent Performance</h4>
                    <div className="space-y-2">
                      {agent.metrics?.executionHistory.slice(0, 5).map((execution) => (
                        <div key={execution.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex items-center space-x-3">
                            {execution.status === 'success' ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">{new Date(execution.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {execution.duration.toFixed(1)}s
                          </div>
                        </div>
                      )) || (
                        <p className="text-sm text-gray-600">No execution history available</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-between">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentSettingsModal;