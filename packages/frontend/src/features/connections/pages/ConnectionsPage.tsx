import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/app/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/Dialog';
import { 
  Plus,
  Settings,
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
    try {
      // Load connections from localStorage with tenant isolation
      const storageKey = `connections_tenant_${tenant?.id || 'default'}`;
      console.log('Loading connections for tenant:', tenant?.id, 'with key:', storageKey);
      const stored = localStorage.getItem(storageKey);
      console.log('Raw stored data:', stored);
      
      if (stored) {
        const savedConnections: Connection[] = JSON.parse(stored).map((conn: any) => ({
          ...conn,
          lastTested: conn.lastTested ? new Date(conn.lastTested) : undefined,
          lastSync: conn.lastSync ? new Date(conn.lastSync) : undefined
        }));
        console.log('Loaded', savedConnections.length, 'saved connections:', savedConnections);
        setConnections(savedConnections);
      } else {
        console.log('No stored connections found, starting with empty list');
        // Start with empty connections list
        setConnections([]);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      setConnections([]);
    }
  };

  // Debug function to clear all connection-related localStorage
  const clearAllConnectionData = () => {
    console.log('=== CLEARING ALL CONNECTION DATA ===');
    console.log('All localStorage keys:', Object.keys(localStorage));
    
    // Clear all connection-related keys
    Object.keys(localStorage).forEach(key => {
      if (key.includes('connection') || key.includes('credential') || key.includes('mcp')) {
        console.log('Removing localStorage key:', key);
        localStorage.removeItem(key);
      }
    });
    
    // Reload connections
    loadConnections();
  };

  // Temporary: Add to window for debugging
  (window as any).clearAllConnectionData = clearAllConnectionData;

  const saveConnections = async (updatedConnections: Connection[]) => {
    try {
      // Save connections to localStorage with tenant isolation
      const storageKey = `connections_tenant_${tenant?.id || 'default'}`;
      console.log('Saving connections:', updatedConnections.length, 'connections for tenant:', tenant?.id);
      localStorage.setItem(storageKey, JSON.stringify(updatedConnections));
      setConnections(updatedConnections);
      console.log('Successfully saved connections');
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

      // Save to persistent storage
      await saveConnections(updatedConnections);

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
        instanceName: '', // Reset instanceName field
        description: ''
      });
    } catch (error) {
      console.error('Error saving connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    setTestingConnection(connectionId);
    try {
      // Mock test - in real app, this would test actual connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setConnections(prev => prev.map(conn => 
        conn.id === connectionId 
          ? { 
              ...conn, 
              status: Math.random() > 0.3 ? 'connected' : 'error',
              lastTested: new Date()
            }
          : conn
      ));
    } catch (error) {
      setConnections(prev => prev.map(conn => 
        conn.id === connectionId 
          ? { ...conn, status: 'error' as const, lastTested: new Date() }
          : conn
      ));
    } finally {
      setTestingConnection(null);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    
    try {
      console.log('Deleting connection:', connectionId);
      const updatedConnections = connections.filter(conn => conn.id !== connectionId);
      console.log('Connections before delete:', connections.length, 'after delete:', updatedConnections.length);
      await saveConnections(updatedConnections);
    } catch (error) {
      console.error('Error deleting connection:', error);
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

        {connections.length === 0 && (
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