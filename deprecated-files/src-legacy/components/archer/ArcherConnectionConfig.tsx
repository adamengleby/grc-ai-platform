import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Server,
  Settings,
  Eye,
  EyeOff,
  TestTube,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  Globe,
  Shield,
  User,
  Database,
  HelpCircle,
  Copy,
  Check,
  Wifi,
  WifiOff
} from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { 
  credentialsManager,
  type ArcherCredentials,
  type ConnectionTestResult 
} from '@/lib/credentialsApi';
import { useAuthStore } from '@/store/auth';

export interface ArcherConnectionConfigProps {
  onConnectionChange?: (connection: ArcherCredentials | null) => void;
  className?: string;
}

interface FormData {
  name: string;
  baseUrl: string;
  instanceName: string;
  username: string;
  password: string;
  userDomain: string;
}

interface FormErrors {
  name?: string;
  baseUrl?: string;
  instanceName?: string;
  username?: string;
  password?: string;
  userDomain?: string;
}

const DEFAULT_FORM_DATA: FormData = {
  name: '',
  baseUrl: '',
  instanceName: 'v5.0',
  username: '',
  password: '',
  userDomain: ''
};

const COMMON_INSTANCE_NAMES = ['v5.0', 'v6.0', 'Archer', 'Default'];

const HELP_CONTENT = {
  name: 'A friendly name to identify this connection (e.g., "Production Archer", "Test Environment")',
  baseUrl: 'The base URL of your Archer platform (e.g., "https://archer.yourcompany.com" or "http://10.1.2.3")',
  instanceName: 'The Archer instance name, typically "v5.0" or "v6.0". Check with your administrator if unsure.',
  username: 'Your Archer username for authentication',
  password: 'Your Archer password. This will be encrypted and stored securely.',
  userDomain: 'Optional user domain if your Archer instance uses domain authentication. Leave blank if not needed.'
};

