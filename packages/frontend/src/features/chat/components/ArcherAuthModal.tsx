import React, { useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Alert } from '@/app/components/ui/Alert';
import { Shield, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useArcherSessionStore } from '@/app/store/archerSession';

interface ArcherAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (sessionData: ArcherSessionData) => void;
  tenantId: string;
}

export interface ArcherSessionData {
  sessionId: string; // Changed from sessionToken to sessionId for security
  expiresAt: Date;
  oauthToken?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    allowed_tools: string[];
  };
  userInfo: {
    username: string;
    instanceId: string;
    baseUrl: string;
  };
}

interface AuthFormData {
  baseUrl: string;
  instanceId: string;
  username: string;
  password: string;
  userDomainId: string;
}

export const ArcherAuthModal: React.FC<ArcherAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  tenantId
}) => {
  // Load saved values from localStorage or use defaults
  const [formData, setFormData] = useState<AuthFormData>(() => {
    try {
      const saved = localStorage.getItem('archerAuthData');
      if (saved) {
        const parsedData = JSON.parse(saved);
        return {
          baseUrl: parsedData.baseUrl || '',
          instanceId: parsedData.instanceId || '',
          username: parsedData.username || '',
          password: '', // Never save password
          userDomainId: parsedData.userDomainId || ''
        };
      }
    } catch (error) {
      console.warn('[Auth Modal] Failed to load saved auth data:', error);
    }
    
    return {
      baseUrl: '',
      instanceId: '',
      username: '',
      password: '',
      userDomainId: ''
    };
  });
  
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'authenticating' | 'success'>('form');

  // Get session store methods
  const { setSession } = useArcherSessionStore();

  const handleInputChange = (field: keyof AuthFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const authenticateWithArcher = async (): Promise<ArcherSessionData> => {
    const authData = {
      baseUrl: formData.baseUrl,
      instanceId: formData.instanceId,
      username: formData.username,
      password: formData.password,
      userDomainId: formData.userDomainId
    };

    // Use backend proxy to avoid CORS issues
    const response = await fetch(`http://localhost:3005/api/v1/auth/archer/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(authData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Authentication failed' }));
      throw new Error(errorData.error || `Authentication failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Authentication failed');
    }

    return {
      sessionId: result.sessionData.sessionId, // Now receiving sessionId instead of token
      expiresAt: new Date(result.sessionData.expiresAt),
      oauthToken: result.sessionData.oauthToken, // Capture OAuth token for MCP tool access
      userInfo: result.sessionData.userInfo
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setError(null);
    setStep('authenticating');

    try {
      // Validate required fields
      if (!formData.baseUrl || !formData.instanceId || !formData.username || !formData.password) {
        throw new Error('Please fill in all required fields');
      }

      // Authenticate with Archer
      const sessionData = await authenticateWithArcher();
      
      // Save form data to localStorage for next time (excluding password)
      try {
        const dataToSave = {
          baseUrl: formData.baseUrl,
          instanceId: formData.instanceId,
          username: formData.username,
          userDomainId: formData.userDomainId
          // Note: password is intentionally excluded for security
        };
        localStorage.setItem('archerAuthData', JSON.stringify(dataToSave));
        console.log('[Auth Modal] Saved authentication data for next session');
      } catch (error) {
        console.warn('[Auth Modal] Failed to save authentication data:', error);
      }
      
      setStep('success');
      
      // Store session data in Zustand store for MCP access
      console.log('[Auth Modal] Storing session data for MCP access:', { sessionId: sessionData.sessionId });
      setSession(sessionData);
      
      // Brief success display, then call callback
      setTimeout(() => {
        onAuthenticated(sessionData);
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Archer authentication failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setStep('form');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Authenticate to Archer GRC
          </h2>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Archer Base URL *
              </label>
              <Input
                type="url"
                placeholder="https://your-archer-instance.com"
                value={formData.baseUrl}
                onChange={(e) => handleInputChange('baseUrl', e.target.value)}
                required
                disabled={isAuthenticating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instance ID *
              </label>
              <Input
                type="text"
                placeholder="e.g., 123456"
                value={formData.instanceId}
                onChange={(e) => handleInputChange('instanceId', e.target.value)}
                required
                disabled={isAuthenticating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <Input
                type="text"
                placeholder="Your Archer username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                required
                disabled={isAuthenticating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <Input
                type="password"
                placeholder="Your Archer password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                required
                disabled={isAuthenticating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Domain ID
              </label>
              <Input
                type="text"
                placeholder="1"
                value={formData.userDomainId}
                onChange={(e) => handleInputChange('userDomainId', e.target.value)}
                disabled={isAuthenticating}
              />
              <p className="text-xs text-gray-500 mt-1">Usually "1" for default domain</p>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <div>
                  <strong>Authentication Failed</strong>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </Alert>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isAuthenticating}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isAuthenticating}
                className="flex-1"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Authenticate'
                )}
              </Button>
            </div>
          </form>
        )}

        {step === 'authenticating' && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Authenticating with Archer...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="h-8 w-8 mx-auto mb-4 text-green-600" />
            <p className="text-gray-900 font-medium">Authentication Successful!</p>
            <p className="text-sm text-gray-500 mt-2">
              Connected to {formData.instanceId} as {formData.username}
            </p>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Secure Authentication</p>
              <p>Your credentials are sent directly to Archer and not stored by our platform. Your session will expire after 20 minutes of inactivity.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};