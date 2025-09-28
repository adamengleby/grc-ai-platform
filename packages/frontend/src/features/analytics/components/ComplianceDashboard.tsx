/**
 * Compliance Dashboard Component
 * Shows comprehensive compliance analytics and framework monitoring
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  FileText,
  Calendar,
  Filter,
  Download,
  Eye,
  BarChart3
} from 'lucide-react';
import { ComplianceAnalytics, EventStream, AnalyticsTimeRange } from '../types';

interface ComplianceDashboardProps {
  analytics: ComplianceAnalytics;
  events: EventStream[];
  timeRange: AnalyticsTimeRange;
  isLoading: boolean;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  analytics,
  events,
  timeRange,
  isLoading
}) => {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [showOnlyGaps, setShowOnlyGaps] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-100';
      case 'non_compliant': return 'text-red-600 bg-red-100';
      case 'partially_compliant': return 'text-yellow-600 bg-yellow-100';
      case 'not_assessed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredFrameworks = selectedFramework 
    ? analytics.frameworks.filter(f => f.name === selectedFramework)
    : analytics.frameworks;

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Compliance Dashboard</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Framework Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={selectedFramework || ''}
              onChange={(e) => setSelectedFramework(e.target.value || null)}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="">All Frameworks</option>
              {analytics.frameworks.map((framework) => (
                <option key={framework.name} value={framework.name}>
                  {framework.name}
                </option>
              ))}
            </select>
          </div>

          {/* Show Only Gaps Toggle */}
          <Button
            variant={showOnlyGaps ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyGaps(!showOnlyGaps)}
            className="flex items-center space-x-2"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Gaps Only</span>
          </Button>

          {/* Export */}
          <Button variant="outline" size="sm" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </Button>
        </div>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Score</p>
                <p className="text-2xl font-bold text-blue-600">
                  {analytics.overallScore.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Across {analytics.frameworks.length} frameworks
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliant</p>
                <p className="text-2xl font-bold text-green-600">
                  {analytics.frameworks.reduce((sum, f) => sum + f.compliantControls, 0)}
                </p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Controls passing
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Gaps</p>
                <p className="text-2xl font-bold text-red-600">
                  {analytics.criticalGaps.length}
                </p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Require attention
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Trend</p>
                <div className="flex items-center space-x-1">
                  {analytics.trend === 'improving' ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : analytics.trend === 'declining' ? (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  ) : (
                    <div className="w-5 h-1 bg-gray-400 rounded" />
                  )}
                  <p className="text-lg font-bold capitalize text-purple-600">
                    {analytics.trend}
                  </p>
                </div>
                <p className="text-xs text-gray-500">Overall direction</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Framework Compliance Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Framework Compliance</span>
            <Badge variant="secondary" className="text-xs">
              {filteredFrameworks.length} frameworks
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredFrameworks.map((framework) => (
              <div key={framework.name} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">{framework.name}</h4>
                    <p className="text-sm text-gray-600">{framework.description}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {framework.complianceScore.toFixed(1)}%
                    </div>
                    <Badge className={getComplianceStatusColor(framework.status)}>
                      {framework.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">
                      {framework.compliantControls}
                    </div>
                    <div className="text-xs text-gray-600">Compliant</div>
                  </div>
                  
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">
                      {framework.partiallyCompliantControls}
                    </div>
                    <div className="text-xs text-gray-600">Partial</div>
                  </div>
                  
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-lg font-bold text-red-600">
                      {framework.nonCompliantControls}
                    </div>
                    <div className="text-xs text-gray-600">Non-Compliant</div>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-600">
                      {framework.notAssessedControls}
                    </div>
                    <div className="text-xs text-gray-600">Not Assessed</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-600">
                      Last Assessment: {framework.lastAssessment.toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-1" />
                      Next Due: {framework.nextAssessmentDue.toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="flex items-center space-x-1">
                      <Eye className="h-3 w-3" />
                      <span>View Details</span>
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center space-x-1">
                      <FileText className="h-3 w-3" />
                      <span>Generate Report</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Critical Compliance Gaps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>Critical Compliance Gaps</span>
            <Badge variant="destructive" className="text-xs">
              {analytics.criticalGaps.length} critical issues
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.criticalGaps.map((gap, index) => (
              <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-full ${getSeverityColor(gap.severity)}`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900">{gap.controlId}</h4>
                      <p className="text-sm text-gray-600 mt-1">{gap.description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>Framework: {gap.framework}</span>
                        <span>•</span>
                        <span>Category: {gap.category}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge className={getSeverityColor(gap.severity)}>
                      {gap.severity.toUpperCase()}
                    </Badge>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Due: {gap.dueDate.toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="border-t border-red-200 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-gray-900 mb-1">Remediation Required:</h5>
                      <p className="text-sm text-gray-700">{gap.remediationActions}</p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        Assign
                      </Button>
                      <Button variant="default" size="sm" className="bg-red-600 hover:bg-red-700">
                        Remediate
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {analytics.criticalGaps.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                <p>No critical compliance gaps detected</p>
                <p className="text-sm mt-1">All frameworks are within acceptable compliance levels</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Compliance Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <span>Recent Compliance Events</span>
            <Badge variant="secondary" className="text-xs">
              Last {timeRange.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events.slice(0, 10).map((event, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${getSeverityColor(event.severity)}`}>
                    {event.eventType.includes('COMPLIANCE_GAP') && <AlertTriangle className="h-4 w-4" />}
                    {event.eventType.includes('ASSESSMENT') && <FileText className="h-4 w-4" />}
                    {event.eventType.includes('REMEDIATION') && <Target className="h-4 w-4" />}
                  </div>
                  
                  <div>
                    <div className="font-medium text-gray-900">
                      {event.eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className="text-sm text-gray-600">{event.description}</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <Badge className={getSeverityColor(event.severity)} variant="outline">
                    {event.severity}
                  </Badge>
                  <div className="text-xs text-gray-500 mt-1">
                    {event.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No compliance events in the selected timeframe</p>
                <p className="text-sm mt-1">Check back later for compliance updates</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};