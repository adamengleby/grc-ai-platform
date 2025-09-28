import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../../app/components/ui/Card';
import { Badge } from '../../../app/components/ui/Badge';
import { Button } from '../../../app/components/ui/Button';
import { StatusBadge } from '../../../app/components/ui/StatusBadge';
import { ProgressBar } from '../../../app/components/ui/ProgressBar';
import {
  TrendingUp,
  Shield,
  Settings,
  Users,
  Brain,
  Clock,
  Play,
  Pause,
  MessageSquare
} from 'lucide-react';
import { AIAgent } from '../../../types/agent';
import { createAgentMetricsService, AgentMetrics } from '../../../lib/agentMetricsService';
import { mcpConfigsManager } from '../../../lib/backendMcpConfigsApi';

interface AgentCardProps {
  agent: AIAgent;
  tenantId: string;
  onToggle: (agentId: string, enabled: boolean) => void;
  onConfigure: (agent: AIAgent) => void;
  onChat?: (agent: AIAgent) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ 
  agent, 
  tenantId, 
  onToggle, 
  onConfigure,
  onChat
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

  // Determine agent type from use case, name, or description
  const getAgentType = (agent: AIAgent): keyof typeof agentIcons => {
    const searchText = [
      agent.name || '',
      agent.description || '',
      agent.persona || '',
      // Safe access to useCase if it exists
      (agent as any).useCase || ''
    ].filter(Boolean).join(' ').toLowerCase();

    if (searchText.includes('risk')) return 'risk';
    if (searchText.includes('compliance')) return 'compliance';
    if (searchText.includes('control')) return 'control';
    if (searchText.includes('executive')) return 'executive';
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
        
        // Load MCP servers for this agent from database
        const enabledMcpServerIds = agent.enabledMcpServers || [];
        if (enabledMcpServerIds.length > 0) {
          try {
            // Set tenant context for MCP configs API
            mcpConfigsManager.setTenantContext(tenantId);
            
            // Get all MCP configurations from database
            const allMcpConfigs = await mcpConfigsManager.getAllMcpConfigs();
            
            // Filter to only enabled servers that are in this agent's enabledMcpServers
            const enabledMcpServers = allMcpConfigs
              .filter(config => 
                enabledMcpServerIds.includes(config.server_id) && config.is_enabled
              )
              .map(config => ({
                id: config.server_id,
                name: config.display_name || config.custom_name || config.server_name,
                isEnabled: config.is_enabled
              }));
            
            setMcpServers(enabledMcpServers);
            console.log('✅ [AgentCard] Loaded MCP servers from database:', enabledMcpServers);
          } catch (error) {
            console.error('❌ [AgentCard] Failed to load MCP servers from database:', error);
            // Fallback: show server IDs with friendly names
            const fallbackServers = enabledMcpServerIds.map(serverId => ({
              id: serverId,
              name: serverId === 'archer-grc' ? 'Archer GRC Server' : 
                    serverId === 'filesystem' ? 'File System' :
                    serverId.replace(/^mcp-/, '').replace(/-/g, ' '),
              isEnabled: true
            }));
            setMcpServers(fallbackServers);
          }
        } else {
          setMcpServers([]);
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
  }, [agent.id, tenantId]);

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


  const IconComponent = agentIcons[getAgentType(agent)];

  return (
    <Card variant="clean" className="hover:card-elevated transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-xl ${
              agent.isEnabled ? 'bg-primary/10' : 'bg-muted'
            }`}>
              <IconComponent className={`h-6 w-6 ${
                agent.isEnabled ? 'text-primary' : 'text-muted-foreground'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-lg font-semibold text-foreground">{agent.name}</h3>
                <StatusBadge 
                  status={agent.isEnabled ? 'good' : 'pending'}
                  label={agent.isEnabled ? 'Active' : 'Inactive'}
                  size="sm"
                />
              </div>
              <p className="text-sm text-muted-foreground">{agent.description}</p>
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
          <div className="border-t pt-4 mb-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">
                  {metrics.successRate}%
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">
                  {metrics.totalExecutions}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Executions</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">
                  {metrics.averageExecutionTime}s
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg Time</div>
              </div>
            </div>
            <ProgressBar 
              value={metrics.successRate} 
              status={metrics.successRate >= 90 ? 'good' : metrics.successRate >= 70 ? 'medium' : 'critical'}
              showLabel={false}
              size="sm"
            />
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
          <div className="text-sm text-muted-foreground flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Last execution: {formatLastExecution(metrics?.lastExecution)}</span>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('[AgentCard] Toggle clicked - agent.id:', agent.id, 'agent:', agent);
                onToggle(agent.id, !agent.isEnabled);
              }}
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
            {onChat && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChat(agent)}
                disabled={!agent.isEnabled}
                className="text-xs"
                title={agent.isEnabled ? `Chat with ${agent.name}` : "Enable agent to chat"}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Chat
              </Button>
            )}
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