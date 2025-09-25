/**
 * Risk Analytics Dashboard Component
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { RiskAnalytics, EventStream, AnalyticsTimeRange } from '../types';

interface RiskAnalyticsDashboardProps {
  analytics: RiskAnalytics;
  events: EventStream[];
  timeRange: AnalyticsTimeRange;
  isLoading: boolean;
}

export const RiskAnalyticsDashboard: React.FC<RiskAnalyticsDashboardProps> = ({
  analytics,
  events: _events,
  timeRange: _timeRange,
  isLoading
}) => {
  if (isLoading) {
    return <div className="animate-pulse">Loading risk analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-red-600">{analytics.totalRisks}</div>
            <div className="text-sm text-gray-600">Total Risks</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-orange-600">{analytics.highRisks}</div>
            <div className="text-sm text-gray-600">High Risks</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-700">
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-red-700">{analytics.criticalRisks}</div>
            <div className="text-sm text-gray-600">Critical Risks</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              {analytics.riskTrend === 'increasing' ? (
                <TrendingUp className="h-5 w-5 text-red-500" />
              ) : analytics.riskTrend === 'decreasing' ? (
                <TrendingDown className="h-5 w-5 text-green-500" />
              ) : (
                <div className="w-5 h-1 bg-gray-400 rounded" />
              )}
              <div className="text-lg font-bold capitalize">{analytics.riskTrend}</div>
            </div>
            <div className="text-sm text-gray-600">Risk Trend</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Risks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>Top Risks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.topRisks.slice(0, 10).map((risk) => (
              <div key={risk.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{risk.title}</div>
                  <div className="text-sm text-gray-600">{risk.category}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={risk.score >= 90 ? "destructive" : risk.score >= 70 ? "secondary" : "outline"}>
                    {risk.score}
                  </Badge>
                  {risk.trend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : risk.trend === 'down' ? (
                    <TrendingDown className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-1 bg-gray-400 rounded" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};