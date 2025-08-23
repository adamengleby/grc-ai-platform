import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Settings,
  Link,
  Shield,
  Key,
  Database,
  TestTube,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Trash2,
  Plus,
  Lock,
  Globe,
  Building2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { clsx } from 'clsx';
import { credentialsManager, type ArcherCredentials, type ConnectionTestResult } from '@/lib/credentialsApi';

// Use ArcherCredentials from credentialsApi

interface SystemSettings {
  encryptionEnabled: boolean;
  sessionTimeout: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxConcurrentConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
}

export const ToolsPage: React.FC = () => {
  const [archerConnections, setArcherConnections] = useState<ArcherCredentials[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    encryptionEnabled: true,
    sessionTimeout: 30,
    logLevel: 'info',
    maxConcurrentConnections: 5,
    connectionTimeout: 10000,
    retryAttempts: 3
  });
  
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [editingConnection, setEditingConnection] = useState<string | null>(null);
  const [newConnection, setNewConnection] = useState<Partial<ArcherCredentials>>({});
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [testingConnections, setTestingConnections] = useState<Set<string>>(new Set());
  const [initializingEncryption, setInitializingEncryption] = useState(true);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);

  // Load saved connections and settings
  useEffect(() => {
    initializeSecureStorage();
  }, []);

  const initializeSecureStorage = async () => {
    try {
      setInitializingEncryption(true);
      setEncryptionError(null);

      // Initialize the credentials manager
      await credentialsManager.initialize();

      // Load connections and settings
      await loadStoredConnections();
      loadSystemSettings();
    } catch (error) {
      console.error('Failed to initialize secure storage:', error);
      setEncryptionError(error instanceof Error ? error.message : 'Encryption initialization failed');
    } finally {
      setInitializingEncryption(false);
    }
  };

  const loadStoredConnections = async () => {
    try {
      const connections = await credentialsManager.loadCredentials();
      if (connections.length === 0) {
        // Initialize with example connection
        const defaultConnection: ArcherCredentials = {
          id: 'default',
          name: 'Production Archer',
          baseUrl: 'https://archer.company.com',
          username: '',
          password: '',
          instanceId: '',
          userDomainId: '',
          isDefault: true,
          status: 'disconnected',
          created: new Date().toISOString()
        };
        setArcherConnections([defaultConnection]);
      } else {
        setArcherConnections(connections);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      setEncryptionError('Failed to load credentials - encryption may be corrupted');
    }
  };

  const loadSystemSettings = () => {
    try {
      const stored = localStorage.getItem('system_settings');
      if (stored) {
        setSystemSettings({ ...systemSettings, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load system settings:', error);
    }
  };

  const saveConnections = async (connections: ArcherCredentials[]) => {
    try {
      await credentialsManager.storeCredentials(connections);
      setArcherConnections(connections);
    } catch (error) {
      console.error('Failed to save connections:', error);
      setEncryptionError('Failed to save credentials - storage error');
    }
  };

  const saveSystemSettings = (settings: SystemSettings) => {
    try {
      localStorage.setItem('system_settings', JSON.stringify(settings));
      setSystemSettings(settings);
    } catch (error) {
      console.error('Failed to save system settings:', error);
    }
  };

  const testConnection = async (connectionId: string) => {
    const connection = archerConnections.find(c => c.id === connectionId);
    if (!connection) return;

    setTestingConnections(prev => new Set(prev).add(connectionId));
    
    try {
      // Update connection status to testing
      const updatedConnections = archerConnections.map(c => 
        c.id === connectionId ? { ...c, status: 'testing' as const } : c
      );
      setArcherConnections(updatedConnections);

      // Use the secure credentials manager to test connection
      const testResult: ConnectionTestResult = await credentialsManager.testConnection(connection);
      
      const finalConnections = archerConnections.map(c => 
        c.id === connectionId ? {
          ...c,
          status: testResult.success ? 'connected' as const : 'error' as const,
          lastTested: new Date().toISOString(),
          lastError: testResult.success ? undefined : testResult.error || testResult.message
        } : c
      );
      
      await saveConnections(finalConnections);
      
    } catch (error) {
      const errorConnections = archerConnections.map(c => 
        c.id === connectionId ? {
          ...c,
          status: 'error' as const,
          lastTested: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : 'Connection test failed'
        } : c
      );
      await saveConnections(errorConnections);
    } finally {
      setTestingConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
  };

  const updateConnection = async (connectionId: string, updates: Partial<ArcherCredentials>) => {
    const updatedConnections = archerConnections.map(c => 
      c.id === connectionId ? { ...c, ...updates } : c
    );
    await saveConnections(updatedConnections);
    setEditingConnection(null);
  };

  const addNewConnection = async () => {
    if (!newConnection.name || !newConnection.baseUrl) return;

    const connection: ArcherCredentials = {
      id: `conn_${Date.now()}`,
      name: newConnection.name,
      baseUrl: newConnection.baseUrl,
      username: newConnection.username || '',
      password: newConnection.password || '',
      instanceId: newConnection.instanceId || '',
      userDomainId: newConnection.userDomainId || '',
      isDefault: archerConnections.length === 0,
      status: 'disconnected',
      created: new Date().toISOString()
    };

    await saveConnections([...archerConnections, connection]);
    setNewConnection({});
    setIsAddingConnection(false);
  };

  const deleteConnection = async (connectionId: string) => {
    const updatedConnections = archerConnections.filter(c => c.id !== connectionId);
    await saveConnections(updatedConnections);
  };

  const setDefaultConnection = async (connectionId: string) => {
    const updatedConnections = archerConnections.map(c => ({
      ...c,
      isDefault: c.id === connectionId
    }));
    await saveConnections(updatedConnections);
  };

  const togglePasswordVisibility = (connectionId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [connectionId]: !prev[connectionId]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'testing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'testing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Show initialization loading state
  if (initializingEncryption) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <h3 className="font-semibold">Initializing Secure Storage</h3>
              <p className="text-muted-foreground">
                Setting up encryption for credential management...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encryption Error */}
      {encryptionError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-900 mb-1">Encryption Error</h4>
                <p className="text-red-700 text-sm">{encryptionError}</p>
                <Button
                  onClick={initializeSecureStorage}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Initialization
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-3">
            <Link className="h-8 w-8 text-primary" />
            <span>Connections</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage Archer connections, credentials, and system configurations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setIsAddingConnection(true)}
            variant="outline"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Connection
          </Button>
        </div>
      </div>

      {/* Archer Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Archer GRC Connections</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Connection Form */}
          {isAddingConnection && (
            <Card className="border-dashed border-primary/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add New Archer Connection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1">Connection Name</label>
                    <input
                      type="text"
                      value={newConnection.name || ''}
                      onChange={(e) => setNewConnection(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-2 border rounded-md text-sm"
                      placeholder="Production Archer"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Base URL</label>
                    <input
                      type="url"
                      value={newConnection.baseUrl || ''}
                      onChange={(e) => setNewConnection(prev => ({ ...prev, baseUrl: e.target.value }))}
                      className="w-full p-2 border rounded-md text-sm"
                      placeholder="https://archer.company.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Username</label>
                    <input
                      type="text"
                      value={newConnection.username || ''}
                      onChange={(e) => setNewConnection(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full p-2 border rounded-md text-sm"
                      placeholder="service_account"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Password</label>
                    <input
                      type="password"
                      value={newConnection.password || ''}
                      onChange={(e) => setNewConnection(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full p-2 border rounded-md text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Instance ID</label>
                    <input
                      type="text"
                      value={newConnection.instanceId || ''}
                      onChange={(e) => setNewConnection(prev => ({ ...prev, instanceId: e.target.value }))}
                      className="w-full p-2 border rounded-md text-sm"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">User Domain ID</label>
                    <input
                      type="text"
                      value={newConnection.userDomainId || ''}
                      onChange={(e) => setNewConnection(prev => ({ ...prev, userDomainId: e.target.value }))}
                      className="w-full p-2 border rounded-md text-sm"
                      placeholder="1"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    onClick={() => {
                      setIsAddingConnection(false);
                      setNewConnection({});
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={addNewConnection}
                    disabled={!newConnection.name || !newConnection.baseUrl}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Add Connection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Connections */}
          <div className="space-y-4">
            {archerConnections.map((connection) => (
              <Card key={connection.id} className={clsx(
                "transition-all",
                connection.isDefault && "border-primary/50 bg-primary/5"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold flex items-center space-x-2">
                            <span>{connection.name}</span>
                            {connection.isDefault && (
                              <span className="text-xs bg-primary text-white px-2 py-1 rounded">
                                Default
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground">{connection.baseUrl}</p>
                        </div>
                      </div>

                      {editingConnection === connection.id ? (
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div>
                            <label className="text-xs font-medium block mb-1">Username</label>
                            <input
                              type="text"
                              value={connection.username}
                              onChange={(e) => updateConnection(connection.id, { username: e.target.value })}
                              className="w-full p-2 border rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">Password</label>
                            <div className="relative">
                              <input
                                type={showPasswords[connection.id] ? "text" : "password"}
                                value={connection.password}
                                onChange={(e) => updateConnection(connection.id, { password: e.target.value })}
                                className="w-full p-2 border rounded text-sm pr-8"
                              />
                              <button
                                onClick={() => togglePasswordVisibility(connection.id)}
                                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                              >
                                {showPasswords[connection.id] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">Instance ID</label>
                            <input
                              type="text"
                              value={connection.instanceId}
                              onChange={(e) => updateConnection(connection.id, { instanceId: e.target.value })}
                              className="w-full p-2 border rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">User Domain ID</label>
                            <input
                              type="text"
                              value={connection.userDomainId}
                              onChange={(e) => updateConnection(connection.id, { userDomainId: e.target.value })}
                              className="w-full p-2 border rounded text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Username:</span>
                            <span className="ml-2">{connection.username || 'Not set'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Password:</span>
                            <span className="ml-2">
                              {connection.password ? '••••••••' : 'Not set'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Instance ID:</span>
                            <span className="ml-2">{connection.instanceId || 'Not set'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">User Domain:</span>
                            <span className="ml-2">{connection.userDomainId || 'Not set'}</span>
                          </div>
                        </div>
                      )}

                      {/* Connection Status */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <div className="flex items-center space-x-3">
                          <div className={clsx(
                            "px-2 py-1 rounded-full text-xs font-medium border flex items-center space-x-1",
                            getStatusColor(connection.status)
                          )}>
                            {getStatusIcon(connection.status)}
                            <span className="capitalize">{connection.status}</span>
                          </div>
                          {connection.lastTested && (
                            <div className="text-xs text-muted-foreground flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>Tested {new Date(connection.lastTested).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Error Message */}
                      {connection.lastError && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{connection.lastError}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col space-y-2">
                      <Button
                        onClick={() => testConnection(connection.id)}
                        disabled={testingConnections.has(connection.id)}
                        variant="outline"
                        size="sm"
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        Test
                      </Button>
                      <Button
                        onClick={() => setEditingConnection(
                          editingConnection === connection.id ? null : connection.id
                        )}
                        variant="outline"
                        size="sm"
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      {!connection.isDefault && (
                        <Button
                          onClick={() => setDefaultConnection(connection.id)}
                          variant="outline"
                          size="sm"
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Set Default
                        </Button>
                      )}
                      {archerConnections.length > 1 && (
                        <Button
                          onClick={() => deleteConnection(connection.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>System Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Security Settings */}
          <div>
            <h3 className="font-medium text-sm mb-3 flex items-center space-x-2">
              <Lock className="h-4 w-4" />
              <span>Security</span>
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Credential Encryption</span>
                  <p className="text-xs text-muted-foreground">AES-256-GCM encryption for stored credentials</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-green-600 font-medium">ACTIVE</div>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground bg-green-50 border border-green-200 rounded p-2">
                All credentials are automatically encrypted using Web Crypto API with AES-256-GCM.
                Encryption keys are derived from your session and device fingerprint.
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Session Timeout</span>
                  <p className="text-xs text-muted-foreground">Auto-logout after inactivity (minutes)</p>
                </div>
                <select
                  value={systemSettings.sessionTimeout}
                  onChange={(e) => saveSystemSettings({
                    ...systemSettings,
                    sessionTimeout: parseInt(e.target.value)
                  })}
                  className="text-sm border rounded p-1"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                </select>
              </div>
            </div>
          </div>

          {/* Connection Settings */}
          <div>
            <h3 className="font-medium text-sm mb-3 flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>Connection Settings</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Max Concurrent Connections</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={systemSettings.maxConcurrentConnections}
                  onChange={(e) => saveSystemSettings({
                    ...systemSettings,
                    maxConcurrentConnections: parseInt(e.target.value)
                  })}
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Connection Timeout (ms)</label>
                <input
                  type="number"
                  min="5000"
                  max="60000"
                  step="1000"
                  value={systemSettings.connectionTimeout}
                  onChange={(e) => saveSystemSettings({
                    ...systemSettings,
                    connectionTimeout: parseInt(e.target.value)
                  })}
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Retry Attempts</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={systemSettings.retryAttempts}
                  onChange={(e) => saveSystemSettings({
                    ...systemSettings,
                    retryAttempts: parseInt(e.target.value)
                  })}
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Log Level</label>
                <select
                  value={systemSettings.logLevel}
                  onChange={(e) => saveSystemSettings({
                    ...systemSettings,
                    logLevel: e.target.value as 'error' | 'warn' | 'info' | 'debug'
                  })}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option value="error">Error</option>
                  <option value="warn">Warning</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <h4 className="font-medium text-blue-900 mb-1">Security Implementation</h4>
                <div className="text-blue-700 space-y-2">
                  <p>
                    <strong>✓ End-to-End Encryption:</strong> All credentials are encrypted using AES-256-GCM before storage.
                  </p>
                  <p>
                    <strong>✓ Secure Key Derivation:</strong> Encryption keys are derived from your session and device fingerprint.
                  </p>
                  <p>
                    <strong>✓ Web Crypto API:</strong> Browser-native cryptographic functions ensure maximum security.
                  </p>
                  <p className="text-xs mt-2 text-blue-600">
                    For enterprise deployments, consider implementing HSM-backed credential vaults and centralized key management.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};