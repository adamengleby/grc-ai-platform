import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Plus,
  Server,
  Info,
  Globe,
  Database,
  TestTube,
  Settings,
  FileText
} from 'lucide-react';
import { ArcherCredentials, getAllCredentials } from '@/lib/credentialsApi';
import { useAuthStore } from '@/store/auth';

interface AddMcpServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (serverConfig: NewMcpServerConfig) => Promise<void>;
  editMode?: boolean;
  initialConfig?: NewMcpServerConfig;
}

export interface NewMcpServerConfig {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  connectionId?: string;
  connectionName?: string;
  category: string;
  isEnabled: boolean;
  createdAt: string;
}

const serverCategories = [
  { value: 'grc', label: 'GRC & Compliance' },
  { value: 'integration', label: 'Integration Platform' },
  { value: 'automation', label: 'Automation Tool' },
  { value: 'analytics', label: 'Analytics & Reporting' },
  { value: 'custom', label: 'Custom Solution' }
];

export default function AddMcpServerModal({
  isOpen,
  onClose,
  onSave,
  editMode = false,
  initialConfig
}: AddMcpServerModalProps) {
  const { tenant } = useAuthStore();
  const [formData, setFormData] = useState({
    name: initialConfig?.name || '',
    description: initialConfig?.description || '',
    endpoint: initialConfig?.endpoint || '',
    category: initialConfig?.category || 'custom',
    connectionId: initialConfig?.connectionId || ''
  });
  const [availableConnections, setAvailableConnections] = useState<ArcherCredentials[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load available connections when modal opens
  React.useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen]);

  const loadConnections = async () => {
    if (!tenant) return;

    setIsLoading(true);
    try {
      const connections = await getAllCredentials();
      setAvailableConnections(connections);
    } catch (error) {
      console.error('Error loading connections:', error);
      setMessage({ type: 'error', text: 'Failed to load available connections' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTestResult(null); // Clear test result when form changes
  };

  const selectedConnection = availableConnections.find(conn => conn.id === formData.connectionId);

  const validateForm = () => {
    if (!formData.name.trim()) return 'Server name is required';
    if (!formData.endpoint.trim()) return 'Server endpoint URL is required';
    if (!formData.endpoint.startsWith('http://') && !formData.endpoint.startsWith('https://')) {
      return 'Endpoint must be a valid HTTP/HTTPS URL';
    }
    return null;
  };

  const testConnection = async () => {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setMessage({ type: 'info', text: `Testing connection to ${formData.name}...` });

    try {
      // Simulate testing the MCP server endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test the MCP server endpoints specifically
      const healthResponse = await fetch(`${formData.endpoint}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }).catch(() => null);

      const toolsResponse = await fetch(`${formData.endpoint}/tools`, {
        method: 'GET', 
        headers: { 'Accept': 'application/json' }
      }).catch(() => null);

      if (healthResponse && healthResponse.ok && toolsResponse && toolsResponse.ok) {
        const toolsData = await toolsResponse.json().catch(() => ({}));
        const toolCount = toolsData.tools?.length || 0;
        setTestResult({ success: true, message: `Connection successful - ${toolCount} tools available` });
        setMessage({ type: 'success', text: `MCP server is responding correctly with ${toolCount} available tools` });
      } else {
        setTestResult({ success: false, message: 'MCP server not responding' });
        setMessage({ type: 'error', text: `Could not connect to MCP server at ${formData.endpoint}. Verify the server is running and the endpoint is correct.` });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
      setMessage({ type: 'error', text: `Test failed: ${error.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const serverConfig: NewMcpServerConfig = {
        id: editMode ? initialConfig!.id : `mcp-${Date.now()}`,
        name: formData.name.trim(),
        description: formData.description.trim() || `Custom MCP server: ${formData.name}`,
        endpoint: formData.endpoint.trim(),
        connectionId: formData.connectionId || undefined,
        connectionName: selectedConnection?.name || undefined,
        category: formData.category,
        isEnabled: editMode ? initialConfig!.isEnabled : true,
        createdAt: editMode ? initialConfig!.createdAt : new Date().toISOString()
      };

      await onSave(serverConfig);
      
      // Reset form and close modal
      setFormData({
        name: '',
        description: '',
        endpoint: '',
        category: 'custom',
        connectionId: ''
      });
      setTestResult(null);
      setMessage(null);
      onClose();
      
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to add server: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5 text-blue-600" />
            <span>{editMode ? 'Edit MCP Server' : 'Add MCP Server'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {/* Progress Steps Indicator */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  1
                </div>
                <span className="text-sm font-medium text-blue-900">Basic Info</span>
              </div>
              <div className="w-8 h-px bg-blue-200"></div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  2
                </div>
                <span className="text-sm font-medium text-blue-900">Configuration</span>
              </div>
              <div className="w-8 h-px bg-blue-200"></div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  3
                </div>
                <span className="text-sm font-medium text-blue-900">Testing</span>
              </div>
            </div>
            <Badge variant="outline" className="bg-white border-blue-200 text-blue-700">
              <Server className="h-3 w-3 mr-1" />
              MCP Setup
            </Badge>
          </div>

          {/* Section 1: Basic Information */}
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Basic Information</h3>
                  <p className="text-sm text-gray-500">Name, category, and description for your MCP server</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="serverName" className="text-sm font-medium text-gray-700">
                    Server Name *
                  </Label>
                  <Input
                    id="serverName"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Custom Archer GRC Server, Document Processor"
                    disabled={isSaving}
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500">Choose a descriptive name to identify this MCP server</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium text-gray-700">
                    Category *
                  </Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    disabled={isSaving}
                  >
                    {serverCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">Select the type of service this MCP server provides</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Brief description of what this MCP server provides and when to use it..."
                  rows={3}
                  disabled={isSaving}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">Help team members understand the purpose and capabilities of this server</p>
              </div>
            </div>
          </div>

          {/* Section 2: Server Configuration */}
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Settings className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Server Configuration</h3>
                  <p className="text-sm text-gray-500">Endpoint URL and connection settings</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="endpoint" className="text-sm font-medium text-gray-700">
                  Server Endpoint URL *
                </Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="endpoint"
                    type="url"
                    value={formData.endpoint}
                    onChange={(e) => handleInputChange('endpoint', e.target.value)}
                    placeholder="https://your-mcp-server.com:3000"
                    className="pl-10 h-11 font-mono text-sm"
                    disabled={isSaving}
                  />
                </div>
                <p className="text-xs text-gray-500">The HTTP/HTTPS endpoint where your MCP server is running</p>
              </div>

              {/* Connection Assignment Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 text-sm">Connection Assignment</h4>
                  <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                    <Info className="h-3 w-3 mr-1" />
                    Optional
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  If this MCP server needs to access external systems (like Archer GRC), select a connection.
                </p>

                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm">Loading connections...</span>
                  </div>
                ) : availableConnections.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <div>
                      <h4 className="font-semibold">No connections available</h4>
                      <p className="text-sm">
                        You can create connections in the Connections page if your MCP server needs to access external systems.
                      </p>
                    </div>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Select Connection (Optional)</Label>
                    <select
                      value={formData.connectionId}
                      onChange={(e) => handleInputChange('connectionId', e.target.value)}
                      className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      disabled={isSaving}
                    >
                      <option value="">No connection (standalone server)</option>
                      {availableConnections.map(connection => (
                        <option key={connection.id} value={connection.id}>
                          {connection.name} ({connection.baseUrl})
                        </option>
                      ))}
                    </select>
                    {selectedConnection && (
                      <div className="flex items-center space-x-2 mt-2 p-3 bg-gray-50 rounded-lg">
                        <Database className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          Will use connection: <strong>{selectedConnection.name}</strong>
                        </span>
                        <Badge variant={selectedConnection.status === 'connected' ? 'default' : 'secondary'}>
                          {selectedConnection.status}
                        </Badge>
                      </div>
                    )}
                    <p className="text-xs text-gray-500">External connection credentials will be securely passed to the MCP server</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Test Configuration */}
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <TestTube className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Test Server Connection</h3>
                  <p className="text-sm text-gray-500">Verify connectivity and server availability before saving</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-start justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-green-900 text-sm mb-1">Connection Test</h4>
                  <p className="text-sm text-green-700">
                    Test your server configuration to ensure the MCP server is running and accessible
                  </p>
                </div>
                <Button
                  onClick={testConnection}
                  disabled={isTesting || isSaving || !formData.endpoint}
                  variant="outline"
                  className="ml-4 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>

              {testResult && (
                <div className="mt-4">
                  <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                      </p>
                      <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                        {testResult.message}
                      </p>
                    </div>
                  </Alert>
                </div>
              )}
            </div>
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || !!validateForm()}
            className="flex items-center space-x-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{editMode ? 'Updating...' : 'Adding...'}</span>
              </>
            ) : (
              <>
                <Server className="h-4 w-4" />
                <span>{editMode ? 'Update Server' : 'Add Server'}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}