import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Settings,
  Plus,
  Trash2,
  Server,
  ExternalLink,
  Wifi,
  WifiOff,
  Database,
  Globe,
  Calendar
} from 'lucide-react';
import { MCPPrivacyConfig } from '@/features/settings/pages/SettingsPage';
import { mcpBridge } from '@/lib/mcpBridge';
import { setupArcherMCPServer, getMCPServerStatus } from '@/lib/mcpSetup';
import { getAllCredentials } from '@/lib/credentialsApi';
import AddMcpServerModal, { NewMcpServerConfig } from './AddMcpServerModal';
import McpServerConfigModal from './McpServerConfigModal';

interface UserMcpServer {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  connectionId?: string;
  connectionName?: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  isEnabled: boolean;
  createdAt: string;
  lastTested?: string;
  errorMessage?: string;
}

interface McpServerConfig {
  connectionId: string;
  connectionName: string;
  isEnabled: boolean;
  lastConfigured?: string;
  lastTested?: string;
  testStatus?: 'success' | 'error' | 'pending';
}

interface MCPServerConfigProps {
  config: MCPPrivacyConfig;
  onConfigChange: (config: MCPPrivacyConfig) => void;
  canModify: boolean;
  isSaving: boolean;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'grc': return <Database className="h-4 w-4" />;
    case 'integration': return <ExternalLink className="h-4 w-4" />;
    case 'automation': return <Settings className="h-4 w-4" />;
    case 'analytics': return <Server className="h-4 w-4" />;
    default: return <Globe className="h-4 w-4" />;
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'grc': return 'GRC & Compliance';
    case 'integration': return 'Integration Platform';
    case 'automation': return 'Automation Tool';
    case 'analytics': return 'Analytics & Reporting';
    default: return 'Custom Solution';
  }
};

