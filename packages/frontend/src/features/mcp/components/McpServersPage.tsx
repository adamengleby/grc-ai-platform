import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import { useAuthStore, useTenantContext } from '@/app/store/auth';
import { createMcpService } from '@/lib/mcpService';
import { 
  McpServerDefinition, 
  TenantMcpServerConfiguration
} from '@/types/mcp';
import {
  Search,
  Server,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  Activity,
  Shield,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Link,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { clsx } from 'clsx';


const COST_TIER_COLORS = {
  free: 'bg-green-100 text-green-800',
  standard: 'bg-blue-100 text-blue-800',
  premium: 'bg-purple-100 text-purple-800'
};

const HEALTH_STATUS_COLORS = {
  healthy: 'bg-green-100 text-green-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  unhealthy: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-800'
};

export const McpServersPage: React.FC = () => {
  const { user, tenant } = useAuthStore();
  const tenantContext = useTenantContext();
  const [availableServers, setAvailableServers] = useState<McpServerDefinition[]>([]);
  const [enabledServers, setEnabledServers] = useState<TenantMcpServerConfiguration[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (!user || !tenant) return;
      
      const service = createMcpService(tenant.id, user.id, user.roles);
      
      setIsLoading(true);
      setError(null);
      
      try {
        const [available, enabled, conns] = await Promise.all([
          service.getAvailableServers(tenant.subscriptionTier),
          service.getEnabledServers(),
          service.getTenantConnections()
        ]);
        
        console.log('Loaded MCP data:', { available: available.length, enabled: enabled.length, connections: conns.length });
        console.log('Connections:', conns);
        console.log('TenantContext permissions:', tenantContext?.permissions);
        console.log('User roles:', user?.roles);
        
        setAvailableServers(available);
        setEnabledServers(enabled);
        setConnections(conns);
        
        // Set default connection if none selected
        if (!selectedConnection && conns.length > 0) {
          const defaultConn = conns.find(c => c.isDefault) || conns[0];
          setSelectedConnection(defaultConn.id);
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.id, tenant?.id]);

  const handleEnableServer = async (serverId: string) => {
    if (!user || !tenant || !selectedConnection) {
      setError('Missing required information: user, tenant, or connection not selected');
      return;
    }
    
    const service = createMcpService(tenant.id, user.id, user.roles);
    
    try {
      console.log('Enabling server:', { serverId, connectionId: selectedConnection, tenantId: tenant.id });
      await service.enableServer(serverId, selectedConnection);
      
      // Reload data instead of full page reload
      const [available, enabled, conns] = await Promise.all([
        service.getAvailableServers(tenant.subscriptionTier),
        service.getEnabledServers(),
        service.getTenantConnections()
      ]);
      
      setAvailableServers(available);
      setEnabledServers(enabled);
      setConnections(conns);
      
    } catch (err) {
      console.error('Enable server error:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable MCP server');
    }
  };

  const handleDisableServer = async (serverId: string) => {
    if (!user || !tenant) return;
    
    const service = createMcpService(tenant.id, user.id, user.roles);
    
    try {
      await service.disableServer(serverId);
      
      // Reload data instead of full page reload
      const [available, enabled, conns] = await Promise.all([
        service.getAvailableServers(tenant.subscriptionTier),
        service.getEnabledServers(),
        service.getTenantConnections()
      ]);
      
      setAvailableServers(available);
      setEnabledServers(enabled);
      setConnections(conns);
      
    } catch (err) {
      console.error('Disable server error:', err);
      setError(err instanceof Error ? err.message : 'Failed to disable MCP server');
    }
  };

  const handleTestServer = async (serverId: string) => {
    if (!selectedConnection) {
      setError('Please select a connection first');
      return;
    }

    try {
      // Test the MCP server health endpoint
      const server = availableServers.find(s => s.id === serverId);
      if (!server) return;

      const response = await fetch(`${server.endpoint}/health`);
      if (response.ok) {
        const health = await response.json();
        alert(`Server health check passed! Status: ${JSON.stringify(health, null, 2)}`);
      } else {
        setError(`Server health check failed: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error('Test server error:', err);
      setError(err instanceof Error ? err.message : 'Failed to test MCP server');
    }
  };

  const isServerEnabled = (serverId: string): boolean => {
    return enabledServers.some(s => s.serverId === serverId && s.enabled);
  };

  const getServerConfiguration = (serverId: string): TenantMcpServerConfiguration | undefined => {
    return enabledServers.find(s => s.serverId === serverId);
  };

  const filteredServers = availableServers.filter(server =>
    server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    server.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    server.capabilities.some(cap => cap.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!tenantContext) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <div>
            <h4>Authentication Required</h4>
            <p>Please log in to access MCP Servers management.</p>
          </div>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Servers</h1>
          <p className="text-muted-foreground mt-2">
            Manage AI-powered GRC analysis servers for your tenant
          </p>
        </div>
        
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading MCP servers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Servers</h1>
          <p className="text-muted-foreground mt-2">
            Operational management and monitoring of AI-powered GRC analysis servers
          </p>
        </div>
        
        {/* Quick Navigation */}
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border-l-4 border-blue-500">
          <Settings className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">Need to configure server settings?</p>
            <p className="text-xs text-muted-foreground">
              Visit <strong>Settings → MCP Servers</strong> for server configuration, privacy settings, and connection mapping
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <div>
            <h4>Error</h4>
            <p>{error}</p>
          </div>
        </Alert>
      )}

      {/* Architecture Explanation */}
      <Alert>
        <Shield className="h-4 w-4" />
        <div>
          <h4>Operational Management Focus</h4>
          <p className="text-sm mt-1">
            This page provides <strong>operational management</strong> for your MCP servers - monitoring health, testing connections, reviewing usage analytics, and managing server lifecycle. 
            For initial configuration, privacy settings, and connection mapping, use the <strong>Settings page</strong>.
          </p>
        </div>
      </Alert>

      {/* Tenant Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tenant Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm font-medium">Tenant</p>
              <p className="text-sm text-muted-foreground">{tenant?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Subscription</p>
              <Badge variant="secondary">{tenant?.subscriptionTier}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Available Servers</p>
              <p className="text-sm text-muted-foreground">{availableServers.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Enabled Servers</p>
              <p className="text-sm text-muted-foreground">{enabledServers.length}</p>
            </div>
          </div>

          {/* Connection Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Connection for New Servers</label>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a connection...</option>
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.baseUrl}) {conn.isDefault && '(Default)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              This connection will be used by MCP servers to access your Archer GRC platform
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Available MCP Servers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search servers and capabilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Servers Grid */}
          <div className="space-y-4">
            {filteredServers.map((server) => {
              const isEnabled = isServerEnabled(server.id);
              const config = getServerConfiguration(server.id);
              const isExpanded = expandedServer === server.id;

              return (
                <Card key={server.id} className={clsx(
                  'transition-all duration-200',
                  isEnabled && 'ring-2 ring-green-200'
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-muted rounded-lg">
                          <Server className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{server.name}</h3>
                            <Badge variant="secondary">{server.version}</Badge>
                            <Badge className={COST_TIER_COLORS[server.costTier]}>
                              {server.costTier}
                            </Badge>
                            {isEnabled && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Enabled
                              </Badge>
                            )}
                            {config && (
                              <Badge className={HEALTH_STATUS_COLORS[config.healthStatus]}>
                                {config.healthStatus === 'healthy' && <Wifi className="h-3 w-3 mr-1" />}
                                {config.healthStatus === 'unhealthy' && <WifiOff className="h-3 w-3 mr-1" />}
                                {config.healthStatus}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {server.description}
                          </p>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">by {server.vendor}</Badge>
                            <Badge variant="outline">{server.capabilities.length} capabilities</Badge>
                          </div>
                          
                          {/* Capabilities Preview */}
                          <div className="flex gap-1 flex-wrap">
                            {server.capabilities.slice(0, 3).map(cap => (
                              <Badge key={cap} variant="outline" className="text-xs">
                                {cap.replace('_', ' ')}
                              </Badge>
                            ))}
                            {server.capabilities.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{server.capabilities.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedServer(isExpanded ? null : server.id)}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestServer(server.id)}
                          disabled={!selectedConnection}
                        >
                          <Activity className="h-4 w-4 mr-1" />
                          Test
                        </Button>
                        
                        {isEnabled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisableServer(server.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Pause className="h-4 w-4 mr-1" />
                            Disable
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleEnableServer(server.id)}
                              disabled={!selectedConnection || !tenantContext.permissions.some(p => 
                                (p.resource === '*' || p.resource === 'mcp-tools' || p.resource === 'mcp-servers') && p.actions.includes('write')
                              )}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Enable
                            </Button>
                            {/* Debug info */}
                            {(!selectedConnection || !tenantContext.permissions.some(p => 
                              (p.resource === '*' || p.resource === 'mcp-tools' || p.resource === 'mcp-servers') && p.actions.includes('write')
                            )) && (
                              <div className="text-xs text-red-600 ml-2">
                                {!selectedConnection && "No connection selected"}
                                {selectedConnection && !tenantContext.permissions.some(p => 
                                  (p.resource === '*' || p.resource === 'mcp-tools' || p.resource === 'mcp-servers') && p.actions.includes('write')
                                ) && "Missing permissions"}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {/* Server Documentation */}
                        <div>
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">
                            {server.documentation.description}
                          </p>
                        </div>

                        {/* All Capabilities */}
                        <div>
                          <h4 className="font-medium mb-2">AI Capabilities</h4>
                          <div className="space-y-3">
                            {server.documentation.capabilities.map((capability, idx) => (
                              <div key={idx} className="p-3 bg-muted rounded-lg">
                                <h5 className="font-medium text-sm mb-1">{capability.name}</h5>
                                <p className="text-xs text-muted-foreground mb-2">{capability.description}</p>
                                <div className="space-y-1">
                                  <p className="text-xs font-medium">Example AI Requests:</p>
                                  {capability.examples.map((example, exIdx) => (
                                    <p key={exIdx} className="text-xs text-muted-foreground italic">
                                      "{example}"
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Configuration (if enabled) */}
                        {isEnabled && config && (
                          <div>
                            <h4 className="font-medium mb-2">Server Configuration</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">Connection</p>
                                <p className="text-sm text-muted-foreground">
                                  {connections.find(c => c.id === config.connectionMapping.connectionId)?.name || 'Unknown'}
                                </p>
                              </div>
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">Rate Limit</p>
                                <p className="text-sm text-muted-foreground">
                                  {config.serverConfig.rateLimits.requestsPerMinute}/min
                                </p>
                              </div>
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">Total Requests</p>
                                <p className="text-lg font-bold">{config.usage.totalRequests}</p>
                              </div>
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">Avg Response</p>
                                <p className="text-lg font-bold">{config.usage.averageResponseTime}ms</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Connection Requirements */}
                        <div>
                          <h4 className="font-medium mb-2">Supported Connections</h4>
                          <div className="flex gap-2">
                            {server.supportedConnections.map(connType => (
                              <Badge key={connType} variant="outline" className="flex items-center gap-1">
                                <Link className="h-3 w-3" />
                                {connType}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {filteredServers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No MCP servers match your search criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};