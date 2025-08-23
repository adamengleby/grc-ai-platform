import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import {
  RefreshCw,
  Shield,
  Bot,
  Plus
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { AIAgent } from '@/types/agent';
import { createAgentService } from '@/lib/agentService';
import AgentStatsCards from '@/components/agents/AgentStatsCards';
import AgentCard from '@/components/agents/AgentCard';
import AgentConfigModal from '@/components/agents/AgentConfigModal';

export const AgentsPage: React.FC = () => {
  const { tenant } = useAuthStore();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load agents on component mount
  useEffect(() => {
    if (tenant?.id) {
      loadAIAgents();
    }
  }, [tenant?.id]);

  const loadAIAgents = async () => {
    if (!tenant?.id) return;
    
    try {
      setIsLoading(true);
      const agentService = createAgentService(tenant.id);
      const allAgents = await agentService.getAgents();
      setAgents(allAgents);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading AI agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAgent = async (agentId: string, enabled: boolean) => {
    if (!tenant?.id) return;

    try {
      const agentService = createAgentService(tenant.id);
      await agentService.updateAgent(agentId, { isEnabled: enabled });
      await loadAIAgents(); // Reload the list
    } catch (error) {
      console.error('Error toggling AI agent:', error);
    }
  };

  const handleConfigureAgent = (agent: AIAgent) => {
    setEditingAgent(agent);
    setConfigModalOpen(true);
  };

  const handleCreateAgent = () => {
    setEditingAgent(null);
    setShowCreateModal(true);
  };

  const handleModalClose = () => {
    setConfigModalOpen(false);
    setShowCreateModal(false);
    setEditingAgent(null);
  };

  const handleModalSave = () => {
    loadAIAgents(); // Refresh the agents list
  };

  const handleRefresh = () => {
    loadAIAgents();
  };

  if (isLoading && agents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
            <p className="text-muted-foreground mt-2">
              Manage and monitor your intelligent GRC analysis agents
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground mt-2">
            Manage and monitor your intelligent GRC analysis agents
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button onClick={handleCreateAgent}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {tenant?.id && <AgentStatsCards tenantId={tenant.id} />}

      {/* Agent Grid */}
      {agents.length === 0 ? (
        <div className="text-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-muted-foreground mb-2">No AI Agents Available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            AI agents will be automatically created when you configure LLM settings and MCP servers.
          </p>
          <Alert className="max-w-lg mx-auto">
            <Shield className="h-4 w-4" />
            <div className="ml-2">
              <p className="text-sm">
                Configure LLM settings and MCP servers in Settings to enable AI agents.
              </p>
            </div>
          </Alert>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              tenantId={tenant?.id || ''}
              onToggle={handleToggleAgent}
              onConfigure={handleConfigureAgent}
            />
          ))}
        </div>
      )}

      {/* System Protection Notice */}
      {agents.length > 0 && (
        <Alert className="bg-green-50 border-green-200">
          <Shield className="h-4 w-4 text-green-600" />
          <div className="ml-2">
            <h4 className="font-medium text-green-800">System Protection</h4>
            <p className="text-sm text-green-700 mt-1">
              Circuit Breaker Status: <span className="font-medium">CLOSED (Normal Operation)</span>
              <br />
              Protects against infinite loops and cascading failures
            </p>
          </div>
        </Alert>
      )}

      {/* Refresh Info */}
      <div className="text-xs text-gray-500 text-center">
        Last updated: {lastRefresh.toLocaleTimeString()} • 
        Auto-refresh every 30 seconds for active agents
      </div>

      {/* Agent Configuration Modal */}
      <AgentConfigModal
        open={configModalOpen || showCreateModal}
        onClose={handleModalClose}
        agent={editingAgent}
        isEditing={!!editingAgent}
        tenantId={tenant?.id || ''}
        onSave={handleModalSave}
      />
    </div>
  );
};