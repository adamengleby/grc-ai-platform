import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Brain,
  Target,
  Lightbulb,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';

interface InsightVisualizationProps {
  insights: Array<{
    id: string;
    type: 'narrative' | 'recommendation' | 'finding' | 'trend' | 'prediction';
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
      impact?: 'positive' | 'negative' | 'neutral';
    };
  }>;
  layout?: 'grid' | 'list';
  showMetrics?: boolean;
}

export const InsightVisualization: React.FC<InsightVisualizationProps> = ({
  insights,
  layout = 'list',
  showMetrics = true
}) => {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'narrative': return <Brain className="h-4 w-4" />;
      case 'recommendation': return <Lightbulb className="h-4 w-4" />;
      case 'finding': return <Target className="h-4 w-4" />;
      case 'trend': return <TrendingUp className="h-4 w-4" />;
      case 'prediction': return <AlertTriangle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'narrative': return 'bg-blue-100 text-blue-800';
      case 'recommendation': return 'bg-green-100 text-green-800';
      case 'finding': return 'bg-purple-100 text-purple-800';
      case 'trend': return 'bg-orange-100 text-orange-800';
      case 'prediction': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend?: number) => {
    if (!trend) return null;
    if (trend > 0.1) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend < -0.1) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <ArrowRight className="h-3 w-3 text-gray-500" />;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (layout === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight) => (
          <Card 
            key={insight.id} 
            className={clsx("h-full border-l-4", getSeverityColor(insight.severity))}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getInsightIcon(insight.type)}
                  <CardTitle className="text-sm">{insight.title}</CardTitle>
                </div>
                {getSeverityIcon(insight.severity)}
              </div>
              <div className="flex items-center space-x-2">
                <span className={clsx(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  getTypeColor(insight.type)
                )}>
                  {insight.type}
                </span>
                <span className={clsx("text-xs font-medium", getConfidenceColor(insight.confidence))}>
                  {insight.confidence}%
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {insight.content}
              </p>
              
              {showMetrics && insight.metrics && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs">
                    {insight.metrics.score && (
                      <div className="flex items-center space-x-1">
                        <span>Score:</span>
                        <span className="font-medium">{insight.metrics.score}</span>
                      </div>
                    )}
                    {insight.metrics.trend && (
                      <div className="flex items-center space-x-1">
                        {getTrendIcon(insight.metrics.trend)}
                        <span className="font-medium">{insight.metrics.trend}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {insights.map((insight) => (
        <Card 
          key={insight.id} 
          className={clsx("border-l-4", getSeverityColor(insight.severity))}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center space-x-2">
                {getInsightIcon(insight.type)}
                <span>{insight.title}</span>
                <span className={clsx(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  getTypeColor(insight.type)
                )}>
                  {insight.type}
                </span>
              </CardTitle>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span className={getConfidenceColor(insight.confidence)}>
                  {insight.confidence}% confidence
                </span>
                <span>•</span>
                <span>{new Date(insight.timestamp).toLocaleTimeString()}</span>
                {getSeverityIcon(insight.severity)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {insight.content}
            </p>
            
            {showMetrics && insight.metrics && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  {insight.metrics.score && (
                    <div className="flex items-center space-x-1">
                      <span>Score:</span>
                      <span className="font-medium">{insight.metrics.score}</span>
                    </div>
                  )}
                  {insight.metrics.trend && (
                    <div className="flex items-center space-x-1">
                      <span>Trend:</span>
                      {getTrendIcon(insight.metrics.trend)}
                      <span className="font-medium">
                        {insight.metrics.trend > 0 ? '+' : ''}{insight.metrics.trend}
                      </span>
                    </div>
                  )}
                  {insight.metrics.change && (
                    <div className="flex items-center space-x-1">
                      <span>Change:</span>
                      <span className="font-medium">{insight.metrics.change}</span>
                    </div>
                  )}
                  {insight.metrics.impact && (
                    <div className="flex items-center space-x-1">
                      <span>Impact:</span>
                      <span className={clsx(
                        "font-medium",
                        insight.metrics.impact === 'positive' ? 'text-green-600' :
                        insight.metrics.impact === 'negative' ? 'text-red-600' :
                        'text-gray-600'
                      )}>
                        {insight.metrics.impact}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};