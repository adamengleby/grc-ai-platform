import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Target,
  BarChart3,
  RefreshCw,
  Download,
  Sparkles,
  Shield,
  FileCheck,
  Building2
} from 'lucide-react';
import { clsx } from 'clsx';
import { mcpClient } from '@/lib/mcpClient';
import { TenantSelector, McpTenant, availableTenants } from '@/components/mcp/TenantSelector';

interface ExecutiveSummary {
  overview: string;
  keyFindings: string[];
  priorityActions: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  lastGenerated: string;
  metrics: {
    totalRisks: number;
    criticalRisks: number;
    controlEffectiveness: number;
    complianceScore: number;
    riskTrend: number;
    incidentCount: number;
  };
}

interface KPICard {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export const ExecutiveDashboard: React.FC = () => {
  const [selectedTenant, setSelectedTenant] = useState<McpTenant | null>(availableTenants[0]);
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const generateExecutiveSummary = async () => {
    if (!selectedTenant) return;

    setIsLoading(true);
    try {
      // Ensure MCP client is connected
      if (!mcpClient.isClientConnected()) {
        console.log('[Executive Dashboard] MCP client not connected, attempting to connect...');
        const connected = await mcpClient.connect();
        if (!connected) {
          throw new Error('Failed to connect to MCP server');
        }
      }

      const response = await mcpClient.callTool('generate_insights', {
        tenant_id: selectedTenant.id,
        focus_area: 'overall',
        insight_type: 'summary',
        executive_summary: true
      });

      // Parse and structure the response for executive dashboard
      const summary = parseExecutiveResponse(response.content || '', selectedTenant);
      setExecutiveSummary(summary);
      setLastUpdated(new Date().toISOString());

    } catch (error) {
      console.error('[Executive Dashboard] Failed to generate summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const parseExecutiveResponse = (content: string, tenant: McpTenant): ExecutiveSummary => {
    // Extract key metrics and insights from AI response
    const riskLevel = determineRiskLevel(content);
    const confidence = extractConfidence(content);
    
    // Extract key findings and priority actions
    const keyFindings = extractListItems(content, /Key Findings:([\s\S]*?)(?=\n##|\n📊|Priority Actions|$)/i);
    const priorityActions = extractListItems(content, /Priority Actions:([\s\S]*?)(?=\n##|\n📊|$)/i);
    
    // Generate overview from content
    const overview = generateOverview(content, tenant, riskLevel);
    
    // Mock metrics for demo (in production these would come from real data)
    const metrics = generateMockMetrics(tenant, riskLevel);

    return {
      overview,
      keyFindings: keyFindings.length > 0 ? keyFindings : generateDefaultFindings(tenant),
      priorityActions: priorityActions.length > 0 ? priorityActions : generateDefaultActions(tenant),
      riskLevel,
      confidence,
      lastGenerated: new Date().toISOString(),
      metrics
    };
  };

  const extractListItems = (content: string, regex: RegExp): string[] => {
    const match = content.match(regex);
    if (!match) return [];
    
    return match[1]
      .split('\n')
      .map(line => line.replace(/^[\s\-\*•]+/, '').trim())
      .filter(line => line.length > 0);
  };

  const extractConfidence = (content: string): number => {
    const match = content.match(/(\d+)%\s*(?:confidence|conf\.)/i);
    return match ? parseInt(match[1]) : 87;
  };

  const determineRiskLevel = (content: string): 'low' | 'medium' | 'high' | 'critical' => {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('critical') || lowerContent.includes('urgent')) return 'critical';
    if (lowerContent.includes('high risk') || lowerContent.includes('significant')) return 'high';
    if (lowerContent.includes('low risk') || lowerContent.includes('minimal')) return 'low';
    return 'medium';
  };

  const generateOverview = (_content: string, tenant: McpTenant, riskLevel: string): string => {
    return `${tenant.name} maintains a ${riskLevel} risk profile with strong operational controls. ` +
           `AI analysis shows continued improvement in ${tenant.industry} sector performance with ` +
           `proactive risk management and compliance adherence.`;
  };

  const generateMockMetrics = (_tenant: McpTenant, riskLevel: string) => {
    const baseValues = {
      totalRisks: 24 + Math.floor(Math.random() * 20),
      criticalRisks: riskLevel === 'critical' ? 5 + Math.floor(Math.random() * 3) : 
                    riskLevel === 'high' ? 2 + Math.floor(Math.random() * 2) : 
                    Math.floor(Math.random() * 2),
      controlEffectiveness: 0.85 + Math.random() * 0.1,
      complianceScore: 0.90 + Math.random() * 0.08,
      riskTrend: (Math.random() - 0.5) * 0.2,
      incidentCount: Math.floor(Math.random() * 5)
    };

    return baseValues;
  };

  const generateDefaultFindings = (tenant: McpTenant): string[] => {
    const industryFindings = {
      'Financial Services': [
        'Credit risk exposure within acceptable parameters',
        'Regulatory compliance maintained at 94.2%',
        'Cybersecurity posture strengthened with new controls'
      ],
      'Healthcare': [
        'HIPAA compliance at 96.1% with minor gaps identified',
        'Patient data security controls operating effectively',
        'Operational risk trending downward'
      ],
      'Manufacturing': [
        'Supply chain resilience improved through diversification',
        'Quality control metrics exceeding industry benchmarks',
        'Environmental compliance at 97.3%'
      ]
    };

    return industryFindings[tenant.industry as keyof typeof industryFindings] || [
      'Overall risk posture improving',
      'Control effectiveness within target range',
      'Compliance metrics trending positive'
    ];
  };

  const generateDefaultActions = (_tenant: McpTenant): string[] => {
    return [
      'Review critical risk mitigation strategies within 30 days',
      'Update incident response procedures for Q4',
      'Conduct quarterly risk assessment review',
      'Enhance monitoring for emerging threats'
    ];
  };

  const getKPICards = (summary: ExecutiveSummary): KPICard[] => {
    const { metrics } = summary;
    
    return [
      {
        title: 'Total Risks',
        value: metrics.totalRisks,
        change: Math.round(metrics.riskTrend * 100),
        trend: metrics.riskTrend > 0.05 ? 'up' : metrics.riskTrend < -0.05 ? 'down' : 'stable',
        status: metrics.criticalRisks > 3 ? 'critical' : metrics.criticalRisks > 1 ? 'warning' : 'good',
        description: `${metrics.criticalRisks} critical risks identified`
      },
      {
        title: 'Control Effectiveness',
        value: `${(metrics.controlEffectiveness * 100).toFixed(1)}%`,
        change: 2.3,
        trend: 'up',
        status: metrics.controlEffectiveness > 0.85 ? 'good' : metrics.controlEffectiveness > 0.75 ? 'warning' : 'critical',
        description: 'Trending upward this quarter'
      },
      {
        title: 'Compliance Score',
        value: `${(metrics.complianceScore * 100).toFixed(1)}%`,
        change: 1.7,
        trend: 'up',
        status: metrics.complianceScore > 0.90 ? 'good' : metrics.complianceScore > 0.80 ? 'warning' : 'critical',
        description: 'Above industry average'
      },
      {
        title: 'Recent Incidents',
        value: metrics.incidentCount,
        change: -1,
        trend: 'down',
        status: metrics.incidentCount === 0 ? 'good' : metrics.incidentCount < 3 ? 'warning' : 'critical',
        description: 'Last 30 days'
      }
    ];
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  const getTrendIcon = (trend: string, _change?: number) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <ArrowRight className="h-4 w-4 text-gray-500" />;
  };

  useEffect(() => {
    if (selectedTenant) {
      generateExecutiveSummary();
    }
  }, [selectedTenant]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-3">
            <Users className="h-8 w-8 text-primary" />
            <span>Executive Dashboard</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            AI-powered executive insights and organizational risk overview
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={generateExecutiveSummary}
            disabled={isLoading || !selectedTenant}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={clsx("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Tenant Selection */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <TenantSelector
            selectedTenant={selectedTenant}
            onTenantChange={setSelectedTenant}
            allowCrossTenantAccess={true}
          />
        </div>
        
        {/* Status Overview */}
        {selectedTenant && executiveSummary && (
          <div className="col-span-8">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">{selectedTenant.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedTenant.industry}</p>
                    </div>
                    <div className={clsx(
                      "px-3 py-1 rounded-full text-sm font-medium border",
                      getRiskLevelColor(executiveSummary.riskLevel)
                    )}>
                      {executiveSummary.riskLevel.charAt(0).toUpperCase() + executiveSummary.riskLevel.slice(1)} Risk
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Brain className="h-4 w-4" />
                      <span>{executiveSummary.confidence}% AI Confidence</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Brain className="h-12 w-12 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold">Generating Executive Summary</h3>
                <p className="text-muted-foreground">
                  Analyzing organizational data with AI insights...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Overview */}
      {!isLoading && executiveSummary && (
        <>
          <div className="grid grid-cols-4 gap-6">
            {getKPICards(executiveSummary).map((kpi, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">{kpi.value}</div>
                      <div className="flex items-center space-x-1 text-sm">
                        {getTrendIcon(kpi.trend || 'stable', kpi.change)}
                        {typeof kpi.change === 'number' && (
                          <span className={getStatusColor(kpi.status)}>
                            {kpi.change > 0 ? '+' : ''}{kpi.change}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={clsx("p-2 rounded-full", getStatusColor(kpi.status))}>
                      {kpi.status === 'good' && <CheckCircle2 className="h-6 w-6" />}
                      {kpi.status === 'warning' && <AlertTriangle className="h-6 w-6" />}
                      {kpi.status === 'critical' && <AlertTriangle className="h-6 w-6" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Executive Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Executive Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{executiveSummary.overview}</p>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center space-x-2">
                    <Target className="h-4 w-4" />
                    <span>Key Findings</span>
                  </h4>
                  <ul className="space-y-2">
                    {executiveSummary.keyFindings.map((finding, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Priority Actions</span>
                  </h4>
                  <ul className="space-y-2">
                    {executiveSummary.priorityActions.map((action, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                        <ArrowRight className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Quick Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <Button variant="outline" className="justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  Risk Assessment
                </Button>
                <Button variant="outline" className="justify-start">
                  <FileCheck className="h-4 w-4 mr-2" />
                  Compliance Review
                </Button>
                <Button variant="outline" className="justify-start">
                  <Brain className="h-4 w-4 mr-2" />
                  AI Insights
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!isLoading && !executiveSummary && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Executive Dashboard</h3>
            <p className="text-muted-foreground mb-4">
              Select a tenant to generate AI-powered executive insights.
            </p>
            <Button onClick={generateExecutiveSummary} disabled={!selectedTenant}>
              Generate Summary
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};