import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import {
  Database,
  Clock,
  Zap,
  RefreshCw,
  AlertTriangle,
  Info,
  Settings,
  Activity,
  BarChart3,
  Server,
  CheckCircle
} from 'lucide-react';
import { MCPPrivacyConfig } from '@/pages/SettingsPage';

interface AdvancedConfigProps {
  config: MCPPrivacyConfig;
  onConfigChange: (config: MCPPrivacyConfig) => void;
  canModify: boolean;
  isSaving: boolean;
}

interface PerformanceMetric {
  name: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

// Get real performance metrics from the system
const getPerformanceMetrics = (config: MCPPrivacyConfig): PerformanceMetric[] => {
  const enabledServers = config.enabledMcpServers.length;
  const hasCache = config.enableCaching;
  
  return [
    {
      name: 'Enabled MCP Servers',
      value: enabledServers.toString(),
      trend: 'stable',
      description: 'Number of currently enabled MCP servers'
    },
    {
      name: 'Privacy Protection',
      value: config.enablePrivacyMasking ? config.maskingLevel.toUpperCase() : 'OFF',
      trend: 'stable',
      description: 'Current privacy masking configuration'
    },
    {
      name: 'Response Caching',
      value: hasCache ? 'ENABLED' : 'DISABLED',
      trend: 'stable',
      description: 'Response caching status for performance'
    },
    {
      name: 'Page Size',
      value: config.pageSize?.toString() || '50',
      trend: 'stable',
      description: 'Records per request for API calls'
    }
  ];
};

export default function AdvancedConfig({
  config,
  onConfigChange,
  canModify,
  isSaving: _isSaving
}: AdvancedConfigProps) {

  // Handle configuration field changes
  const handleConfigChange = (field: keyof MCPPrivacyConfig, value: any) => {
    const updatedConfig = {
      ...config,
      [field]: value
    };
    onConfigChange(updatedConfig);
  };

  // Handle boolean toggles
  const handleToggle = (field: keyof MCPPrivacyConfig) => {
    const currentValue = config[field] as boolean;
    handleConfigChange(field, !currentValue);
  };

  // Get performance trend icon
  const getTrendIcon = (trend: PerformanceMetric['trend']) => {
    switch (trend) {
      case 'up':
        return <BarChart3 className="h-4 w-4 text-green-600" />;
      case 'down':
        return <BarChart3 className="h-4 w-4 text-red-600 rotate-180" />;
      default:
        return <Activity className="h-4 w-4 text-blue-600" />;
    }
  };

  // Get current performance metrics based on actual configuration
  const performanceMetrics = getPerformanceMetrics(config);

  return (
    <div className="space-y-6">
      {/* Configuration Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <span>Configuration Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {performanceMetrics.map((metric) => (
              <div key={metric.name} className="text-center p-4 border rounded-lg">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  {getTrendIcon(metric.trend)}
                  <div className="text-2xl font-bold text-gray-900">
                    {metric.value}
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-700 mb-1">
                  {metric.name}
                </div>
                <div className="text-xs text-gray-500">
                  {metric.description}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-blue-600" />
            <span>Performance Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Request Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pageSize" className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span>Page Size</span>
              </Label>
              <Input
                id="pageSize"
                type="number"
                value={config.pageSize}
                onChange={(e) => handleConfigChange('pageSize', parseInt(e.target.value) || 50)}
                min={10}
                max={500}
                disabled={!canModify}
              />
              <p className="text-xs text-gray-500">Records per request (10-500)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Request Timeout</span>
              </Label>
              <div className="relative">
                <Input
                  id="timeout"
                  type="number"
                  value={config.requestTimeout}
                  onChange={(e) => handleConfigChange('requestTimeout', parseInt(e.target.value) || 30)}
                  min={5}
                  max={300}
                  disabled={!canModify}
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                  sec
                </span>
              </div>
              <p className="text-xs text-gray-500">Request timeout (5-300s)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRetries" className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4" />
                <span>Max Retries</span>
              </Label>
              <Input
                id="maxRetries"
                type="number"
                value={config.maxRetries}
                onChange={(e) => handleConfigChange('maxRetries', parseInt(e.target.value) || 3)}
                min={0}
                max={10}
                disabled={!canModify}
              />
              <p className="text-xs text-gray-500">Maximum retry attempts (0-10)</p>
            </div>
          </div>

          {/* Performance Optimizations */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Performance Optimizations</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Response Caching */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h5 className="font-semibold text-sm flex items-center space-x-2">
                    <Database className="h-4 w-4 text-blue-600" />
                    <span>Response Caching</span>
                  </h5>
                  <p className="text-sm text-gray-600 mt-1">
                    Cache responses to improve performance and reduce API calls
                  </p>
                </div>
                <Button
                  variant={config.enableCaching ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleToggle('enableCaching')}
                  disabled={!canModify}
                  className="ml-4"
                >
                  {config.enableCaching ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Enabled
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Disabled
                    </>
                  )}
                </Button>
              </div>

              {/* Background Sync */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h5 className="font-semibold text-sm flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 text-blue-600" />
                    <span>Background Sync</span>
                  </h5>
                  <p className="text-sm text-gray-600 mt-1">
                    Synchronize data in the background to keep cache fresh
                  </p>
                </div>
                <Button
                  variant={config.enableBackgroundSync ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleToggle('enableBackgroundSync')}
                  disabled={!canModify}
                  className="ml-4"
                >
                  {config.enableBackgroundSync ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Enabled
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Disabled
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5 text-blue-600" />
            <span>System Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Configuration Status */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Configuration Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tenant ID:</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {config.tenantId}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Configuration Status:</span>
                  <Badge variant={config.isActive ? "default" : "secondary"}>
                    {config.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Last Updated:</span>
                  <span className="text-xs text-gray-500">
                    {new Date(config.lastUpdated).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* MCP Server Status */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">MCP Server Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Enabled Servers:</span>
                  <Badge variant="outline">
                    {config.enabledMcpServers.length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Privacy Protection:</span>
                  <Badge variant={config.enablePrivacyMasking ? "default" : "secondary"}>
                    {config.enablePrivacyMasking ? config.maskingLevel : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tokenization:</span>
                  <Badge variant={config.enableTokenization ? "default" : "secondary"}>
                    {config.enableTokenization ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-blue-600" />
            <span>Configuration Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Performance Recommendations */}
            {config.pageSize > 200 && (
              <Alert>
                <Info className="h-4 w-4" />
                <div>
                  <h4 className="font-semibold text-sm">Performance Tip</h4>
                  <p className="text-sm">
                    Consider reducing page size below 200 for faster response times, especially with privacy masking enabled.
                  </p>
                </div>
              </Alert>
            )}

            {/* Security Recommendations */}
            {!config.enablePrivacyMasking && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <div>
                  <h4 className="font-semibold text-sm">Security Recommendation</h4>
                  <p className="text-sm">
                    Enable privacy masking to protect sensitive data when working with AI models and external integrations.
                  </p>
                </div>
              </Alert>
            )}

            {/* Caching Recommendations */}
            {!config.enableCaching && config.enabledMcpServers.length > 2 && (
              <Alert>
                <Info className="h-4 w-4" />
                <div>
                  <h4 className="font-semibold text-sm">Performance Recommendation</h4>
                  <p className="text-sm">
                    Enable response caching to improve performance when using multiple MCP servers.
                  </p>
                </div>
              </Alert>
            )}

            {/* Optimal Settings */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-green-800 mb-2">Recommended Settings</h4>
              <div className="text-sm text-green-700 space-y-1">
                <p>• <strong>Page Size:</strong> 50-100 records for optimal balance</p>
                <p>• <strong>Timeout:</strong> 30-60 seconds for reliable connections</p>
                <p>• <strong>Max Retries:</strong> 3 attempts for resilient operation</p>
                <p>• <strong>Caching:</strong> Enable for better performance</p>
                <p>• <strong>Privacy:</strong> Use moderate masking level</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expert Mode Warning */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <div>
          <h4 className="font-semibold mb-1">Advanced Configuration Notice</h4>
          <div className="text-sm space-y-1">
            <p>• These settings directly affect system performance and behavior</p>
            <p>• Incorrect values may cause timeouts, errors, or degraded performance</p>
            <p>• Test changes in a non-production environment when possible</p>
            <p>• Contact support if you experience issues after configuration changes</p>
          </div>
        </div>
      </Alert>
    </div>
  );
}