/**
 * Real-Time Analytics Dashboard
 * Main dashboard component showing live GRC metrics and insights
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  Shield,
  Target,
  RefreshCw,
  Calendar,
  Settings,
  Bell,
  BarChart3,
  Eye,
  Clock,
  Brain
} from 'lucide-react';
import { useAuthStore } from '@/app/store/auth';
import { analyticsService } from '../services/analyticsService';
import { 
  RealTimeMetrics, 
  RiskAnalytics, 
  ComplianceAnalytics, 
  ControlAnalytics,
  PredictiveInsights,
  EventStream,
  AnalyticsTimeRange,
  MLModel
} from '../types';
import { MetricsOverview } from './MetricsOverview';
import { RiskAnalyticsDashboard } from './RiskAnalyticsDashboard';
import { ComplianceDashboard } from './ComplianceDashboard';
import { EventStreamViewer } from './EventStreamViewer';
import { PredictiveAnalytics } from './PredictiveAnalytics';
import { ModelManagement } from './ModelManagement';

interface RealTimeDashboardProps {
  tenantId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({
  tenantId: propTenantId,
  autoRefresh = false,
  refreshInterval = 30000
}) => {
  const { tenant } = useAuthStore();
  const activeTenantId = propTenantId || tenant?.id || '';

  // State management
  const [activeTab, setActiveTab] = useState<'overview' | 'risks' | 'compliance' | 'controls' | 'events' | 'predictions' | 'models'>('overview');
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
    label: '24 hours'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefresh);

  // Analytics data state
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null);
  const [riskAnalytics, setRiskAnalytics] = useState<RiskAnalytics | null>(null);
  const [complianceAnalytics, setComplianceAnalytics] = useState<ComplianceAnalytics | null>(null);
  const [controlAnalytics, setControlAnalytics] = useState<ControlAnalytics | null>(null);
  const [predictiveInsights, setPredictiveInsights] = useState<PredictiveInsights | null>(null);
  const [recentEvents, setRecentEvents] = useState<EventStream[]>([]);
  const [mlModels, setMlModels] = useState<MLModel[]>([]);

  // Load debug information
  const loadDebugInfo = async () => {
    if (!activeTenantId) return;

    try {
      const response = await fetch(`/api/v1/analytics/debug`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setDebugInfo(result.data);
      }
    } catch (error) {
      console.error('Error loading debug info:', error);
    }
  };

  // Load all dashboard data
  const loadDashboardData = async () => {
    if (!activeTenantId) return;

    setIsLoading(true);
    try {
      const [metrics, risks, compliance, controls, predictions, events, models] = await Promise.all([
        analyticsService.getRealTimeMetrics(activeTenantId),
        analyticsService.getRiskAnalytics(activeTenantId, timeRange),
        analyticsService.getComplianceAnalytics(activeTenantId, timeRange),
        analyticsService.getControlAnalytics(activeTenantId, timeRange),
        analyticsService.getPredictiveInsights(activeTenantId),
        analyticsService.getRecentEvents(activeTenantId, { limit: 100 }),
        analyticsService.getMLModels(activeTenantId)
      ]);

      setRealTimeMetrics(metrics);
      setRiskAnalytics(risks);
      setComplianceAnalytics(compliance);
      setControlAnalytics(controls);
      setPredictiveInsights(predictions);
      setRecentEvents(events);
      setMlModels(models);
      setLastUpdated(new Date());

      // Load debug info if debug mode is enabled
      if (showDebug) {
        await loadDebugInfo();
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    loadDashboardData();

    if (autoRefreshEnabled) {
      const interval = setInterval(loadDashboardData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [activeTenantId, timeRange, autoRefreshEnabled, refreshInterval]);

  // Real-time event subscription
  useEffect(() => {
    if (!activeTenantId) return;

    const unsubscribe = analyticsService.subscribeToEvents(
      activeTenantId,
      ['RISK_UPDATED', 'CONTROL_FAILED', 'COMPLIANCE_GAP_DETECTED', 'SYSTEM_ERROR'],
      (event) => {
        setRecentEvents(prev => [event, ...prev.slice(0, 99)]);
        // Optionally trigger a data refresh for significant events
        if (event.severity === 'critical' || event.eventType.includes('FAILED')) {
          loadDashboardData();
        }
      }
    );

    return unsubscribe;
  }, [activeTenantId]);

  // Time range options
  const timeRangeOptions = [
    { label: '1 hour', value: 1 * 60 * 60 * 1000 },
    { label: '6 hours', value: 6 * 60 * 60 * 1000 },
    { label: '24 hours', value: 24 * 60 * 60 * 1000 },
    { label: '7 days', value: 7 * 24 * 60 * 60 * 1000 },
    { label: '30 days', value: 30 * 24 * 60 * 60 * 1000 }
  ];

  const handleTimeRangeChange = (value: number, label: string) => {
    setTimeRange({
      start: new Date(Date.now() - value),
      end: new Date(),
      label
    });
  };

  // Alert summary
  const alertSummary = useMemo(() => {
    if (!realTimeMetrics || !riskAnalytics || !complianceAnalytics || !controlAnalytics) {
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }

    return {
      critical: riskAnalytics.criticalRisks + controlAnalytics.failedControls,
      high: riskAnalytics.highRisks + complianceAnalytics.criticalGaps.length,
      medium: Math.floor(realTimeMetrics.metrics.riskTrends.complianceGaps / 2),
      low: Math.floor(realTimeMetrics.metrics.riskTrends.complianceGaps / 2)
    };
  }, [realTimeMetrics, riskAnalytics, complianceAnalytics, controlAnalytics]);

  if (!activeTenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No tenant selected</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">GRC Analytics Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Real-time insights and predictive analysis for {tenant?.name || 'your organization'}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Time Range Selector */}
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <select
                value={timeRange.label}
                onChange={(e) => {
                  const option = timeRangeOptions.find(opt => opt.label === e.target.value);
                  if (option) {
                    handleTimeRangeChange(option.value, option.label);
                  }
                }}
                className="border rounded px-3 py-1 text-sm"
              >
                {timeRangeOptions.map(option => (
                  <option key={option.label} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-refresh toggle */}
            <Button
              variant={autoRefreshEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${autoRefreshEnabled ? 'animate-spin' : ''}`} />
              <span>Auto-refresh</span>
            </Button>

            {/* Manual refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            {/* Last updated */}
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="h-4 w-4 mr-1" />
              <span>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {/* Alert Summary Bar */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h3 className="font-semibold text-gray-900">Alert Summary</h3>
              
              {alertSummary.critical > 0 && (
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <Badge variant="destructive" className="text-xs">
                    {alertSummary.critical} Critical
                  </Badge>
                </div>
              )}
              
              {alertSummary.high > 0 && (
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <Badge className="bg-orange-100 text-orange-800 text-xs">
                    {alertSummary.high} High
                  </Badge>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-xs">
                  {alertSummary.medium} Medium
                </Badge>
              </div>
            </div>
            
            <Button variant="outline" size="sm" className="flex items-center space-x-2">
              <Bell className="h-4 w-4" />
              <span>Configure Alerts</span>
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'risks', label: 'Risk Analytics', icon: AlertTriangle },
              { id: 'compliance', label: 'Compliance', icon: Shield },
              { id: 'controls', label: 'Controls', icon: Target },
              { id: 'events', label: 'Live Events', icon: Activity },
              { id: 'predictions', label: 'Predictions', icon: TrendingUp },
              { id: 'models', label: 'ML Models', icon: Brain }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && realTimeMetrics && (
          <MetricsOverview 
            metrics={realTimeMetrics}
            riskAnalytics={riskAnalytics}
            complianceAnalytics={complianceAnalytics}
            controlAnalytics={controlAnalytics}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'risks' && riskAnalytics && (
          <RiskAnalyticsDashboard
            analytics={riskAnalytics}
            events={recentEvents.filter(e => e.eventType.startsWith('RISK_'))}
            timeRange={timeRange}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'compliance' && complianceAnalytics && (
          <ComplianceDashboard
            analytics={complianceAnalytics}
            events={recentEvents.filter(e => e.eventType.includes('COMPLIANCE'))}
            timeRange={timeRange}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'controls' && controlAnalytics && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <span>Control Performance</span>
                  </div>
                  <Button
                    variant={showDebug ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setShowDebug(!showDebug);
                      if (!showDebug && !debugInfo) {
                        loadDebugInfo();
                      }
                    }}
                    className="flex items-center space-x-2"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Debug Mode</span>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {controlAnalytics.totalControls}
                    </div>
                    <div className="text-sm font-medium text-gray-700">Total Controls</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {controlAnalytics.effectiveControls}
                    </div>
                    <div className="text-sm font-medium text-gray-700">Effective</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {controlAnalytics.failedControls}
                    </div>
                    <div className="text-sm font-medium text-gray-700">Failed</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {controlAnalytics.controlEffectiveness.toFixed(1)}%
                    </div>
                    <div className="text-sm font-medium text-gray-700">Effectiveness</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {showDebug && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5 text-orange-600" />
                    <span>MCP Debug Information</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadDebugInfo}
                      disabled={isLoading}
                      className="ml-auto"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {debugInfo ? (
                    <div className="space-y-6">
                      {/* MCP Connection Status */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">MCP Connection Status</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium text-gray-700">Status</div>
                            <Badge variant={debugInfo.mcpConnection.status === 'connected' ? 'default' : 'destructive'}>
                              {debugInfo.mcpConnection.status}
                            </Badge>
                          </div>
                          {debugInfo.mcpConnection.error && (
                            <div>
                              <div className="text-sm font-medium text-gray-700">Error</div>
                              <div className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                                {debugInfo.mcpConnection.error}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Authentication Status */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Archer Authentication</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium text-gray-700">Login Status</div>
                            <Badge variant={debugInfo.authentication.loginStatus === 'success' ? 'default' : 'destructive'}>
                              {debugInfo.authentication.loginStatus}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">Session Valid</div>
                            <Badge variant={debugInfo.authentication.sessionValid ? 'default' : 'destructive'}>
                              {debugInfo.authentication.sessionValid ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          {debugInfo.authentication.error && (
                            <div className="col-span-2">
                              <div className="text-sm font-medium text-gray-700">Error</div>
                              <div className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                                {debugInfo.authentication.error}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Application Discovery */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Application Discovery</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium text-gray-700">Status</div>
                            <Badge variant={debugInfo.applicationDiscovery.status === 'success' ? 'default' : 'destructive'}>
                              {debugInfo.applicationDiscovery.status}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">Total Applications</div>
                            <div className="text-lg font-bold text-blue-600">
                              {debugInfo.applicationDiscovery.totalApps}
                            </div>
                          </div>
                          {debugInfo.applicationDiscovery.error && (
                            <div className="col-span-2">
                              <div className="text-sm font-medium text-gray-700">Error</div>
                              <div className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                                {debugInfo.applicationDiscovery.error}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Data Retrieval Status */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Data Retrieval Status</h4>
                        <div className="space-y-4">
                          {/* Risk Register */}
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">Risk Register</span>
                              <Badge variant={debugInfo.dataRetrieval.riskRegister.status === 'success' ? 'default' : 'destructive'}>
                                {debugInfo.dataRetrieval.riskRegister.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-gray-700">Record Count</div>
                                <div className="text-lg font-bold text-green-600">
                                  {debugInfo.dataRetrieval.riskRegister.recordCount}
                                </div>
                              </div>
                              {debugInfo.dataRetrieval.riskRegister.error && (
                                <div>
                                  <div className="text-sm font-medium text-gray-700">Error</div>
                                  <div className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                                    {debugInfo.dataRetrieval.riskRegister.error}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">Controls</span>
                              <Badge variant={debugInfo.dataRetrieval.controls.status === 'success' ? 'default' : 'destructive'}>
                                {debugInfo.dataRetrieval.controls.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-gray-700">Record Count</div>
                                <div className="text-lg font-bold text-green-600">
                                  {debugInfo.dataRetrieval.controls.recordCount}
                                </div>
                              </div>
                              {debugInfo.dataRetrieval.controls.error && (
                                <div>
                                  <div className="text-sm font-medium text-gray-700">Error</div>
                                  <div className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                                    {debugInfo.dataRetrieval.controls.error}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Control Self Assessment */}
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">Control Self Assessment</span>
                              <Badge variant={debugInfo.dataRetrieval.controlSelfAssessment.status === 'success' ? 'default' : 'destructive'}>
                                {debugInfo.dataRetrieval.controlSelfAssessment.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-gray-700">Record Count</div>
                                <div className="text-lg font-bold text-green-600">
                                  {debugInfo.dataRetrieval.controlSelfAssessment.recordCount}
                                </div>
                              </div>
                              {debugInfo.dataRetrieval.controlSelfAssessment.error && (
                                <div>
                                  <div className="text-sm font-medium text-gray-700">Error</div>
                                  <div className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                                    {debugInfo.dataRetrieval.controlSelfAssessment.error}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Raw Debug Data */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Raw Debug Data</h4>
                        <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                          <pre className="text-sm font-mono">
                            {JSON.stringify(debugInfo, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-gray-500">Loading debug information...</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <EventStreamViewer
            events={recentEvents}
            tenantId={activeTenantId}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'predictions' && predictiveInsights && (
          <PredictiveAnalytics
            insights={predictiveInsights}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'models' && (
          <ModelManagement
            models={mlModels}
            isLoading={isLoading}
            onModelAction={handleModelAction}
          />
        )}
      </div>
    </div>
  );

  function handleModelAction(modelId: string, action: 'start' | 'stop' | 'retrain' | 'delete') {
    console.log(`Model action: ${action} for model ${modelId}`);
    // TODO: Implement actual model management API calls
  }
};