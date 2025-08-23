import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import { 
  TenantUsageSummary,
  McpToolAnalytics,
  TenantMcpToolConfiguration 
} from '@/types/mcp';
import {
  DollarSign,
  Zap,
  Activity,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Info
} from 'lucide-react';
import { clsx } from 'clsx';

interface McpUsageAnalyticsProps {
  tenantId: string;
  enabledTools: TenantMcpToolConfiguration[];
  period?: { start: string; end: string };
}

export const McpUsageAnalytics: React.FC<McpUsageAnalyticsProps> = ({
  tenantId,
  enabledTools,
  period = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString()
  }
}) => {
  const [usageSummary, setUsageSummary] = useState<TenantUsageSummary | null>(null);
  const [_toolAnalytics, setToolAnalytics] = useState<McpToolAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsageData();
  }, [tenantId, enabledTools, period]);

  const loadUsageData = async () => {
    setIsLoading(true);
    
    // Simulate loading usage data (in production, this would come from the backend)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock usage summary
    const mockSummary: TenantUsageSummary = {
      tenantId,
      period,
      summary: {
        totalCost: 147.85,
        totalTokens: 2450000,
        totalExecutions: 1247,
        enabledTools: enabledTools.length,
        mostUsedTool: 'generate_insights',
        costByTier: {
          free: 0,
          standard: 89.50,
          premium: 58.35
        }
      },
      toolBreakdown: enabledTools.map((tool, _index) => {
        const baseExecutions = Math.floor(Math.random() * 500) + 50;
        const tokens = baseExecutions * (Math.floor(Math.random() * 2000) + 500);
        const errorRate = Math.random() * 0.15; // 0-15% error rate
        
        return {
          toolId: tool.toolId,
          toolName: tool.toolId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          executions: baseExecutions,
          tokens,
          cost: tokens * 0.00006, // $0.06 per 1k tokens
          errorRate: errorRate
        };
      }),
      alerts: [
        {
          type: 'rate_limit_approached',
          severity: 'medium',
          message: 'Generate Insights tool approaching daily rate limit',
          recommendation: 'Consider upgrading rate limits or distributing usage'
        },
        {
          type: 'high_error_rate',
          severity: 'high',
          message: 'Risk Assessment tool has 12% error rate in last 7 days',
          recommendation: 'Check connection configuration and review input validation'
        }
      ]
    };

    // Generate mock analytics for each tool
    const mockAnalytics: McpToolAnalytics[] = enabledTools.map(tool => ({
      tenantId,
      toolId: tool.toolId,
      period,
      metrics: {
        totalExecutions: Math.floor(Math.random() * 500) + 100,
        successfulExecutions: Math.floor(Math.random() * 450) + 90,
        failedExecutions: Math.floor(Math.random() * 50) + 5,
        totalTokens: Math.floor(Math.random() * 500000) + 100000,
        totalCost: Math.random() * 50 + 10,
        averageExecutionTime: Math.floor(Math.random() * 2000) + 500,
        uniqueUsers: Math.floor(Math.random() * 10) + 3
      },
      trends: {
        dailyExecutions: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          executions: Math.floor(Math.random() * 50) + 10,
          tokens: Math.floor(Math.random() * 50000) + 10000,
          cost: Math.random() * 5 + 1
        })),
        errorRate: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          rate: Math.random() * 0.2
        }))
      },
      topUsers: [
        {
          userId: 'user-1',
          userName: 'Sarah Johnson',
          executions: Math.floor(Math.random() * 100) + 50,
          tokens: Math.floor(Math.random() * 100000) + 25000,
          cost: Math.random() * 15 + 5
        },
        {
          userId: 'user-2',
          userName: 'Mike Chen',
          executions: Math.floor(Math.random() * 75) + 25,
          tokens: Math.floor(Math.random() * 75000) + 15000,
          cost: Math.random() * 10 + 3
        }
      ]
    }));

    setUsageSummary(mockSummary);
    setToolAnalytics(mockAnalytics);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!usageSummary) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <div>
          <h4>No Usage Data</h4>
          <p>No usage data available for the selected period.</p>
        </div>
      </Alert>
    );
  }

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertBadgeColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usage Analytics & Cost Tracking</h2>
        <p className="text-muted-foreground mt-1">
          Monitor tool usage, costs, and performance metrics
        </p>
      </div>

      {/* Alerts */}
      {usageSummary.alerts.length > 0 && (
        <div className="space-y-2">
          {usageSummary.alerts.map((alert, index) => (
            <Alert key={index} className={clsx(
              alert.severity === 'high' && 'border-red-200 bg-red-50',
              alert.severity === 'medium' && 'border-yellow-200 bg-yellow-50'
            )}>
              {getAlertIcon(alert.severity)}
              <div className="flex items-start justify-between w-full">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{alert.message}</h4>
                    <Badge className={getAlertBadgeColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.recommendation}</p>
                </div>
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${usageSummary.summary.totalCost.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Past 30 days
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Executions</p>
                <p className="text-2xl font-bold">{usageSummary.summary.totalExecutions.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Across {usageSummary.summary.enabledTools} tools
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tokens</p>
                <p className="text-2xl font-bold">{(usageSummary.summary.totalTokens / 1000000).toFixed(1)}M</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Input + Output tokens
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Most Used Tool</p>
                <p className="text-lg font-bold truncate">{usageSummary.summary.mostUsedTool}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown by Tier */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown by Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-800">Free Tier</p>
              <p className="text-2xl font-bold text-green-600">
                ${usageSummary.summary.costByTier.free.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-800">Standard Tier</p>
              <p className="text-2xl font-bold text-blue-600">
                ${usageSummary.summary.costByTier.standard.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-800">Premium Tier</p>
              <p className="text-2xl font-bold text-purple-600">
                ${usageSummary.summary.costByTier.premium.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tool Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Tool Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usageSummary.toolBreakdown.map((tool) => (
              <div key={tool.toolId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{tool.toolName}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">${tool.cost.toFixed(2)}</Badge>
                    {tool.errorRate > 0.1 && (
                      <Badge variant="destructive">
                        {(tool.errorRate * 100).toFixed(1)}% errors
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Executions</p>
                    <p className="font-medium">{tool.executions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tokens</p>
                    <p className="font-medium">{(tool.tokens / 1000).toFixed(0)}K</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className="font-medium text-green-600">
                      {((1 - tool.errorRate) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Cost/Exec</p>
                    <p className="font-medium">${(tool.cost / tool.executions).toFixed(4)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily Trends (simplified view) */}
      <Card>
        <CardHeader>
          <CardTitle>7-Day Usage Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Average daily executions: {Math.floor(usageSummary.summary.totalExecutions / 30)}
            </p>
            <p className="text-sm text-muted-foreground">
              Average daily cost: ${(usageSummary.summary.totalCost / 30).toFixed(2)}
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                📊 Detailed charts and trend analysis will be available in the full analytics dashboard.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};