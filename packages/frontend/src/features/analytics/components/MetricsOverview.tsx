/**
 * Metrics Overview Component
 * Displays high-level real-time metrics and KPIs
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Target,
  Zap,
  Clock,
  Database
} from 'lucide-react';
import { 
  RealTimeMetrics, 
  RiskAnalytics, 
  ComplianceAnalytics, 
  ControlAnalytics 
} from '../types';

interface MetricsOverviewProps {
  metrics: RealTimeMetrics;
  riskAnalytics: RiskAnalytics | null;
  complianceAnalytics: ComplianceAnalytics | null;
  controlAnalytics: ControlAnalytics | null;
  isLoading: boolean;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  metrics,
  riskAnalytics,
  complianceAnalytics,
  controlAnalytics,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Events/Second</p>
                <p className="text-2xl font-bold text-blue-600">
                  {metrics.metrics.eventsPerSecond.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <Activity className="h-3 w-3 mr-1" />
                  Real-time throughput
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Events</p>
                <p className="text-2xl font-bold text-green-600">
                  {metrics.metrics.totalEventsToday.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <Database className="h-3 w-3 mr-1" />
                  Total processed
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Error Rate</p>
                <p className="text-2xl font-bold text-orange-600">
                  {metrics.metrics.errorRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  System health
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold text-purple-600">
                  {metrics.metrics.averageProcessingTime.toFixed(0)}ms
                </p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  Processing time
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRC-Specific Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {riskAnalytics && (
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">High Risks</p>
                  <p className="text-2xl font-bold text-red-600">
                    {riskAnalytics.highRisks}
                  </p>
                  <div className="flex items-center mt-1">
                    {riskAnalytics.riskTrend === 'increasing' ? (
                      <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
                    ) : riskAnalytics.riskTrend === 'decreasing' ? (
                      <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <div className="h-3 w-3 bg-gray-400 rounded-full mr-1" />
                    )}
                    <p className="text-xs text-gray-500">{riskAnalytics.riskTrend}</p>
                  </div>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {complianceAnalytics && (
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {complianceAnalytics.overallScore.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-500 flex items-center mt-1">
                    <Shield className="h-3 w-3 mr-1" />
                    {complianceAnalytics.frameworks.length} frameworks
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {controlAnalytics && (
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Control Effectiveness</p>
                  <p className="text-2xl font-bold text-green-600">
                    {controlAnalytics.controlEffectiveness.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-500 flex items-center mt-1">
                    <Target className="h-3 w-3 mr-1" />
                    {controlAnalytics.totalControls} total controls
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Alerts</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {metrics.metrics.riskTrends.criticalIncidents + metrics.metrics.riskTrends.controlFailures}
                </p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Require attention
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Types Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <span>Top Event Types</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.metrics.topEventTypes.map((eventType, _index) => (
                <div key={eventType.type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {eventType.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-gray-500">{eventType.count} events</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-xs">
                      {eventType.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>Risk Trends</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-sm font-medium text-gray-900">High Risk Increasing</span>
                </div>
                <Badge variant="destructive" className="text-xs">
                  {metrics.metrics.riskTrends.highRiskIncreasing}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span className="text-sm font-medium text-gray-900">Critical Incidents</span>
                </div>
                <Badge className="bg-orange-100 text-orange-800 text-xs">
                  {metrics.metrics.riskTrends.criticalIncidents}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="text-sm font-medium text-gray-900">Compliance Gaps</span>
                </div>
                <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                  {metrics.metrics.riskTrends.complianceGaps}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-sm font-medium text-gray-900">Control Failures</span>
                </div>
                <Badge className="bg-purple-100 text-purple-800 text-xs">
                  {metrics.metrics.riskTrends.controlFailures}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-green-600" />
            <span>System Health</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${
                metrics.metrics.errorRate < 1 ? 'text-green-600' : 
                metrics.metrics.errorRate < 5 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {metrics.metrics.errorRate < 1 ? 'Healthy' : 
                 metrics.metrics.errorRate < 5 ? 'Warning' : 'Critical'}
              </div>
              <div className="text-sm font-medium text-gray-700">System Status</div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.metrics.errorRate.toFixed(2)}% error rate
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${
                metrics.metrics.averageProcessingTime < 100 ? 'text-green-600' : 
                metrics.metrics.averageProcessingTime < 500 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {metrics.metrics.averageProcessingTime < 100 ? 'Fast' : 
                 metrics.metrics.averageProcessingTime < 500 ? 'Moderate' : 'Slow'}
              </div>
              <div className="text-sm font-medium text-gray-700">Performance</div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.metrics.averageProcessingTime.toFixed(0)}ms avg
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${
                metrics.metrics.eventsPerSecond > 10 ? 'text-green-600' : 
                metrics.metrics.eventsPerSecond > 5 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {metrics.metrics.eventsPerSecond > 10 ? 'High' : 
                 metrics.metrics.eventsPerSecond > 5 ? 'Medium' : 'Low'}
              </div>
              <div className="text-sm font-medium text-gray-700">Throughput</div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.metrics.eventsPerSecond.toFixed(1)} events/sec
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};