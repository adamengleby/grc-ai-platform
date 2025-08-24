import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../../app/components/ui/Card';
import { Badge } from '../../../app/components/ui/Badge';
import { Button } from '../../../app/components/ui/Button';
import {
  TrendingUp,
  Shield,
  Settings,
  Users,
  Brain,
  CheckCircle,
  AlertCircle,
  Clock,
  Play,
  Pause
} from 'lucide-react';
import { AIAgent } from '../../../types/agent';
import { createAgentMetricsService, AgentMetrics } from '../../../lib/agentMetricsService';

interface AgentCardProps {
  agent: AIAgent;
  tenantId: string;
  onToggle: (agentId: string, enabled: boolean) => void;
  onConfigure: (agent: AIAgent) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ 
  agent, 
  tenantId, 
  onToggle, 
  onConfigure 
}) => {
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mcpServers, setMcpServers] = useState<any[]>([]);

  const agentIcons = {
    risk: TrendingUp,
    compliance: Shield,
    control: Settings,
    executive: Users,
    recommendation: Brain
  };

  // Determine agent type from use case or capabilities
  const getAgentType = (agent: AIAgent): keyof typeof agentIcons => {
    const useCase = agent.useCase.toLowerCase();
    if (useCase.includes('risk')) return 'risk';
    if (useCase.includes('compliance')) return 'compliance';
    if (useCase.includes('control')) return 'control';
    if (useCase.includes('executive')) return 'executive';
    return 'recommendation';
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load metrics
        const metricsService = createAgentMetricsService(tenantId);
        const agentMetrics = metricsService.getAgentMetrics(agent.id);
        setMetrics(agentMetrics);
        
        // Load MCP servers for this agent
        const mcpStorageKey = `tenant_mcp_servers_${tenantId}`;
        const allMcpServers = JSON.parse(localStorage.getItem(mcpStorageKey) || '[]');
        const enabledMcpServers = allMcpServers.filter((server: any) => 
          agent.enabledMcpServers.includes(server.id) && server.isEnabled
        );
        
        // If no MCP servers are found but agent has enabledMcpServers, show default servers
        if (enabledMcpServers.length === 0 && agent.enabledMcpServers.length > 0) {
          const defaultServers = agent.enabledMcpServers.map(serverId => ({
            id: serverId,
            name: serverId === 'archer-grc' ? 'Archer GRC Server' : serverId.replace(/^mcp-/, '').replace(/-/g, ' '),
            isEnabled: true
          }));
          setMcpServers(defaultServers);
        } else {
          setMcpServers(enabledMcpServers);
        }
        
      } catch (error) {
        console.error('Error loading agent data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Refresh data every 5 minutes for active agents
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, [agent.id, tenantId, agent.enabledMcpServers]);

  const formatLastExecution = (timestamp?: string): string => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const execTime = new Date(timestamp);
    const diffMs = now.getTime() - execTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return execTime.toLocaleDateString();
  };

  const getStatusColor = (isEnabled: boolean) => {
    return isEnabled ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (isEnabled: boolean) => {
    return isEnabled ? (
      <CheckCircle className="h-4 w-4" />
    ) : (
      <AlertCircle className="h-4 w-4" />
    );
  };

  const IconComponent = agentIcons[getAgentType(agent)];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-lg ${
              agent.isEnabled ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              <IconComponent className={`h-6 w-6 ${
                agent.isEnabled ? 'text-blue-600' : 'text-gray-400'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
                <Badge variant="outline" className={getStatusColor(agent.isEnabled)}>
                  {getStatusIcon(agent.isEnabled)}
                  <span className="ml-1 capitalize">
                    {agent.isEnabled ? 'Active' : 'Inactive'}
                  </span>
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{agent.description}</p>
            </div>
          </div>
        </div>

        {/* Specialization */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-600 mb-1">Specialization</p>
          <p className="text-sm text-gray-800">{agent.persona}</p>
        </div>

        {/* Available Tools */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-600 mb-2">Available Tools</p>
          <div className="flex flex-wrap gap-1">
            {isLoading ? (
              <Badge variant="secondary" className="text-xs">
                Loading tools...
              </Badge>
            ) : mcpServers.length > 0 ? (
              mcpServers.map((server) => (
                <Badge key={server.id} variant="secondary" className="text-xs">
                  {server.name}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-xs text-gray-500">
                No MCP servers enabled
              </Badge>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        {!isLoading && metrics && (
          <div className="grid grid-cols-3 gap-4 text-center border-t pt-4 mb-4">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {metrics.successRate}%
              </p>
              <p className="text-xs text-gray-500">Success Rate</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {metrics.totalExecutions}
              </p>
              <p className="text-xs text-gray-500">Executions</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {metrics.averageExecutionTime}s
              </p>
              <p className="text-xs text-gray-500">Avg Time</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-3 gap-4 text-center border-t pt-4 mb-4">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-1"></div>
              <p className="text-xs text-gray-500">Success Rate</p>
            </div>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-1"></div>
              <p className="text-xs text-gray-500">Executions</p>
            </div>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-1"></div>
              <p className="text-xs text-gray-500">Avg Time</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500 flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Last execution: {formatLastExecution(metrics?.lastExecution)}</span>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggle(agent.id, !agent.isEnabled)}
              className="text-xs"
            >
              {agent.isEnabled ? (
                <>
                  <Pause className="h-3 w-3 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Activate
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConfigure(agent)}
              className="text-xs"
            >
              <Settings className="h-3 w-3 mr-1" />
              Configure
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentCard;