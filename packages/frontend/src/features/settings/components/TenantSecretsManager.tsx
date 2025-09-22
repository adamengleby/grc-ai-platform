import { useState, useEffect } from 'react';
import { buildApiUrl } from '@/utils/apiUrls';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { Badge } from '@/app/components/ui/Badge';
import { Alert } from '@/app/components/ui/Alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/Dialog';
import { Textarea } from '@/app/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/Select';
import {
  Key,
  Plus,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { useAuthStore } from '@/app/store/auth';

interface TenantSecret {
  id: string;
  tenantId: string;
  secretName: string;
  secretType: 'api-key' | 'connection-string' | 'certificate' | 'custom';
  description?: string;
  keyVaultReference: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TenantSecretsManagerProps {
  onSecretSelect?: (secretName: string, keyVaultReference: string) => void;
  selectedSecret?: string;
  showSelection?: boolean;
  secretType?: 'api-key' | 'connection-string' | 'certificate' | 'custom';
}

export default function TenantSecretsManager({ 
  onSecretSelect,
  selectedSecret,
  showSelection = false,
  secretType = 'api-key'
}: TenantSecretsManagerProps) {
  const { tenant } = useAuthStore();
  const [secrets, setSecrets] = useState<TenantSecret[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecretValue, setShowSecretValue] = useState<string | null>(null);
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  const [newSecret, setNewSecret] = useState({
    secretName: '',
    secretValue: '',
    description: '',
    type: secretType,
    tags: {} as Record<string, string>
  });

  useEffect(() => {
    loadSecrets();
  }, [tenant?.id]);

  const loadSecrets = async () => {
    if (!tenant?.id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(buildApiUrl('tenant-secrets'), {
        headers: {
          'x-tenant-id': tenant.id,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load secrets: ${response.statusText}`);
      }

      const data = await response.json();
      setSecrets(data.data?.secrets || []);
    } catch (error) {
      console.error('Error loading tenant secrets:', error);
      setMessage({ type: 'error', text: 'Failed to load secrets' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSecret = async () => {
    if (!newSecret.secretName.trim() || !newSecret.secretValue.trim()) {
      setMessage({ type: 'error', text: 'Secret name and value are required' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(buildApiUrl('tenant-secrets'), {
        method: 'POST',
        headers: {
          'x-tenant-id': tenant?.id || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          secretName: newSecret.secretName.trim(),
          secretValue: newSecret.secretValue,
          description: newSecret.description.trim(),
          type: newSecret.type,
          tags: newSecret.tags
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create secret');
      }

      const data = await response.json();
      setMessage({ type: 'success', text: 'Secret created successfully' });
      
      // Reset form
      setNewSecret({
        secretName: '',
        secretValue: '',
        description: '',
        type: secretType,
        tags: {}
      });
      
      setIsAddModalOpen(false);
      await loadSecrets();
      
    } catch (error: any) {
      console.error('Error creating secret:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSecret = async (secretName: string) => {
    if (!confirm(`Are you sure you want to delete the secret "${secretName}"?`)) return;

    try {
      const response = await fetch(buildApiUrl(`tenant-secrets/${secretName}`), {
        method: 'DELETE',
        headers: {
          'x-tenant-id': tenant?.id || '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete secret');
      }

      setMessage({ type: 'success', text: 'Secret deleted successfully' });
      await loadSecrets();
    } catch (error: any) {
      console.error('Error deleting secret:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleViewSecret = async (secretName: string) => {
    if (showSecretValue === secretName) {
      setShowSecretValue(null);
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`tenant-secrets/${secretName}`), {
        headers: {
          'x-tenant-id': tenant?.id || '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve secret value');
      }

      const data = await response.json();
      setSecretValues(prev => ({ ...prev, [secretName]: data.data.secretValue }));
      setShowSecretValue(secretName);
      
    } catch (error: any) {
      console.error('Error retrieving secret:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard' });
  };

  const getSecretTypeLabel = (type: string) => {
    switch (type) {
      case 'api-key': return 'API Key';
      case 'connection-string': return 'Connection String';
      case 'certificate': return 'Certificate';
      case 'custom': return 'Custom';
      default: return 'Unknown';
    }
  };

  const getSecretTypeIcon = (type: string) => {
    switch (type) {
      case 'api-key': return <Key className="h-4 w-4" />;
      case 'connection-string': return <ExternalLink className="h-4 w-4" />;
      case 'certificate': return <Shield className="h-4 w-4" />;
      default: return <Key className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading secrets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tenant Secret Management</h3>
          <p className="text-sm text-gray-600">
            Securely store and manage API keys and other secrets in Azure Key Vault
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Secret</span>
        </Button>
      </div>

      {/* Message Display */}
      {message && (
        <Alert className={`
          ${message.type === 'success' ? 'border-green-200 bg-green-50' : ''}
          ${message.type === 'error' ? 'border-red-200 bg-red-50' : ''}
          ${message.type === 'info' ? 'border-blue-200 bg-blue-50' : ''}
        `}>
          <div className="flex items-center">
            {message.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600 mr-2" />}
            {message.type === 'error' && <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />}
            <span className={`text-sm ${
              message.type === 'success' ? 'text-green-800' : 
              message.type === 'error' ? 'text-red-800' : 'text-blue-800'
            }`}>
              {message.text}
            </span>
          </div>
        </Alert>
      )}

      {/* Secrets List */}
      {secrets.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Secrets Configured</h3>
            <p className="text-gray-600 text-center max-w-md">
              Create your first secret to securely store API keys, connection strings, and other sensitive data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {secrets.map((secret) => (
            <Card key={secret.id} className={`transition-all hover:shadow-md ${
              showSelection && selectedSecret === secret.secretName ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <CardTitle className="text-base">{secret.secretName}</CardTitle>
                      {getSecretTypeIcon(secret.secretType)}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {getSecretTypeLabel(secret.secretType)}
                    </Badge>
                  </div>
                  <Badge className={secret.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {secret.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {secret.description && (
                  <p className="text-sm text-gray-600">{secret.description}</p>
                )}

                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">Key Vault Reference:</span>
                  </div>
                  <code className="block bg-gray-100 px-2 py-1 rounded text-xs font-mono break-all">
                    {secret.keyVaultReference}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(secret.keyVaultReference)}
                    className="text-xs h-6"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Reference
                  </Button>
                </div>

                {showSecretValue === secret.secretName && secretValues[secret.secretName] && (
                  <div className="space-y-2 text-xs border-t pt-3">
                    <div className="flex items-center space-x-2">
                      <Key className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">Secret Value:</span>
                    </div>
                    <code className="block bg-yellow-50 border border-yellow-200 px-2 py-1 rounded text-xs font-mono break-all">
                      {secretValues[secret.secretName]}
                    </code>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  {showSelection ? (
                    <Button
                      size="sm"
                      variant={selectedSecret === secret.secretName ? "default" : "outline"}
                      onClick={() => onSecretSelect?.(secret.secretName, secret.keyVaultReference)}
                      className="flex items-center space-x-1"
                    >
                      <Key className="h-3 w-3" />
                      <span>{selectedSecret === secret.secretName ? 'Selected' : 'Select'}</span>
                    </Button>
                  ) : (
                    <span className="text-xs text-gray-500">
                      Created: {new Date(secret.createdAt).toLocaleDateString()}
                    </span>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewSecret(secret.secretName)}
                      className="flex items-center space-x-1"
                    >
                      {showSecretValue === secret.secretName ? 
                        <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />
                      }
                      <span>{showSecretValue === secret.secretName ? 'Hide' : 'View'}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteSecret(secret.secretName)}
                      className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Secret Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Secret</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secretName">Secret Name *</Label>
              <Input
                id="secretName"
                value={newSecret.secretName}
                onChange={(e) => setNewSecret(prev => ({ ...prev, secretName: e.target.value }))}
                placeholder="e.g., openai-api-key, azure-connection"
                disabled={isSaving}
              />
              <p className="text-xs text-gray-500">
                Use alphanumeric characters, hyphens, and underscores only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretValue">Secret Value *</Label>
              <Textarea
                id="secretValue"
                value={newSecret.secretValue}
                onChange={(e) => setNewSecret(prev => ({ ...prev, secretValue: e.target.value }))}
                placeholder="Enter the secret value..."
                disabled={isSaving}
                className="font-mono text-sm"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretType">Secret Type</Label>
              <Select
                value={newSecret.type}
                onValueChange={(value) => setNewSecret(prev => ({ ...prev, type: value as any }))}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api-key">API Key</SelectItem>
                  <SelectItem value="connection-string">Connection String</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={newSecret.description}
                onChange={(e) => setNewSecret(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this secret..."
                disabled={isSaving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateSecret} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Secret'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}