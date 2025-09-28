import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/app/store/auth';
import { Card, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/Dialog';
import { 
  Plus,
  TestTube,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Globe,
  Edit,
  Trash2,
  Shield
} from 'lucide-react';
import { ArcherCredentials, getAllCredentials, saveCredentials, deleteCredentials, credentialsManager } from '@/lib/backendCredentialsApi';

interface Connection {
  id: string;
  name: string;
  type: string;
  host: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  instanceName?: string; // For Archer GRC connections
  description?: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  lastTested?: Date;
  lastSync?: Date;
  isEnabled: boolean;
}

const CONNECTION_TYPES = [
  { value: 'archer-grc', label: 'RSA Archer GRC', icon: <Shield className="h-4 w-4" />, defaultPort: 443 },
  { value: 'sql-server', label: 'SQL Server', icon: <Database className="h-4 w-4" />, defaultPort: 1433 },
  { value: 'oracle', label: 'Oracle Database', icon: <Database className="h-4 w-4" />, defaultPort: 1521 },
  { value: 'mysql', label: 'MySQL', icon: <Database className="h-4 w-4" />, defaultPort: 3306 },
  { value: 'postgresql', label: 'PostgreSQL', icon: <Database className="h-4 w-4" />, defaultPort: 5432 },
  { value: 'rest-api', label: 'REST API', icon: <Globe className="h-4 w-4" />, defaultPort: 443 },
  { value: 'soap', label: 'SOAP Web Service', icon: <Globe className="h-4 w-4" />, defaultPort: 80 }
];

export const ConnectionsPage: React.FC = () => {
  const { tenant } = useAuthStore();
  
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'archer-grc',
    host: '',
    port: 443,
    username: '',
    password: '',
    database: '',
    instanceName: '', // For Archer GRC connections
    description: ''
  });

  useEffect(() => {
    loadConnections();
  }, [tenant?.id]);

  const loadConnections = async () => {
    if (!tenant?.id) {
      console.log('No tenant ID available, skipping connection load');
      setConnections([]);
      return;
    }

    setIsLoading(true);
    try {
      console.log('Loading connections for tenant:', tenant.id, 'using credentials API');
      
      // Set tenant context for secure partitioning
      credentialsManager.setTenantContext(tenant.id);
      
      // Load connections from secure credentials API
      const credentialsList = await getAllCredentials();
      console.log('Loaded', credentialsList.length, 'credentials:', credentialsList);
      
      // Convert ArcherCredentials to Connection format for UI compatibility
      const convertedConnections: Connection[] = credentialsList.map((cred: ArcherCredentials) => {
        // Parse host and port from baseUrl
        let host = cred.baseUrl;
        let port = 443; // default
        
        try {
          const url = new URL(cred.baseUrl);
          host = url.hostname;
          port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
        } catch (e) {
          // If URL parsing fails, try to extract from baseUrl format
          const match = cred.baseUrl.match(/^https?:\/\/([^:]+):?(\d+)?/);
          if (match) {
            host = match[1];
            port = match[2] ? parseInt(match[2]) : 443;
          }
        }

        return {
          id: cred.id,
          name: cred.name,
          type: 'archer-grc', // All credentials from API are Archer connections
          host: host,
          port: port,
          username: cred.username,
          password: '', // Don't expose password in UI
          database: '',
          instanceName: cred.instanceName || cred.instanceId,
          description: `Archer instance: ${cred.instanceName || cred.instanceId}`,
          status: cred.status,
          lastTested: cred.lastTested ? new Date(cred.lastTested) : undefined,
          lastSync: undefined,
          isEnabled: true
        };
      });
      
      console.log('Converted', convertedConnections.length, 'connections for UI:', convertedConnections);
      setConnections(convertedConnections);
      
    } catch (error) {
      console.error('Error loading connections from credentials API:', error);
      setConnections([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debug function to clear all connection-related data
  const clearAllConnectionData = () => {
    console.log('=== CLEARING ALL CONNECTION DATA ===');
    console.log('All localStorage keys:', Object.keys(localStorage));
    
    // Clear all connection-related keys (legacy localStorage)
    Object.keys(localStorage).forEach(key => {
      if (key.includes('connection') || key.includes('credential') || key.includes('mcp')) {
        console.log('Removing localStorage key:', key);
        localStorage.removeItem(key);
      }
    });
    
    // Also clear credentials API data if tenant is available
    if (tenant?.id) {
      try {
        credentialsManager.setTenantContext(tenant.id);
        credentialsManager.clearAllCredentials();
        console.log('Cleared credentials API data for tenant:', tenant.id);
      } catch (error) {
        console.error('Error clearing credentials API data:', error);
      }
    }
    
    // Reload connections
    loadConnections();
  };

  // Temporary: Add to window for debugging
  (window as any).clearAllConnectionData = clearAllConnectionData;

  const saveConnections = async (updatedConnections: Connection[]) => {
    if (!tenant?.id) {
      console.error('No tenant ID available, cannot save connections');
      return;
    }

    try {
      console.log('Saving connections:', updatedConnections.length, 'connections for tenant:', tenant.id);
      
      // Set tenant context for secure partitioning
      credentialsManager.setTenantContext(tenant.id);
      
      // Convert Connection objects to ArcherCredentials format and save each one
      for (const connection of updatedConnections) {
        if (connection.type === 'archer-grc') {
          // For existing connections, preserve the password if not provided
          let passwordToSave = connection.password || '';
          
          if (editingConnection && editingConnection.id === connection.id && !passwordToSave) {
            // If this is an edit and password is empty, get the existing password
            try {
              const existingCredentials = await getAllCredentials();
              const existingCred = existingCredentials.find(cred => cred.id === connection.id);
              if (existingCred) {
                passwordToSave = existingCred.password;
                console.log('Preserving existing password for connection:', connection.name);
              }
            } catch (error) {
              console.warn('Could not preserve existing password:', error);
            }
          }

          const credentials: ArcherCredentials = {
            id: connection.id,
            name: connection.name,
            baseUrl: `https://${connection.host}:${connection.port}`,
            username: connection.username || '',
            password: passwordToSave,
            instanceId: connection.instanceName || '',
            instanceName: connection.instanceName || '',
            userDomainId: '', // Default user domain (empty string for no domain)
            isDefault: false, // Will be set appropriately
            created: new Date().toISOString(),
            lastTested: connection.lastTested?.toISOString(),
            status: connection.status,
            lastError: undefined
          };
          
          console.log('Saving credentials for connection:', connection.name, 'instanceName:', credentials.instanceName);
          await saveCredentials(credentials);
        }
      }
      
      setConnections(updatedConnections);
      console.log('Successfully saved connections to credentials API');
    } catch (error) {
      console.error('Error saving connections:', error);
      alert('Failed to save connections: ' + (error as Error).message);
    }
  };

  const handleAddConnection = () => {
    const selectedType = CONNECTION_TYPES.find(t => t.value === formData.type);
    setFormData({
      ...formData,
      port: selectedType?.defaultPort || 443
    });
    setEditingConnection(null);
    setIsAddModalOpen(true);
  };

  const handleEditConnection = (connection: Connection) => {
    setFormData({
      name: connection.name,
      type: connection.type,
      host: connection.host,
      port: connection.port || 443,
      username: connection.username || '',
      password: '', // Don't populate password for security
      database: connection.database || '',
      instanceName: connection.instanceName || '', // Load instanceName for editing
      description: connection.description || ''
    });
    setEditingConnection(connection);
    setIsAddModalOpen(true);
  };

  const handleSaveConnection = async () => {
    setIsLoading(true);
    try {
      const newConnection: Connection = {
        id: editingConnection?.id || Date.now().toString(),
        ...formData,
        status: 'disconnected',
        lastTested: new Date(),
        isEnabled: true
      };

      let updatedConnections;
      if (editingConnection) {
        updatedConnections = connections.map(conn => 
          conn.id === editingConnection.id ? { ...conn, ...newConnection } : conn
        );
      } else {
        updatedConnections = [...connections, newConnection];
      }

      // Save to credentials API (this will handle encryption and secure storage)
      await saveConnections(updatedConnections);
      
      // Close modal and reset form
      setIsAddModalOpen(false);
      setEditingConnection(null);
      setFormData({
        name: '',
        type: 'archer-grc',
        host: '',
        port: 443,
        username: '',
        password: '',
        database: '',
        instanceName: '',
        description: ''
      });
      
      // Reload connections to show updated data
      await loadConnections();
      
    } catch (error) {
      console.error('Error saving connection:', error);
      alert('Failed to save connection: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    if (!tenant?.id) {
      alert('Cannot test connection: No tenant context available');
      return;
    }

    setTestingConnection(connectionId);
    try {
      // Set tenant context for secure partitioning
      credentialsManager.setTenantContext(tenant.id);
      
      // Load the specific credential to test
      const allCredentials = await getAllCredentials();
      const credentialToTest = allCredentials.find(cred => cred.id === connectionId);
      
      if (!credentialToTest) {
        throw new Error('Connection not found in credentials store');
      }

      console.log(`Testing connection: ${credentialToTest.name}`);
      
      // Use the credentials API's built-in test functionality
      const testResult = await credentialsManager.testConnection(credentialToTest);
      
      // Update the credential's status based on test result
      const updatedCredential = {
        ...credentialToTest,
        status: testResult.success ? 'connected' as const : 'error' as const,
        lastTested: new Date().toISOString(),
        lastError: testResult.success ? undefined : testResult.error
      };
      
      // Save the updated status
      await saveCredentials(updatedCredential);
      
      // Reload connections to show updated status
      await loadConnections();
      
      // Show user feedback
      if (testResult.success) {
        alert(`✅ Connection "${credentialToTest.name}" test successful!\n${testResult.message}`);
      } else {
        // Format error message properly
        let errorMessage = testResult.message || 'Unknown error';
        if (testResult.error && typeof testResult.error === 'object') {
          // Extract meaningful error details from Archer API error object
          const error = testResult.error as any;
          if (error.Description) {
            errorMessage = error.Description.replace('ValidationMessageTemplates:', '');
          } else if (error.MessageKey) {
            errorMessage = error.MessageKey.replace('ValidationMessageTemplates:', '');
          } else if (error.Reason) {
            errorMessage = `${error.Reason}: Invalid credentials or configuration`;
          } else {
            errorMessage = JSON.stringify(testResult.error, null, 2);
          }
        } else if (testResult.error) {
          errorMessage = String(testResult.error);
        }
        alert(`❌ Connection "${credentialToTest.name}" test failed!\n${errorMessage}`);
      }
      
    } catch (error) {
      console.error('Connection test error:', error);
      alert(`Connection test failed: ${(error as Error).message}`);
      
      // Mark connection as error state
      try {
        const allCredentials = await getAllCredentials();
        const credentialToUpdate = allCredentials.find(cred => cred.id === connectionId);
        if (credentialToUpdate) {
          const updatedCredential = {
            ...credentialToUpdate,
            status: 'error' as const,
            lastTested: new Date().toISOString(),
            lastError: (error as Error).message
          };
          await saveCredentials(updatedCredential);
          await loadConnections();
        }
      } catch (saveError) {
        console.error('Error updating connection status after test failure:', saveError);
      }
    } finally {
      setTestingConnection(null);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    
    if (!tenant?.id) {
      alert('Cannot delete connection: No tenant context available');
      return;
    }
    
    try {
      console.log('🗑️ Deleting connection:', connectionId);
      
      // Set tenant context for secure partitioning
      credentialsManager.setTenantContext(tenant.id);
      
      // Delete the connection using the database API
      await deleteCredentials(connectionId);
      
      // Reload connections to reflect the deletion
      await loadConnections();
      
      console.log('✅ Successfully deleted connection from database');
    } catch (error) {
      console.error('❌ Error deleting connection:', error);
      alert('Failed to delete connection: ' + (error as Error).message);
    }
  };

  const getStatusIcon = (status: Connection['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'testing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    const connectionType = CONNECTION_TYPES.find(t => t.value === type);
    return connectionType?.icon || <Database className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground mt-2">
            Manage external system connections and integrations
          </p>
        </div>
        <Button onClick={handleAddConnection}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && connections.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin mr-3" />
          <span className="text-muted-foreground">Loading connections...</span>
        </div>
      )}

      {/* Connections List */}
      <div className="grid gap-4">
        {connections.map((connection) => (
          <Card key={connection.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(connection.type)}
                    <div>
                      <h3 className="font-semibold">{connection.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {CONNECTION_TYPES.find(t => t.value === connection.type)?.label}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(testingConnection === connection.id ? 'testing' : connection.status)}
                    <span className="text-sm font-medium capitalize">
                      {testingConnection === connection.id ? 'Testing' : connection.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="text-right text-sm text-muted-foreground">
                    <div>{connection.host}:{connection.port}</div>
                    {connection.lastTested && (
                      <div>Last tested: {connection.lastTested.toLocaleTimeString()}</div>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(connection.id)}
                    disabled={testingConnection === connection.id}
                  >
                    <TestTube className="h-4 w-4 mr-1" />
                    Test
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditConnection(connection)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteConnection(connection.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {connection.description && (
                <p className="text-sm text-muted-foreground mt-2">{connection.description}</p>
              )}
            </CardContent>
          </Card>
        ))}

        {connections.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-muted-foreground mb-2">No connections configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first connection to start integrating with external systems.
            </p>
            <Button onClick={handleAddConnection}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Connection Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingConnection ? 'Edit Connection' : 'Add New Connection'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Production Archer"
              />
            </div>

            <div>
              <Label htmlFor="type">Connection Type</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => {
                  const selectedType = CONNECTION_TYPES.find(t => t.value === e.target.value);
                  setFormData({ 
                    ...formData, 
                    type: e.target.value,
                    port: selectedType?.defaultPort || 443
                  });
                }}
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {CONNECTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="server.company.com"
                />
              </div>
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 443 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="username"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="password"
                />
              </div>
            </div>

            {(formData.type === 'sql-server' || formData.type === 'oracle' || formData.type === 'mysql' || formData.type === 'postgresql') && (
              <div>
                <Label htmlFor="database">Database</Label>
                <Input
                  id="database"
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  placeholder="database name"
                />
              </div>
            )}

            {formData.type === 'archer-grc' && (
              <div>
                <Label htmlFor="instanceName">Instance Name</Label>
                <Input
                  id="instanceName"
                  value={formData.instanceName}
                  onChange={(e) => setFormData({ ...formData, instanceName: e.target.value })}
                  placeholder="e.g., v6.0, 710100, or instance identifier"
                />
                <p className="text-sm text-gray-500 mt-1">
                  The Archer instance name or identifier (check with your administrator)
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this connection"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveConnection} 
              disabled={isLoading || !formData.name || !formData.host || (formData.type === 'archer-grc' && !formData.instanceName)}
            >
              {isLoading ? 'Saving...' : editingConnection ? 'Update' : 'Add'} Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};