export default function MCPServerConfig({
  config,
  onConfigChange,
  canModify,
  isSaving
}: MCPServerConfigProps) {
  const [servers, setServers] = useState<UserMcpServer[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState<string | null>(null);
  const [serverConfigurations, setServerConfigurations] = useState<Record<string, McpServerConfig>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load user's MCP servers from storage
  useEffect(() => {
    loadMcpServers();
  }, [config.tenantId]);

  // Auto-refresh server status every 30 seconds
  useEffect(() => {
    if (servers.length > 0) {
      const interval = setInterval(refreshServerStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [servers.length]);

  const loadMcpServers = () => {
    setIsLoading(true);
    try {
      const storageKey = `tenant_mcp_servers_${config.tenantId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const userServers: UserMcpServer[] = JSON.parse(stored).map((server: any) => ({
          ...server,
          status: server.status || 'disconnected'
        }));
        setServers(userServers);
      } else {
        // Start with empty list - users add their own servers
        setServers([]);
      }

      // Load server configurations
      const configKey = `mcp_server_configs_${config.tenantId}`;
      const storedConfigs = localStorage.getItem(configKey);
      if (storedConfigs) {
        setServerConfigurations(JSON.parse(storedConfigs));
      }
    } catch (error) {
      console.error('Error loading MCP servers:', error);
      setServers([]);
    }
    setIsLoading(false);
  };

  const saveMcpServers = (updatedServers: UserMcpServer[]) => {
    try {
      const storageKey = `tenant_mcp_servers_${config.tenantId}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedServers));
      setServers(updatedServers);
    } catch (error) {
      console.error('Error saving MCP servers:', error);
    }
  };

  const handleAddServer = async (serverConfig: NewMcpServerConfig) => {
    setIsLoading(true);
    
    try {
      // If this is an Archer GRC server, use the setup utility
      if (serverConfig.category === 'GRC' && serverConfig.connectionId) {
        console.log('[MCP UI] Setting up Archer GRC MCP server with connection:', serverConfig.connectionId);
        
        const setupResult = await setupArcherMCPServer(
          config.tenantId,
          serverConfig.connectionId,
          {
            enablePrivacyMasking: true,
            maskingLevel: 'moderate',
            enableCaching: true
          }
        );
        
        if (setupResult.success) {
          const newServer: UserMcpServer = {
            ...serverConfig,
            id: setupResult.serverId!,
            status: setupResult.healthCheck?.isHealthy ? 'connected' : 'error',
            lastTested: new Date().toISOString(),
            errorMessage: setupResult.healthCheck?.isHealthy ? undefined : 'Health check failed'
          };
          
          const updatedServers = [...servers, newServer];
          saveMcpServers(updatedServers);
          
          console.log(`[MCP UI] Successfully set up MCP server: ${setupResult.serverId}`);
        } else {
          console.error('[MCP UI] Failed to setup MCP server:', setupResult.error);
          // Still add to UI but mark as error
          const newServer: UserMcpServer = {
            ...serverConfig,
            status: 'error',
            lastTested: new Date().toISOString(),
            errorMessage: setupResult.error
          };
          
          const updatedServers = [...servers, newServer];
          saveMcpServers(updatedServers);
        }
      } else {
        // Legacy handling for non-Archer servers
        const newServer: UserMcpServer = {
          ...serverConfig,
          status: 'disconnected',
          lastTested: new Date().toISOString()
        };
        
        const updatedServers = [...servers, newServer];
        saveMcpServers(updatedServers);
      }
      
      // Refresh server status after adding
      await refreshServerStatus();
      
    } catch (error) {
      console.error('[MCP UI] Error adding server:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditServer = (serverId: string) => {
    setEditModalOpen(serverId);
  };

  const handleUpdateServer = async (serverId: string, updatedConfig: Partial<NewMcpServerConfig>) => {
    const updatedServers = servers.map(server => 
      server.id === serverId ? { 
        ...server, 
        ...updatedConfig,
        lastTested: new Date().toISOString()
      } : server
    );
    saveMcpServers(updatedServers);

    // Sync to MCP bridge
    await mcpBridge.syncSettingsToMcpServer(config.tenantId);
    setEditModalOpen(null);
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!canModify) return;

    const updatedServers = servers.filter(s => s.id !== serverId);
    saveMcpServers(updatedServers);

    // Remove from configurations
    const updatedConfigs = { ...serverConfigurations };
    delete updatedConfigs[serverId];
    setServerConfigurations(updatedConfigs);

    const configKey = `mcp_server_configs_${config.tenantId}`;
    localStorage.setItem(configKey, JSON.stringify(updatedConfigs));

    // Update main config
    const updatedConfig = {
      ...config,
      enabledMcpServers: config.enabledMcpServers.filter(id => id !== serverId)
    };
    onConfigChange(updatedConfig);

    // Sync to MCP bridge
    await mcpBridge.syncSettingsToMcpServer(config.tenantId);
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    if (!canModify) return;

    // Update server enabled status
    const updatedServers = servers.map(s => 
      s.id === serverId ? { ...s, isEnabled: enabled } : s
    );
    saveMcpServers(updatedServers);

    // Update enabled servers list
    const enabledServers = enabled 
      ? [...config.enabledMcpServers.filter(id => id !== serverId), serverId]
      : config.enabledMcpServers.filter(id => id !== serverId);

    const updatedConfig = {
      ...config,
      enabledMcpServers: enabledServers
    };
    onConfigChange(updatedConfig);
  };

  // Add refresh server status function
  const refreshServerStatus = async () => {
    try {
      const status = await getMCPServerStatus(config.tenantId);
      
      const updatedServers = servers.map(server => {
        const statusInfo = status.servers.find(s => s.serverId === server.id);
        if (statusInfo) {
          return {
            ...server,
            status: statusInfo.isHealthy ? 'connected' as const : 'error' as const,
            lastTested: statusInfo.lastHealthCheck || server.lastTested
          };
        }
        return server;
      });
      
      setServers(updatedServers);
    } catch (error) {
      console.warn('[MCP UI] Failed to refresh server status:', error);
    }
  };

  // Add test connection function
  const testConnection = async (serverId: string) => {
    const serverIndex = servers.findIndex(s => s.id === serverId);
    if (serverIndex === -1) return;

    const updatedServers = [...servers];
    updatedServers[serverIndex] = {
      ...updatedServers[serverIndex],
      status: 'testing'
    };
    setServers(updatedServers);

    try {
      // Use new MCP test functionality
      const { testMCPServerConnection } = await import('@/lib/mcpSetup');
      const testResult = await testMCPServerConnection(config.tenantId, serverId);

      updatedServers[serverIndex] = {
        ...updatedServers[serverIndex],
        status: testResult.success ? 'connected' : 'error',
        lastTested: new Date().toISOString(),
        errorMessage: testResult.success ? 
          `Response time: ${testResult.responseTime}ms, Tools: ${testResult.availableTools}` : 
          testResult.error
      };

    } catch (error) {
      updatedServers[serverIndex] = {
        ...updatedServers[serverIndex],
        status: 'error',
        lastTested: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'Connection failed'
      };
    }

    saveMcpServers(updatedServers);
  };

  // Quick setup function for Archer GRC
  const setupArcherGRCServer = async () => {
    try {
      setIsLoading(true);
      
      // Get available Archer credentials
      const credentials = await getAllCredentials();
      const archerCredentials = credentials.filter(cred => 
        cred.name?.toLowerCase().includes('archer') ||
        cred.baseUrl?.toLowerCase().includes('archer')
      );
      
      if (archerCredentials.length === 0) {
        // Show alert that credentials are needed first
        alert('No Archer GRC connections found. Please add an Archer connection in the Connections tab first.');
        return;
      }
      
      // Use first available Archer connection
      const firstConnection = archerCredentials[0];
      
      const serverConfig: NewMcpServerConfig = {
        id: `archer-grc-${Date.now()}`,
        name: `Archer GRC - ${firstConnection.name}`,
        description: 'RSA Archer GRC Platform integration with privacy protection and caching',
        endpoint: 'http://localhost:3001', // Will be resolved by connection manager
        connectionId: firstConnection.id,
        connectionName: firstConnection.name,
        category: 'GRC',
        isEnabled: true,
        createdAt: new Date().toISOString()
      };
      
      await handleAddServer(serverConfig);
      
      console.log('[MCP UI] Quick setup completed for Archer GRC');
      
    } catch (error) {
      console.error('[MCP UI] Quick setup failed:', error);
      alert('Quick setup failed. Please try adding the server manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigurationSave = async (serverId: string, serverConfig: McpServerConfig) => {
    if (!canModify) return;

    // Update server configurations
    const updatedConfigs = {
      ...serverConfigurations,
      [serverId]: serverConfig
    };
    setServerConfigurations(updatedConfigs);

    // Save to localStorage
    const configKey = `mcp_server_configs_${config.tenantId}`;
    localStorage.setItem(configKey, JSON.stringify(updatedConfigs));

    // Update server status
    const updatedServers = servers.map(s => 
      s.id === serverId ? {
        ...s,
        connectionId: serverConfig.connectionId,
        connectionName: serverConfig.connectionName,
        status: 'connected' as const
      } : s
    );
    saveMcpServers(updatedServers);

    // Sync to MCP bridge
    await mcpBridge.syncSettingsToMcpServer(config.tenantId);
    setConfigModalOpen(null);
  };

  const getStatusIcon = (status: UserMcpServer['status']) => {
    switch (status) {
      case 'connected': return <Wifi className="h-4 w-4 text-green-600" />;
      case 'disconnected': return <WifiOff className="h-4 w-4 text-gray-400" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'testing': return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default: return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (server: UserMcpServer) => {
    switch (server.status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge>;
      case 'disconnected':
        return <Badge variant="secondary">Disconnected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'testing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Testing</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading MCP servers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">MCP Server Management</h3>
          <p className="text-sm text-gray-600">
            Add and configure Model Context Protocol servers for AI agent integration
          </p>
        </div>
        {canModify && (
          <Button onClick={() => setAddModalOpen(true)} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add MCP Server</span>
          </Button>
        )}
      </div>

      {/* Quick Setup for Archer GRC */}
      {servers.length === 0 && canModify && (
        <Card className="border border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Database className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">Quick Setup: Archer GRC</h4>
                  <p className="text-sm text-blue-700">Connect to your existing Archer GRC instance</p>
                </div>
              </div>
              <Button 
                onClick={setupArcherGRCServer}
                variant="outline" 
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Quick Setup
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MCP Servers List */}
      {servers.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No MCP Servers Configured</h3>
            <p className="text-gray-600 text-center max-w-md">
              Add your first MCP server using the "Add MCP Server" button above to enable AI agent integration with external systems and tools.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {servers.map((server) => {
            const serverConfig = serverConfigurations[server.id];
            
            return (
              <Card 
                key={server.id}
                className={`transition-all hover:shadow-md ${
                  server.isEnabled ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <CardTitle className="text-base">{server.name}</CardTitle>
                        {getStatusIcon(server.status)}
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline" className="text-xs flex items-center space-x-1">
                          {getCategoryIcon(server.category)}
                          <span>{getCategoryLabel(server.category)}</span>
                        </Badge>
                        {serverConfig && (
                          <Badge variant="default" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                            Configured
                          </Badge>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(server)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-600">
                    {server.description}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">Endpoint:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                        {server.endpoint}
                      </code>
                    </div>
                    
                    {server.connectionName && (
                      <div className="flex items-center space-x-2">
                        <Database className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">Connection:</span>
                        <span className="font-medium">{server.connectionName}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">Added:</span>
                      <span>{new Date(server.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {server.errorMessage && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-red-800 text-xs">{server.errorMessage}</span>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={server.isEnabled}
                          onChange={(e) => handleToggleServer(server.id, e.target.checked)}
                          disabled={!canModify || isSaving}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">
                          {server.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testConnection(server.id)}
                        disabled={server.status === 'testing'}
                        className="flex items-center space-x-1"
                      >
                        {server.status === 'testing' ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Testing</span>
                          </>
                        ) : (
                          <>
                            <Wifi className="h-3 w-3" />
                            <span>Test</span>
                          </>
                        )}
                      </Button>
                      {canModify && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditServer(server.id)}
                            className="flex items-center space-x-1"
                          >
                            <Settings className="h-3 w-3" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteServer(server.id)}
                            className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary Footer */}
      {servers.length > 0 && (
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <Server className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    {servers.length} server{servers.length !== 1 ? 's' : ''} configured
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">
                    {servers.filter(s => s.isEnabled).length} enabled
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="bg-white">
                {servers.filter(s => s.status === 'connected').length} connected
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add MCP Server Modal */}
      <AddMcpServerModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddServer}
      />

      {/* Edit MCP Server Modal */}
      {editModalOpen && (() => {
        const serverToEdit = servers.find(s => s.id === editModalOpen);
        return serverToEdit ? (
          <AddMcpServerModal
            isOpen={!!editModalOpen}
            onClose={() => setEditModalOpen(null)}
            onSave={(config) => handleUpdateServer(editModalOpen, config)}
            editMode={true}
            initialConfig={{
              id: serverToEdit.id,
              name: serverToEdit.name,
              description: serverToEdit.description,
              endpoint: serverToEdit.endpoint,
              connectionId: serverToEdit.connectionId,
              connectionName: serverToEdit.connectionName,
              category: serverToEdit.category,
              isEnabled: serverToEdit.isEnabled,
              createdAt: serverToEdit.createdAt
            }}
          />
        ) : null;
      })()}

      {/* Configuration Modal */}
      {configModalOpen && (() => {
        const server = servers.find(s => s.id === configModalOpen);
        return server ? (
          <McpServerConfigModal
            isOpen={!!configModalOpen}
            onClose={() => setConfigModalOpen(null)}
            server={{
              id: server.id,
              name: server.name,
              description: server.description,
              status: server.status as 'connected' | 'disconnected' | 'error'
            }}
            onSave={handleConfigurationSave}
            currentConfig={serverConfigurations[configModalOpen]}
          />
        ) : null;
      })()}
    </div>
  );
}