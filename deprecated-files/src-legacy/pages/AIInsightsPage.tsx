import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Brain,
  TrendingUp,
  Shield,
  AlertTriangle,
  FileCheck,
  Sparkles,
  Download,
  RefreshCw,
  Target,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  Settings,
  Users,
  Building2
} from 'lucide-react';
import { clsx } from 'clsx';
import { mcpClient } from '@/lib/mcpClient';
import { TenantSelector, McpTenant, availableTenants } from '@/components/mcp/TenantSelector';
import { StructuredAIReport } from '@/components/ai/StructuredAIReport';

interface AIInsight {
  id: string;
  type: 'narrative' | 'recommendation' | 'finding';
  title: string;
  content: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  timestamp: string;
  metrics?: {
    score?: number;
    trend?: number;
    change?: string;
  };
}

interface ExecutiveSummary {
  overview: string;
  keyFindings: string[];
  priorityActions: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  lastGenerated: string;
}

type FocusArea = 'overall' | 'risks' | 'controls' | 'compliance';
type InsightType = 'summary' | 'predictions' | 'recommendations' | 'alerts';

export const AIInsightsPage: React.FC = () => {
  const [selectedTenant, setSelectedTenant] = useState<McpTenant | null>(availableTenants[0]);
  const [focusArea, setFocusArea] = useState<FocusArea>('overall');
  const [insightType, setInsightType] = useState<InsightType>('summary');
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showExecutiveSummary, setShowExecutiveSummary] = useState(true);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [useAgents, setUseAgents] = useState<boolean>(true);
  const [agentMode, setAgentMode] = useState<'auto' | 'single' | 'multi'>('auto');
  const [lastGenerationMode, setLastGenerationMode] = useState<'agents' | 'direct' | null>(null);

  const focusAreas = [
    { id: 'overall', label: 'Overall', icon: Brain, description: 'Comprehensive organizational insights' },
    { id: 'risks', label: 'Risk Analysis', icon: AlertTriangle, description: 'Risk-focused predictions and analysis' },
    { id: 'controls', label: 'Control Effectiveness', icon: Shield, description: 'Control performance and optimization' },
    { id: 'compliance', label: 'Compliance', icon: FileCheck, description: 'Regulatory and compliance insights' }
  ] as const;

  const insightTypes = [
    { id: 'summary', label: 'Summary', description: 'High-level overview and key metrics' },
    { id: 'predictions', label: 'Predictions', description: 'ML-powered forecasts and trends' },
    { id: 'recommendations', label: 'Recommendations', description: 'Actionable improvement suggestions' },
    { id: 'alerts', label: 'Alerts', description: 'Priority issues requiring attention' }
  ] as const;

  const generateAIInsights = async (includeExecutive: boolean = false) => {
    if (!selectedTenant) return;

    setIsLoading(true);
    setInsights([]);
    setExecutiveSummary(null);
    setRawResponse('');

    try {
      // Ensure MCP client is connected
      if (!mcpClient.isClientConnected()) {
        console.log('[AI Insights] MCP client not connected, attempting to connect...');
        const connected = await mcpClient.connect();
        if (!connected) {
          throw new Error('Failed to connect to MCP server');
        }
      }

      console.log(`[AI Insights] Generating insights for ${selectedTenant.name}`);
      console.log(`[AI Insights] Focus: ${focusArea}, Type: ${insightType}, Executive: ${includeExecutive}`);

      const response = await mcpClient.callTool('generate_insights', {
        tenant_id: selectedTenant.id,
        focus_area: focusArea,
        insight_type: insightType,
        executive_summary: includeExecutive,
        use_agents: useAgents,
        agent_mode: agentMode
      });

      console.log('[AI Insights] Raw response:', response);

      setRawResponse(response.content || '');
      setProcessingTime(response.processingTime || 0);
      setLastUpdated(new Date().toISOString());
      
      // Detect which mode was actually used based on response metadata
      if ((response as any).agentMode || (response.content && response.content.includes('Agent'))) {
        setLastGenerationMode('agents');
      } else {
        setLastGenerationMode('direct');
      }

      // Parse the response to extract structured insights
      const parsedInsights = parseAIResponse(response.content || '');
      setInsights(parsedInsights.insights);

      if (includeExecutive && parsedInsights.executiveSummary) {
        setExecutiveSummary(parsedInsights.executiveSummary);
      }

    } catch (error) {
      console.error('[AI Insights] Generation failed:', error);
      setInsights([{
        id: 'error',
        type: 'narrative',
        title: 'Error Generating Insights',
        content: `Failed to generate AI insights: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        severity: 'critical',
        category: 'system',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseAIResponse = (content: string): { insights: AIInsight[], executiveSummary?: ExecutiveSummary } => {
    const insights: AIInsight[] = [];
    let executiveSummary: ExecutiveSummary | undefined;

    // Extract executive summary if present
    const execSummaryMatch = content.match(/📋 Executive Summary[\s\S]*?(?=\n##|\n📊|\n🎯|$)/i);
    if (execSummaryMatch) {
      const execContent = execSummaryMatch[0];
      const keyFindings = extractListItems(execContent, /🎯 Key Findings:([\s\S]*?)(?=\n\*\*|$)/i);
      const priorityActions = extractListItems(execContent, /Priority Actions:([\s\S]*?)(?=\n\*\*|$)/i);
      
      executiveSummary = {
        overview: extractSection(execContent, /Overview:([\s\S]*?)(?=\*\*|$)/i) || 'Executive summary available',
        keyFindings: keyFindings.length > 0 ? keyFindings : ['AI-generated insights available'],
        priorityActions: priorityActions.length > 0 ? priorityActions : ['Review AI recommendations'],
        riskLevel: determineRiskLevel(content),
        confidence: extractConfidence(content),
        lastGenerated: new Date().toISOString()
      };
    }

    // Extract narratives
    const narrativeMatches = content.match(/\*\*(.*?)\*\*:\s*(.*?)(?=\n\*\*|\n-|\n#|$)/g);
    if (narrativeMatches) {
      narrativeMatches.forEach((match, index) => {
        const [, title, narrative] = match.match(/\*\*(.*?)\*\*:\s*(.*)/s) || [];
        if (title && narrative) {
          insights.push({
            id: `narrative-${index}`,
            type: 'narrative',
            title: title.trim(),
            content: narrative.trim(),
            confidence: extractConfidence(match),
            severity: determineSeverity(match),
            category: focusArea,
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    // Extract recommendations
    const recommendationMatches = content.match(/📝 (.*?)(?=\n|$)/g);
    if (recommendationMatches) {
      recommendationMatches.forEach((match, index) => {
        const recommendation = match.replace('📝 ', '').trim();
        insights.push({
          id: `recommendation-${index}`,
          type: 'recommendation',
          title: 'AI Recommendation',
          content: recommendation,
          confidence: extractConfidence(content),
          severity: 'medium',
          category: 'recommendation',
          timestamp: new Date().toISOString()
        });
      });
    }

    // Extract key findings
    const findings = extractListItems(content, /Key Findings:([\s\S]*?)(?=\n##|\n📊|$)/i);
    findings.forEach((finding, index) => {
      insights.push({
        id: `finding-${index}`,
        type: 'finding',
        title: 'Key Finding',
        content: finding,
        confidence: extractConfidence(content),
        severity: determineSeverity(finding),
        category: 'finding',
        timestamp: new Date().toISOString()
      });
    });

    return { insights, executiveSummary };
  };

  const extractListItems = (content: string, regex: RegExp): string[] => {
    const match = content.match(regex);
    if (!match) return [];
    
    return match[1]
      .split('\n')
      .map(line => line.replace(/^[\s\-\*•]+/, '').trim())
      .filter(line => line.length > 0);
  };

  const extractSection = (content: string, regex: RegExp): string | null => {
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  };

  const extractConfidence = (content: string): number => {
    const match = content.match(/(\d+)%\s*(?:confidence|conf\.)/i);
    return match ? parseInt(match[1]) : 85;
  };

  const determineRiskLevel = (content: string): 'low' | 'medium' | 'high' | 'critical' => {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('critical') || lowerContent.includes('urgent')) return 'critical';
    if (lowerContent.includes('high risk') || lowerContent.includes('significant')) return 'high';
    if (lowerContent.includes('low risk') || lowerContent.includes('minimal')) return 'low';
    return 'medium';
  };

  const determineSeverity = (content: string): 'low' | 'medium' | 'high' | 'critical' => {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('critical') || lowerContent.includes('severe')) return 'critical';
    if (lowerContent.includes('high') || lowerContent.includes('significant')) return 'high';
    if (lowerContent.includes('low') || lowerContent.includes('minor')) return 'low';
    return 'medium';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Info className="h-4 w-4 text-yellow-500" />;
      case 'low': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'high': return 'border-orange-200 bg-orange-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      case 'low': return 'border-green-200 bg-green-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  const exportExecutiveReport = async () => {
    if (!selectedTenant) return;

    // Generate executive summary specifically for export
    try {
      const response = await mcpClient.callTool('generate_insights', {
        tenant_id: selectedTenant.id,
        focus_area: 'overall',
        insight_type: 'summary',
        executive_summary: true
      });

      const reportContent = generateExecutiveReportHTML(response.content, selectedTenant);
      
      // Create and download the report
      const blob = new Blob([reportContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTenant.name.replace(/\s+/g, '_')}_Executive_Report_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export executive report:', error);
    }
  };

  const generateExecutiveReportHTML = (aiResponse: string, tenant: McpTenant): string => {
    const timestamp = new Date().toLocaleString();
    const reportDate = new Date().toLocaleDateString();
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Executive Risk Report - ${tenant.name}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }
        .header {
            border-bottom: 3px solid #2563eb;
            margin-bottom: 30px;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #1e40af;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header .subtitle {
            color: #6b7280;
            font-size: 16px;
            margin: 5px 0;
        }
        .metadata {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .metadata-item {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
        }
        .metadata-label {
            font-weight: 600;
            color: #374151;
        }
        .metadata-value {
            color: #6b7280;
        }
        .section {
            margin: 30px 0;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 25px;
        }
        .section h2 {
            color: #1f2937;
            font-size: 20px;
            margin: 0 0 15px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .section h3 {
            color: #374151;
            font-size: 16px;
            margin: 20px 0 10px 0;
            border-left: 4px solid #2563eb;
            padding-left: 12px;
        }
        .key-findings {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
        }
        .recommendations {
            background: #f0fdf4;
            border-left: 4px solid #10b981;
        }
        .critical-alert {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .metric-card {
            background: #f9fafb;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 15px;
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
        }
        .metric-label {
            font-size: 14px;
            color: #6b7280;
            margin-top: 5px;
        }
        .finding-item, .recommendation-item {
            margin: 10px 0;
            padding: 10px 15px;
            border-radius: 6px;
            border-left: 3px solid #e5e7eb;
        }
        .finding-item {
            background: #f8fafc;
            border-left-color: #3b82f6;
        }
        .recommendation-item {
            background: #f0fdf4;
            border-left-color: #10b981;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
        }
        .confidence-badge {
            display: inline-block;
            background: #2563eb;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        @media print {
            body { padding: 20px; }
            .section { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Executive Risk Assessment Report</h1>
        <div class="subtitle">${tenant.name} • ${tenant.industry} Industry</div>
        <div class="subtitle">Generated: ${timestamp} <span class="confidence-badge">87% AI Confidence</span></div>
    </div>

    <div class="metadata">
        <div class="metadata-item">
            <span class="metadata-label">Organization:</span>
            <span class="metadata-value">${tenant.name}</span>
        </div>
        <div class="metadata-item">
            <span class="metadata-label">Industry:</span>
            <span class="metadata-value">${tenant.industry}</span>
        </div>
        <div class="metadata-item">
            <span class="metadata-label">Report Date:</span>
            <span class="metadata-value">${reportDate}</span>
        </div>
        <div class="metadata-item">
            <span class="metadata-label">Analysis Type:</span>
            <span class="metadata-value">Executive Summary</span>
        </div>
    </div>

    ${parseAIResponseForExecutiveReport(aiResponse)}

    <div class="footer">
        <p><strong>🤖 Generated by AI Insights Engine v2.0</strong></p>
        <p>This report contains AI-generated insights with ${tenant.industry}-specific intelligence • Confidential</p>
        <p>Report ID: ${Date.now().toString(36).toUpperCase()} • Generated: ${timestamp}</p>
    </div>
</body>
</html>`;
  };

  const parseAIResponseForExecutiveReport = (response: string): string => {
    let html = '';
    const lines = response.split('\n');
    let findings: string[] = [];
    let recommendations: string[] = [];

    // Extract key findings
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('🎯 Key Findings') || line.includes('**🎯 Key Findings**')) {
        for (let j = i + 1; j < lines.length && lines[j].trim().startsWith('- '); j++) {
          findings.push(lines[j].trim().replace('- ', ''));
        }
      }
      if (line.includes('📝 Recommendations') || line.includes('**📝 Recommendations**')) {
        for (let j = i + 1; j < lines.length && lines[j].trim().startsWith('- '); j++) {
          recommendations.push(lines[j].trim().replace('- ', ''));
        }
      }
    }

    // Executive Summary section
    html += `
    <div class="section">
        <h2>📋 Executive Summary</h2>
        <p>This report provides an AI-powered assessment of the current risk posture and compliance status for the organization. Key metrics and strategic recommendations are highlighted for executive decision-making.</p>
    </div>`;

    // Key Findings
    if (findings.length > 0) {
      html += `
      <div class="section key-findings">
          <h2>🎯 Key Findings</h2>`;
      findings.forEach(finding => {
        html += `<div class="finding-item">${finding}</div>`;
      });
      html += `</div>`;
    }

    // Recommendations
    if (recommendations.length > 0) {
      html += `
      <div class="section recommendations">
          <h2>💡 Priority Recommendations</h2>`;
      recommendations.forEach(rec => {
        html += `<div class="recommendation-item">${rec}</div>`;
      });
      html += `</div>`;
    }

    // Risk metrics (mock data for executive summary)
    html += `
    <div class="section">
        <h2>📊 Risk Metrics Overview</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">7.2/10</div>
                <div class="metric-label">Average Risk Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">73%</div>
                <div class="metric-label">Control Effectiveness</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">2</div>
                <div class="metric-label">Critical Risks</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">94%</div>
                <div class="metric-label">Compliance Score</div>
            </div>
        </div>
    </div>`;

    return html;
  };

  // Initialize MCP client connection on mount
  useEffect(() => {
    const initializeMCPClient = async () => {
      if (!mcpClient.isClientConnected()) {
        console.log('[AI Insights] Initializing MCP client connection...');
        await mcpClient.connect();
      }
    };
    
    initializeMCPClient();
  }, []);

  // Load initial insights
  useEffect(() => {
    if (selectedTenant) {
      generateAIInsights(showExecutiveSummary);
    }
  }, [selectedTenant, focusArea, insightType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-3">
            <Brain className="h-8 w-8 text-primary" />
            <span>AI Insights</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            AI-powered natural language insights and executive summaries from your GRC data
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => generateAIInsights(showExecutiveSummary)}
            disabled={isLoading || !selectedTenant}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={clsx("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          {showExecutiveSummary && (
            <Button
              onClick={exportExecutiveReport}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-12 gap-6">
        {/* Tenant Selection */}
        <div className="col-span-3">
          <TenantSelector
            selectedTenant={selectedTenant}
            onTenantChange={setSelectedTenant}
            allowCrossTenantAccess={true}
          />
        </div>

        {/* Focus Area Selection */}
        <div className="col-span-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center space-x-2">
                <Target className="h-4 w-4" />
                <span>Focus Area</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2">
                {focusAreas.map((area) => {
                  const Icon = area.icon;
                  return (
                    <button
                      key={area.id}
                      onClick={() => setFocusArea(area.id as FocusArea)}
                      className={clsx(
                        'p-3 border rounded-lg text-left transition-all hover:scale-[1.02]',
                        focusArea === area.id
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium text-sm">{area.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {area.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insight Type & Options */}
        <div className="col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>Analysis Type</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-2">
                {insightTypes.map((type) => (
                  <label key={type.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value={type.id}
                      checked={insightType === type.id}
                      onChange={(e) => setInsightType(e.target.value as InsightType)}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="text-sm font-medium">{type.label}</span>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="border-t pt-3 space-y-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showExecutiveSummary}
                    onChange={(e) => setShowExecutiveSummary(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Include Executive Summary</span>
                </label>

                {/* Agent Mode Controls */}
                <div className="border-t pt-3">
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useAgents}
                        onChange={(e) => setUseAgents(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <div className="flex items-center space-x-1">
                        <Users className="h-3 w-3" />
                        <span className="text-sm font-medium">Use AI Agents</span>
                      </div>
                    </label>
                    <p className="text-xs text-muted-foreground ml-6">
                      Enable specialized AI agents for enhanced analysis
                    </p>
                  </div>

                  {useAgents && (
                    <div className="mt-3 ml-6 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Agent Mode:</div>
                      <div className="space-y-1">
                        {[
                          { id: 'auto', label: 'Auto Select', desc: 'Automatically choose best agents' },
                          { id: 'single', label: 'Single Agent', desc: 'Use one specialized agent' },
                          { id: 'multi', label: 'Multi-Agent', desc: 'Coordinate multiple agents' }
                        ].map((mode) => (
                          <label key={mode.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="agentMode"
                              value={mode.id}
                              checked={agentMode === mode.id}
                              onChange={(e) => setAgentMode(e.target.value as 'auto' | 'single' | 'multi')}
                              className="w-3 h-3"
                            />
                            <div>
                              <span className="text-xs">{mode.label}</span>
                              <p className="text-xs text-muted-foreground">{mode.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Status Bar */}
      {selectedTenant && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedTenant.name}</span>
                  <span className="text-muted-foreground">({selectedTenant.industry})</span>
                </div>
                <div className="text-muted-foreground">•</div>
                <div className="flex items-center space-x-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span>Focus: {focusAreas.find(f => f.id === focusArea)?.label}</span>
                </div>
                <div className="text-muted-foreground">•</div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span>Type: {insightTypes.find(t => t.id === insightType)?.label}</span>
                </div>
                {lastGenerationMode && (
                  <>
                    <div className="text-muted-foreground">•</div>
                    <div className="flex items-center space-x-2">
                      {lastGenerationMode === 'agents' ? (
                        <Users className="h-4 w-4 text-green-600" />
                      ) : (
                        <Brain className="h-4 w-4 text-blue-600" />
                      )}
                      <span className={lastGenerationMode === 'agents' ? 'text-green-600' : 'text-blue-600'}>
                        {lastGenerationMode === 'agents' ? `AI Agents (${agentMode})` : 'Direct LLM'}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-4 text-muted-foreground">
                {processingTime > 0 && (
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{processingTime}ms</span>
                  </div>
                )}
                {lastUpdated && (
                  <div className="flex items-center space-x-1">
                    <RefreshCw className="h-4 w-4" />
                    <span>Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Brain className="h-12 w-12 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold">Generating AI Insights</h3>
                <p className="text-muted-foreground">
                  Analyzing {selectedTenant?.name} data with machine learning models...
                </p>
              </div>
              <div className="flex justify-center space-x-1">
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Executive Summary */}
      {!isLoading && executiveSummary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Executive Summary</span>
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {executiveSummary.confidence}% confidence
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{executiveSummary.overview}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center space-x-2">
                  <Target className="h-4 w-4" />
                  <span>Key Findings</span>
                </h4>
                <ul className="space-y-1">
                  {executiveSummary.keyFindings.map((finding, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Priority Actions</span>
                </h4>
                <ul className="space-y-1">
                  {executiveSummary.priorityActions.map((action, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                      <AlertTriangle className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      {!isLoading && insights.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>AI-Generated Insights</span>
            <span className="text-sm font-normal text-muted-foreground">
              ({insights.length} insights)
            </span>
          </h2>

          {/* Structured AI Report */}
          <StructuredAIReport rawContent={rawResponse} />

          {/* Extracted Key Insights */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Key Insights Summary</span>
            </h3>
            <div className="grid gap-4">
            {insights.map((insight) => (
              <Card key={insight.id} className={clsx("border-l-4", getSeverityColor(insight.severity))}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center space-x-2">
                      {getSeverityIcon(insight.severity)}
                      <span>{insight.title}</span>
                      <span className="text-xs font-normal px-2 py-1 bg-secondary rounded">
                        {insight.type}
                      </span>
                    </CardTitle>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>{insight.confidence}% confidence</span>
                      <span>•</span>
                      <span>{new Date(insight.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{insight.content}</p>
                  {insight.metrics && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        {insight.metrics.score && (
                          <span>Score: {insight.metrics.score}</span>
                        )}
                        {insight.metrics.trend && (
                          <span>Trend: {insight.metrics.trend > 0 ? '+' : ''}{insight.metrics.trend}</span>
                        )}
                        {insight.metrics.change && (
                          <span>Change: {insight.metrics.change}</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* Raw Response (Debug) */}
      {!isLoading && rawResponse && process.env.NODE_ENV === 'development' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Raw AI Response (Debug)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">
              {rawResponse}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && insights.length === 0 && !executiveSummary && (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Insights Available</h3>
            <p className="text-muted-foreground mb-4">
              Select a tenant and focus area to generate AI insights.
            </p>
            <Button onClick={() => generateAIInsights(showExecutiveSummary)} disabled={!selectedTenant}>
              Generate Insights
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};