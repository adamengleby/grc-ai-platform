import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Label } from '@/app/components/ui/Label';
import { Alert } from '@/app/components/ui/Alert';
import { Badge } from '@/app/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/Dialog';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Settings,
  Link,
  Database,
  Info
} from 'lucide-react';
import { ArcherCredentials, getAllCredentials } from '@/lib/backendCredentialsApi';
import { credentialsManager } from '@/lib/backendCredentialsApi';
import { useAuthStore } from '@/app/store/auth';

interface McpServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: {
    id: string;
    name: string;
    description?: string;
    status: 'connected' | 'disconnected' | 'error';
  };
  onSave: (serverId: string, config: McpServerConfig) => void;
  currentConfig?: McpServerConfig;
}

interface McpServerConfig {
  connectionId: string;
  connectionName: string;
  isEnabled: boolean;
  lastConfigured?: string;
  lastTested?: string;
  testStatus?: 'success' | 'error' | 'pending';
}

export default function McpServerConfigModal({
  isOpen,
  onClose,
  server,
  onSave,
  currentConfig
}: McpServerConfigModalProps) {
  const { tenant } = useAuthStore();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [availableConnections, setAvailableConnections] = useState<ArcherCredentials[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load available connections on mount
  useEffect(() => {
    loadConnections();
  }, [tenant]);

  // Initialize selected connection when modal opens or currentConfig changes
  useEffect(() => {
    if (isOpen && currentConfig?.connectionId) {
      setSelectedConnectionId(currentConfig.connectionId);
      console.log('[MCP Config Modal] Initializing with saved connection:', currentConfig.connectionId, currentConfig.connectionName);
    } else if (isOpen && !currentConfig) {
      setSelectedConnectionId('');
      console.log('[MCP Config Modal] No saved configuration found, resetting selection');
    }
  }, [isOpen, currentConfig]);

  const loadConnections = async () => {
    if (!tenant) return;

    setIsLoading(true);
    try {
      // Set tenant context for credentials manager
      credentialsManager.setTenantContext(tenant.id);
      await credentialsManager.initialize();
      
      const connections = await getAllCredentials();
      setAvailableConnections(connections);
    } catch (error) {
      console.error('Error loading connections:', error);
      setMessage({ type: 'error', text: 'Failed to load available connections' });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedConnection = availableConnections.find(conn => conn.id === selectedConnectionId);

  const handleTest = async () => {
    if (!selectedConnection) {
      setMessage({ type: 'error', text: 'Please select a connection to test' });
      return;
    }

    setIsTesting(true);
    setMessage({ type: 'info', text: `Testing connection to ${selectedConnection.name}...` });

    try {
      // Ensure tenant context is set for credentials manager
      if (tenant) {
        credentialsManager.setTenantContext(tenant.id);
      }
      
      // Use the credentials manager to test the connection
      const testResult = await credentialsManager.testConnection(selectedConnection);
      
      if (testResult.success) {
        setMessage({ 
          type: 'success', 
          text: `Successfully connected to ${selectedConnection.name}. Response time: ${testResult.details?.responseTime || 'N/A'}ms` 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: `Connection test failed: ${testResult.error || testResult.message}` 
        });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: `Connection test failed: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Removed unused testConnectionViaBackend function

  const handleSave = () => {
    if (!selectedConnection) {
      setMessage({ type: 'error', text: 'Please select a connection' });
      return;
    }

    const config: McpServerConfig = {
      connectionId: selectedConnection.id,
      connectionName: selectedConnection.name,
      isEnabled: true,
      lastConfigured: new Date().toISOString(),
      testStatus: message?.type === 'success' ? 'success' : undefined
    };

    onSave(server.id, config);
    setMessage({ type: 'success', text: 'Configuration saved successfully!' });
    
    setTimeout(() => {
      onClose();
      setMessage(null);
    }, 1500);
  };

  const getConnectionStatusBadge = (connection: ArcherCredentials) => {
    switch (connection.status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge>;
      case 'testing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Testing</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-blue-600" />
            <span>Configure {server.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Server Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-2">MCP Server Information</h3>
            <div className="space-y-1 text-sm">
              <div><strong>Name:</strong> {server.name}</div>
              {server.description && <div><strong>Description:</strong> {server.description}</div>}
              <div><strong>Status:</strong> 
                <Badge 
                  className={`ml-2 ${
                    server.status === 'connected' ? 'bg-green-100 text-green-800' :
                    server.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {server.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Connection Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center space-x-2">
              <Link className="h-4 w-4" />
              <span>Select Connection</span>
            </Label>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading connections...</span>
              </div>
            ) : availableConnections.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <div>
                  <h4 className="font-semibold">No connections available</h4>
                  <p className="text-sm">
                    Please create a connection in the Connections page before configuring MCP servers.
                  </p>
                </div>
              </Alert>
            ) : (
              <div className="space-y-3">
                {availableConnections.map((connection) => (
                  <div
                    key={connection.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedConnectionId === connection.id
                        ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/50'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedConnectionId(connection.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          selectedConnectionId === connection.id 
                            ? 'border-blue-500 bg-blue-500' 
                            : 'border-gray-300'
                        }`}>
                          {selectedConnectionId === connection.id && (
                            <CheckCircle className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <Database className="h-4 w-4 text-gray-600" />
                        <h4 className="font-semibold">{connection.name}</h4>
                      </div>
                      {getConnectionStatusBadge(connection)}
                    </div>
                    
                    <div className="ml-7 space-y-1 text-sm text-gray-600">
                      <div><strong>URL:</strong> {connection.baseUrl}</div>
                      <div><strong>Instance:</strong> {connection.instanceId}</div>
                      <div><strong>Username:</strong> {connection.username}</div>
                      {connection.lastTested && (
                        <div><strong>Last Tested:</strong> {new Date(connection.lastTested).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Test Connection */}
          {selectedConnection && (
            <div className="flex justify-between items-center p-4 border rounded-lg bg-gray-50">
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Test Selected Connection</h4>
                <p className="text-sm text-gray-600">
                  Verify that the MCP server can connect to {selectedConnection.name}
                </p>
              </div>
              <Button
                onClick={handleTest}
                disabled={isTesting}
                variant="outline"
                className="ml-4"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Status Message */}
          {message && (
            <Alert className={`${
              message.type === 'success' ? 'border-green-200 bg-green-50' :
              message.type === 'error' ? 'border-red-200 bg-red-50' :
              'border-blue-200 bg-blue-50'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : message.type === 'error' ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : (
                <Info className="h-4 w-4 text-blue-600" />
              )}
              <span className={
                message.type === 'success' ? 'text-green-800' :
                message.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }>
                {message.text}
              </span>
            </Alert>
          )}

          {/* Current Configuration Info */}
          {currentConfig && (
            <div className="text-sm text-gray-500 pt-2 border-t">
              <div>Currently configured with: <strong>{currentConfig.connectionName}</strong></div>
              {currentConfig.lastConfigured && (
                <div>Last configured: {new Date(currentConfig.lastConfigured).toLocaleString()}</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!selectedConnectionId || isLoading}
          >
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}