export const ArcherConnectionConfig: React.FC<ArcherConnectionConfigProps> = ({
  onConnectionChange,
  className
}) => {
  const { tenant } = useAuthStore();
  const [connections, setConnections] = useState<ArcherCredentials[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<ArcherCredentials | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionTestResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Load existing connections
  useEffect(() => {
    const loadConnections = async () => {
      if (!tenant) {
        setIsLoading(false);
        return;
      }

      try {
        // CRITICAL: Set tenant context for secure partitioning
        credentialsManager.setTenantContext(tenant.id);
        
        await credentialsManager.initialize();
        const savedConnections = await credentialsManager.loadCredentials();
        setConnections(savedConnections);
        
        // Auto-select default connection or first connection
        const defaultConnection = savedConnections.find(c => c.isDefault) || savedConnections[0];
        if (defaultConnection) {
          setSelectedConnection(defaultConnection);
          onConnectionChange?.(defaultConnection);
        }
      } catch (error) {
        console.error('Failed to load connections:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConnections();
  }, [tenant?.id, onConnectionChange]); // Add tenant.id to dependencies

  // Validate form data
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Connection name is required';
    }

    if (!formData.baseUrl.trim()) {
      errors.baseUrl = 'Server URL is required';
    } else {
      try {
        new URL(formData.baseUrl);
        if (!formData.baseUrl.match(/^https?:\/\//)) {
          errors.baseUrl = 'URL must start with http:// or https://';
        }
      } catch {
        errors.baseUrl = 'Please enter a valid URL';
      }
    }

    if (!formData.instanceName.trim()) {
      errors.instanceName = 'Instance name is required';
    }

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }

    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle form input changes
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!tenant) {
      console.error('No tenant context available');
      return;
    }

    // CRITICAL: Set tenant context for secure partitioning
    credentialsManager.setTenantContext(tenant.id);

    let testData: FormData;
    
    // Use formData if editing, otherwise use selectedConnection data
    if (isEditing) {
      if (!validateForm()) return;
      testData = formData;
    } else if (selectedConnection) {
      // Convert selectedConnection to FormData format
      testData = {
        name: selectedConnection.name,
        baseUrl: selectedConnection.baseUrl,
        instanceName: selectedConnection.instanceId,
        username: selectedConnection.username,
        password: selectedConnection.password,
        userDomain: selectedConnection.userDomainId === '1' ? '' : selectedConnection.userDomainId
      };
    } else {
      console.error('No connection data available for testing');
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const testCredentials: ArcherCredentials = {
        id: 'test-connection',
        name: testData.name,
        baseUrl: testData.baseUrl,
        username: testData.username,
        password: testData.password,
        instanceId: testData.instanceName,
        userDomainId: testData.userDomain || '1',
        isDefault: false,
        created: new Date().toISOString(),
        status: 'testing'
      };

      const result = await credentialsManager.testConnection(testCredentials);
      setConnectionStatus(result);
      
      // If testing an existing connection, update its status
      if (!isEditing && selectedConnection) {
        const updatedConnections = connections.map(c => 
          c.id === selectedConnection.id 
            ? { ...c, status: (result.success ? 'connected' : 'error') as 'connected' | 'error', lastTested: new Date().toISOString(), lastError: result.error }
            : c
        );
        setConnections(updatedConnections);
        
        // Update selected connection
        const updatedSelected = updatedConnections.find(c => c.id === selectedConnection.id);
        if (updatedSelected) {
          setSelectedConnection(updatedSelected);
          onConnectionChange?.(updatedSelected);
        }
      }
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: 'Connection test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save connection
  const handleSaveConnection = async () => {
    if (!validateForm()) return;

    if (!tenant) {
      console.error('No tenant context available');
      return;
    }

    // CRITICAL: Set tenant context for secure partitioning
    credentialsManager.setTenantContext(tenant.id);

    setIsSaving(true);

    try {
      const newConnection: ArcherCredentials = {
        id: selectedConnection?.id || `archer-${Date.now()}`,
        name: formData.name,
        baseUrl: formData.baseUrl,
        username: formData.username,
        password: formData.password,
        instanceId: formData.instanceName,
        userDomainId: formData.userDomain || '1',
        isDefault: connections.length === 0, // First connection is default
        created: selectedConnection?.created || new Date().toISOString(),
        status: 'disconnected'
      };

      let updatedConnections;
      if (selectedConnection) {
        // Update existing connection
        updatedConnections = connections.map(c => 
          c.id === selectedConnection.id ? newConnection : c
        );
      } else {
        // Add new connection
        updatedConnections = [...connections, newConnection];
      }

      await credentialsManager.storeCredentials(updatedConnections);
      setConnections(updatedConnections);
      setSelectedConnection(newConnection);
      setIsEditing(false);
      onConnectionChange?.(newConnection);

      // Clear form
      setFormData(DEFAULT_FORM_DATA);
      setConnectionStatus(null);
    } catch (error) {
      console.error('Failed to save connection:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete connection
  const handleDeleteConnection = async (connectionId: string) => {
    if (!tenant) {
      console.error('No tenant context available');
      return;
    }

    // CRITICAL: Set tenant context for secure partitioning
    credentialsManager.setTenantContext(tenant.id);

    try {
      const updatedConnections = connections.filter(c => c.id !== connectionId);
      await credentialsManager.storeCredentials(updatedConnections);
      setConnections(updatedConnections);
      
      if (selectedConnection?.id === connectionId) {
        const newSelected = updatedConnections[0] || null;
        setSelectedConnection(newSelected);
        onConnectionChange?.(newSelected);
      }
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  };

  // Edit connection
  const handleEditConnection = (connection: ArcherCredentials) => {
    setSelectedConnection(connection);
    setFormData({
      name: connection.name,
      baseUrl: connection.baseUrl,
      instanceName: connection.instanceId,
      username: connection.username,
      password: connection.password,
      userDomain: connection.userDomainId === '1' ? '' : connection.userDomainId
    });
    setIsEditing(true);
    setConnectionStatus(null);
  };

  // Start new connection
  const handleNewConnection = () => {
    setSelectedConnection(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setIsEditing(true);
    setConnectionStatus(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setConnectionStatus(null);
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading connections...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Server className="h-6 w-6 text-primary" />
            <span>Archer GRC Connections</span>
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure secure connections to your Archer GRC platform instances
          </p>
        </div>
        <Button onClick={handleNewConnection} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>New Connection</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Saved Connections</CardTitle>
            <CardDescription>
              Select a connection to view details or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <div className="text-center py-8">
                <Database className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  No connections configured yet
                </p>
                <Button variant="outline" size="sm" onClick={handleNewConnection}>
                  Create First Connection
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {connections.map((connection) => (
                  <div
                    key={connection.id}
                    className={clsx(
                      'p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50',
                      selectedConnection?.id === connection.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border'
                    )}
                    onClick={() => setSelectedConnection(connection)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-sm truncate">{connection.name}</h4>
                          {connection.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {connection.baseUrl}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <div className={clsx(
                            'flex items-center space-x-1 text-xs',
                            connection.status === 'connected' ? 'text-green-600' :
                            connection.status === 'error' ? 'text-red-600' :
                            'text-muted-foreground'
                          )}>
                            {connection.status === 'connected' ? (
                              <Wifi className="h-3 w-3" />
                            ) : connection.status === 'error' ? (
                              <WifiOff className="h-3 w-3" />
                            ) : (
                              <Globe className="h-3 w-3" />
                            )}
                            <span className="capitalize">{connection.status}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditConnection(connection);
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConnection(connection.id);
                          }}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Details/Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {isEditing ? (
                <>
                  <Settings className="h-5 w-5" />
                  <span>{selectedConnection ? 'Edit Connection' : 'New Connection'}</span>
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  <span>Connection Details</span>
                </>
              )}
            </CardTitle>
            {selectedConnection && !isEditing && (
              <CardDescription>
                Connection details for {selectedConnection.name}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent>
            {!selectedConnection && !isEditing ? (
              <div className="text-center py-12">
                <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Connection</h3>
                <p className="text-muted-foreground mb-6">
                  Choose a connection from the list or create a new one to get started
                </p>
                <Button onClick={handleNewConnection}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Connection
                </Button>
              </div>
            ) : isEditing ? (
              /* Edit/Create Form */
              <div className="space-y-6">
                {/* Connection Status Alert */}
                {connectionStatus && (
                  <Alert
                    variant={connectionStatus.success ? 'success' : 'destructive'}
                    title={connectionStatus.success ? 'Connection Successful' : 'Connection Failed'}
                    dismissible
                    onDismiss={() => setConnectionStatus(null)}
                  >
                    <p>{connectionStatus.message}</p>
                    {connectionStatus.details && (
                      <div className="mt-2 text-xs">
                        <p>Response time: {connectionStatus.details.responseTime}ms</p>
                        {connectionStatus.details.version && (
                          <p>Archer version: {connectionStatus.details.version}</p>
                        )}
                      </div>
                    )}
                    {connectionStatus.error && (
                      <p className="mt-2 text-xs font-mono bg-destructive/10 p-2 rounded">
                        {connectionStatus.error}
                      </p>
                    )}
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <User className="h-4 w-4 text-primary" />
                      <h3 className="font-medium">Connection Information</h3>
                    </div>

                    {/* Connection Name */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="name" required>Connection Name</Label>
                        <div className="group relative">
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          <div className="absolute left-0 top-6 invisible group-hover:visible bg-popover text-popover-foreground text-xs p-2 rounded border shadow-sm w-64 z-10">
                            {HELP_CONTENT.name}
                          </div>
                        </div>
                      </div>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="e.g., Production Archer"
                        error={!!formErrors.name}
                      />
                      {formErrors.name && (
                        <p className="text-xs text-destructive">{formErrors.name}</p>
                      )}
                    </div>

                    {/* Server URL */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="baseUrl" required>Server URL</Label>
                        <div className="group relative">
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          <div className="absolute left-0 top-6 invisible group-hover:visible bg-popover text-popover-foreground text-xs p-2 rounded border shadow-sm w-64 z-10">
                            {HELP_CONTENT.baseUrl}
                          </div>
                        </div>
                      </div>
                      <Input
                        id="baseUrl"
                        value={formData.baseUrl}
                        onChange={(e) => handleInputChange('baseUrl', e.target.value)}
                        placeholder="https://archer.yourcompany.com"
                        error={!!formErrors.baseUrl}
                      />
                      {formErrors.baseUrl && (
                        <p className="text-xs text-destructive">{formErrors.baseUrl}</p>
                      )}
                    </div>

                    {/* Instance Name */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="instanceName" required>Instance Name</Label>
                        <div className="group relative">
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          <div className="absolute left-0 top-6 invisible group-hover:visible bg-popover text-popover-foreground text-xs p-2 rounded border shadow-sm w-64 z-10">
                            {HELP_CONTENT.instanceName}
                          </div>
                        </div>
                      </div>
                      <div className="relative">
                        <Input
                          id="instanceName"
                          value={formData.instanceName}
                          onChange={(e) => handleInputChange('instanceName', e.target.value)}
                          placeholder="v5.0"
                          error={!!formErrors.instanceName}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <div className="text-xs text-muted-foreground">
                            Common: {COMMON_INSTANCE_NAMES.slice(0, 2).join(', ')}
                          </div>
                        </div>
                      </div>
                      {formErrors.instanceName && (
                        <p className="text-xs text-destructive">{formErrors.instanceName}</p>
                      )}
                    </div>
                  </div>

                  {/* Authentication */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Shield className="h-4 w-4 text-primary" />
                      <h3 className="font-medium">Authentication</h3>
                    </div>

                    {/* Username */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="username" required>Username</Label>
                        <div className="group relative">
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          <div className="absolute left-0 top-6 invisible group-hover:visible bg-popover text-popover-foreground text-xs p-2 rounded border shadow-sm w-64 z-10">
                            {HELP_CONTENT.username}
                          </div>
                        </div>
                      </div>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        placeholder="your.username"
                        error={!!formErrors.username}
                      />
                      {formErrors.username && (
                        <p className="text-xs text-destructive">{formErrors.username}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="password" required>Password</Label>
                        <div className="group relative">
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          <div className="absolute left-0 top-6 invisible group-hover:visible bg-popover text-popover-foreground text-xs p-2 rounded border shadow-sm w-64 z-10">
                            {HELP_CONTENT.password}
                          </div>
                        </div>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          placeholder="Enter your password"
                          error={!!formErrors.password}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {formErrors.password && (
                        <p className="text-xs text-destructive">{formErrors.password}</p>
                      )}
                    </div>

                    {/* User Domain */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="userDomain">User Domain</Label>
                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                        <div className="group relative">
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          <div className="absolute left-0 top-6 invisible group-hover:visible bg-popover text-popover-foreground text-xs p-2 rounded border shadow-sm w-64 z-10">
                            {HELP_CONTENT.userDomain}
                          </div>
                        </div>
                      </div>
                      <Input
                        id="userDomain"
                        value={formData.userDomain}
                        onChange={(e) => handleInputChange('userDomain', e.target.value)}
                        placeholder="Leave blank if not needed"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-6 border-t">
                  <div className="flex items-center space-x-3">
                    <Button
                      onClick={handleTestConnection}
                      disabled={isTestingConnection || isSaving}
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      {isTestingConnection ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      <span>Test Connection</span>
                    </Button>
                    
                    {connectionStatus?.success && (
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Connection verified</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveConnection}
                      disabled={isTestingConnection || isSaving}
                      className="flex items-center space-x-2"
                    >
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>{selectedConnection ? 'Update' : 'Save'} Connection</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Connection Details View */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Server className="h-4 w-4 text-primary" />
                      <h3 className="font-medium">Connection Details</h3>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Name:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{selectedConnection?.name}</span>
                          {selectedConnection?.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Server URL:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-mono text-right max-w-64 truncate">
                            {selectedConnection?.baseUrl}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedConnection?.baseUrl || '', 'url')}
                            className="h-6 w-6 p-0"
                          >
                            {copiedField === 'url' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Instance:</span>
                        <span className="text-sm font-medium">{selectedConnection?.instanceId}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <div className={clsx(
                          'flex items-center space-x-2 text-sm',
                          selectedConnection?.status === 'connected' ? 'text-green-600' :
                          selectedConnection?.status === 'error' ? 'text-red-600' :
                          'text-muted-foreground'
                        )}>
                          {selectedConnection?.status === 'connected' ? (
                            <Wifi className="h-4 w-4" />
                          ) : selectedConnection?.status === 'error' ? (
                            <WifiOff className="h-4 w-4" />
                          ) : (
                            <Globe className="h-4 w-4" />
                          )}
                          <span className="capitalize">{selectedConnection?.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security Information */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Shield className="h-4 w-4 text-primary" />
                      <h3 className="font-medium">Security & Authentication</h3>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Username:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{selectedConnection?.username}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedConnection?.username || '', 'username')}
                            className="h-6 w-6 p-0"
                          >
                            {copiedField === 'username' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Password:</span>
                        <span className="text-sm text-muted-foreground">••••••••</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">User Domain:</span>
                        <span className="text-sm font-medium">
                          {selectedConnection?.userDomainId !== '1' 
                            ? selectedConnection?.userDomainId 
                            : 'Not configured'
                          }
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Created:</span>
                        <span className="text-sm text-muted-foreground">
                          {selectedConnection?.created ? 
                            new Date(selectedConnection.created).toLocaleDateString() : 
                            'Unknown'
                          }
                        </span>
                      </div>

                      {selectedConnection?.lastTested && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Last tested:</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(selectedConnection.lastTested).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Last Error */}
                {selectedConnection?.lastError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Connection Error</p>
                      <p className="text-sm mt-1">{selectedConnection.lastError}</p>
                    </div>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-6 border-t">
                  <div className="text-sm text-muted-foreground">
                    All credentials are encrypted and stored securely on your device
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => handleTestConnection()}
                      disabled={isTestingConnection}
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      {isTestingConnection ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      <span>Test Connection</span>
                    </Button>
                    <Button
                      onClick={() => handleEditConnection(selectedConnection!)}
                      className="flex items-center space-x-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span>Edit Connection</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};