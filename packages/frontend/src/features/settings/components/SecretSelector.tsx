import { useState, useEffect } from 'react';
import { buildApiUrl } from '@/utils/apiUrls';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { Badge } from '@/app/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/Dialog';
import { Alert } from '@/app/components/ui/Alert';
import {
  Key,
  Shield,
  Plus,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '@/app/store/auth';

interface TenantSecret {
  id: string;
  secretName: string;
  secretType: 'api-key' | 'connection-string' | 'certificate' | 'custom';
  description?: string;
  keyVaultReference: string;
  isActive: boolean;
  createdAt: string;
}

interface SecretSelectorProps {
  value?: string; // Selected secret name
  onValueChange?: (secretName: string, keyVaultReference: string) => void;
  secretType?: 'api-key' | 'connection-string' | 'certificate' | 'custom';
  placeholder?: string;
  disabled?: boolean;
  allowDirectInput?: boolean;
  onDirectInputChange?: (value: string) => void;
  directInputValue?: string;
  showCreateButton?: boolean;
}

export default function SecretSelector({
  value,
  onValueChange,
  secretType = 'api-key',
  placeholder = 'Select a secret or enter directly...',
  disabled = false,
  allowDirectInput = true,
  onDirectInputChange,
  directInputValue = '',
  showCreateButton = true
}: SecretSelectorProps) {
  const { tenant } = useAuthStore();
  const [secrets, setSecrets] = useState<TenantSecret[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [useSecret, setUseSecret] = useState<boolean>(!!value);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [newSecret, setNewSecret] = useState({
    secretName: '',
    secretValue: '',
    description: '',
    type: secretType
  });
  const [isCreating, setIsCreating] = useState(false);

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

      if (response.ok) {
        const data = await response.json();
        const allSecrets = data.data?.secrets || [];
        // Filter by secret type if specified
        const filteredSecrets = secretType !== 'custom' 
          ? allSecrets.filter((s: TenantSecret) => s.secretType === secretType || s.secretType === 'custom')
          : allSecrets;
        setSecrets(filteredSecrets);
      }
    } catch (error) {
      console.error('Error loading secrets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSecret = async () => {
    if (!newSecret.secretName.trim() || !newSecret.secretValue.trim()) {
      setMessage({ type: 'error', text: 'Secret name and value are required' });
      return;
    }

    setIsCreating(true);
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
          type: newSecret.type
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
        type: secretType
      });
      
      setShowCreateModal(false);
      
      // Reload secrets and auto-select the new one
      await loadSecrets();
      setTimeout(() => {
        setUseSecret(true);
        onValueChange?.(newSecret.secretName.trim(), data.data.secretReference);
      }, 100);
      
    } catch (error: any) {
      console.error('Error creating secret:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSecretSelect = (secretName: string) => {
    const secret = secrets.find(s => s.secretName === secretName);
    if (secret) {
      onValueChange?.(secretName, secret.keyVaultReference);
    }
  };

  const handleToggleMode = (useSecretMode: boolean) => {
    setUseSecret(useSecretMode);
    if (!useSecretMode) {
      onValueChange?.('', ''); // Clear secret selection
    }
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

  const selectedSecret = secrets.find(s => s.secretName === value);

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="flex items-center space-x-4">
        <Label className="text-sm font-medium">API Key Configuration:</Label>
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="use-direct"
            checked={!useSecret}
            onChange={() => handleToggleMode(false)}
            disabled={disabled}
          />
          <label htmlFor="use-direct" className="text-sm">Enter directly</label>
          
          <input
            type="radio"
            id="use-secret"
            checked={useSecret}
            onChange={() => handleToggleMode(true)}
            disabled={disabled}
          />
          <label htmlFor="use-secret" className="text-sm">Use managed secret</label>
        </div>
      </div>

      {/* Direct Input Mode */}
      {!useSecret && allowDirectInput && (
        <div className="space-y-2">
          <Label htmlFor="direct-input">API Key</Label>
          <Input
            id="direct-input"
            type="password"
            value={directInputValue}
            onChange={(e) => onDirectInputChange?.(e.target.value)}
            placeholder="Enter API key directly..."
            disabled={disabled}
            className="font-mono"
          />
          <p className="text-xs text-gray-500">
            For development use. Consider using managed secrets for production.
          </p>
        </div>
      )}

      {/* Secret Selection Mode */}
      {useSecret && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Select Managed Secret</Label>
            {showCreateButton && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreateModal(true)}
                disabled={disabled}
                className="text-xs h-7"
              >
                <Plus className="h-3 w-3 mr-1" />
                Create New
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading secrets...</span>
            </div>
          ) : secrets.length === 0 ? (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-800 text-sm">
                No {getSecretTypeLabel(secretType).toLowerCase()} secrets found. Create one to get started.
              </span>
            </Alert>
          ) : (
            <select
              value={value || ''}
              onChange={(e) => handleSecretSelect(e.target.value)}
              disabled={disabled}
              className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{placeholder}</option>
              {secrets.map((secret) => (
                <option key={secret.id} value={secret.secretName}>
                  {secret.secretName} - {getSecretTypeLabel(secret.secretType)}
                </option>
              ))}
            </select>
          )}

          {/* Selected Secret Info */}
          {selectedSecret && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Selected Secret</span>
              </div>
              <div className="text-xs text-blue-800 space-y-1">
                <div><strong>Name:</strong> {selectedSecret.secretName}</div>
                {selectedSecret.description && (
                  <div><strong>Description:</strong> {selectedSecret.description}</div>
                )}
                <div><strong>Type:</strong> {getSecretTypeLabel(selectedSecret.secretType)}</div>
                <div><strong>Key Vault Reference:</strong></div>
                <code className="block bg-blue-100 px-2 py-1 rounded text-xs font-mono break-all">
                  {selectedSecret.keyVaultReference}
                </code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message Display */}
      {message && (
        <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <div className="flex items-center">
            {message.type === 'success' ? 
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" /> :
              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
            }
            <span className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {message.text}
            </span>
          </div>
        </Alert>
      )}

      {/* Create Secret Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New {getSecretTypeLabel(secretType)}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-secretName">Secret Name *</Label>
              <Input
                id="modal-secretName"
                value={newSecret.secretName}
                onChange={(e) => setNewSecret(prev => ({ ...prev, secretName: e.target.value }))}
                placeholder="e.g., openai-api-key"
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-secretValue">Secret Value *</Label>
              <Input
                id="modal-secretValue"
                type="password"
                value={newSecret.secretValue}
                onChange={(e) => setNewSecret(prev => ({ ...prev, secretValue: e.target.value }))}
                placeholder="Enter the secret value..."
                disabled={isCreating}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-description">Description (Optional)</Label>
              <Input
                id="modal-description"
                value={newSecret.description}
                onChange={(e) => setNewSecret(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
                disabled={isCreating}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateSecret} disabled={isCreating}>
              {isCreating ? (
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