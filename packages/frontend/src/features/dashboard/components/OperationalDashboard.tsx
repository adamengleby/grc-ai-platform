import React, { useState } from 'react';
import { useDashboardStore } from '@/app/store/dashboard';
import { useAuthStore } from '@/app/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import {
  Bot,
  Play,
  Pause,
  Settings,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Zap,
  Database,
  // Shield,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';

/**
 * Operational Dashboard - Agent management and monitoring for Agent Users
 * Shows agent status, recent queries, and operational metrics
 */
export const OperationalDashboard: React.FC = () => {
  const { agents, agentHealth, recentQueries, metrics } = useDashboardStore();
  const { tenant } = useAuthStore();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  if (!tenant) return null;

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string, isActive: boolean) => {
    if (!isActive) return 'text-gray-500';
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'unhealthy':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getQueryStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operational Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage and monitor your AI agents and MCP tools
          </p>
        </div>
        <Button className="flex items-center space-x-2">
          <MessageSquare className="h-4 w-4" />
          <span>New GRC Query</span>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.activeAgents}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.healthyAgents} healthy, {metrics.totalAgents - metrics.activeAgents} paused
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queries Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.todayQueries}
            </div>
            <p className="text-xs text-muted-foreground">
              +{Math.floor(metrics.weeklyGrowth)}% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(metrics.averageResponseTime)}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Within SLA targets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.tokenUsage.percentage.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.tokenUsage.current.toLocaleString()} of {metrics.tokenUsage.limit.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Agents List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bot className="h-5 w-5" />
                <span>AI Agents</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agents.map((agent) => {
                  const health = agentHealth[agent.agentId];
                  return (
                    <div
                      key={agent.agentId}
                      className={clsx(
                        'p-4 border rounded-lg cursor-pointer transition-colors',
                        selectedAgent === agent.agentId
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      )}
                      onClick={() => setSelectedAgent(
                        selectedAgent === agent.agentId ? null : agent.agentId
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            {getHealthIcon(health?.status || 'unknown')}
                            <h3 className="font-medium">{agent.name}</h3>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant={agent.isActive ? "destructive" : "default"}
                              className="h-7 px-2 text-xs"
                            >
                              {agent.isActive ? (
                                <>
                                  <Pause className="h-3 w-3 mr-1" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 mr-1" />
                                  Start
                                </>
                              )}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2">
                              <Settings className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={clsx(
                            'text-sm font-medium',
                            getStatusColor(health?.status || 'unknown', agent.isActive)
                          )}>
                            {agent.isActive ? health?.status || 'unknown' : 'paused'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {health?.responseTime}ms avg
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-2 mb-3">
                        {agent.description}
                      </p>

                      {selectedAgent === agent.agentId && (
                        <div className="border-t pt-3 space-y-2">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Model:</span> {agent.llmConfig.model}
                            </div>
                            <div>
                              <span className="font-medium">Audit Level:</span> {agent.auditLevel}
                            </div>
                            <div>
                              <span className="font-medium">Rate Limit:</span> {agent.rateLimits.requestsPerMinute}/min
                            </div>
                            <div>
                              <span className="font-medium">Uptime:</span> {((health?.uptime || 0) * 100).toFixed(1)}%
                            </div>
                          </div>
                          
                          <div>
                            <span className="font-medium text-sm">Enabled Tools:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {agent.enabledTools.map((tool) => (
                                <span
                                  key={tool}
                                  className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
                                >
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Last updated {formatDistanceToNow(new Date(agent.updatedAt))} ago
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Recent Queries</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentQueries.map((query) => (
                  <div key={query.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {query.query}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {agents.find(a => a.agentId === query.agentId)?.name}
                        </p>
                      </div>
                      <span className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium shrink-0 ml-2',
                        getQueryStatusBadge(query.status)
                      )}>
                        {query.status}
                      </span>
                    </div>
                    
                    {query.response && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <div className="flex items-center space-x-4 text-muted-foreground mb-1">
                          <span>Confidence: {Math.round(query.response.confidence * 100)}%</span>
                          <span>Tokens: {query.response.tokenUsage.totalTokens}</span>
                          <span>Cost: ${query.response.tokenUsage.cost.toFixed(4)}</span>
                        </div>
                        <p className="line-clamp-2">
                          {query.response.content}
                        </p>
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(query.timestamp))} ago
                    </div>
                  </div>
                ))}
              </div>
              
              <Button variant="outline" className="w-full mt-4" size="sm">
                View All Queries
              </Button>
            </CardContent>
          </Card>

          {/* Resource Usage */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Resource Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>API Calls</span>
                    <span>{metrics.apiCalls.current.toLocaleString()} / {metrics.apiCalls.limit.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${metrics.apiCalls.percentage}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Tokens</span>
                    <span>{metrics.tokenUsage.current.toLocaleString()} / {metrics.tokenUsage.limit.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${metrics.tokenUsage.percentage}%` }}
                    />
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Monthly Budget</span>
                    <span className="font-medium">$2,940 / $4,800</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    $1,860 remaining this month
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};