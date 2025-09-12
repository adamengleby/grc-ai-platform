import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../../app/store/auth';
import { Button } from '../../../app/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../app/components/ui/Card';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Login page with Azure AD B2C simulation
 * Shows available demo users and tenant selection
 */
export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loginMethod, setLoginMethod] = useState<'credentials' | 'demo'>('credentials');
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  // Demo users for testing different roles and tenants
  const demoUsers = [
    {
      email: 'admin@platform.com',
      name: 'Alex Rodriguez',
      role: 'Platform Owner',
      tenant: 'SaaS Platform Admin',
      description: 'Master admin with cross-tenant access and full platform management capabilities'
    },
    {
      email: 'user1@acme.com',
      name: 'Sarah Chen',
      role: 'Tenant Owner',
      tenant: 'ACME Corporation',
      description: 'Full administrative access to ACME tenant with all MCP tools enabled'
    },
    {
      email: 'analyst@acme.com',
      name: 'Mike Johnson',
      role: 'Agent User',
      tenant: 'ACME Corporation',
      description: 'Operational dashboard access with ability to manage and run AI agents'
    },
    {
      email: 'audit@acme.com',
      name: 'Lisa Wang',
      role: 'Auditor & Compliance Officer',
      tenant: 'ACME Corporation',
      description: 'Read-only access to audit trails, compliance reports, and risk assessments'
    },
    {
      email: 'owner@fintech.com',
      name: 'David Smith',
      role: 'Tenant Owner',
      tenant: 'FinTech Solutions Ltd',
      description: 'Full access to FinTech tenant with limited MCP tools (no BYO LLM)'
    },
  ];

  // Clear errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCredentialLogin = async () => {
    if (!credentials.email || !credentials.password) return;
    console.log('Attempting credential login with user:', credentials.email);
    await login(credentials.email, credentials.password);
  };

  const handleDemoLogin = async () => {
    if (!selectedUser) return;
    console.log('Attempting demo login with user:', selectedUser);
    await login(selectedUser);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-2xl p-6">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">GRC Multi-Tenant Platform</CardTitle>
            <p className="text-muted-foreground">
              AI-powered Governance, Risk & Compliance dashboard with MCP server integration
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Azure AD B2C Info */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Azure AD B2C Authentication
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    In production, this would redirect to your Azure B2C tenant for secure authentication with MFA support.
                  </p>
                </div>
              </div>
            </div>

            {/* Login Method Toggle */}
            <div className="flex justify-center space-x-1 bg-muted rounded-lg p-1">
              <button
                type="button"
                onClick={() => setLoginMethod('credentials')}
                className={clsx(
                  'px-6 py-2 rounded-md text-sm font-medium transition-colors',
                  loginMethod === 'credentials'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Email & Password
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('demo')}
                className={clsx(
                  'px-6 py-2 rounded-md text-sm font-medium transition-colors',
                  loginMethod === 'demo'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Demo Users
              </button>
            </div>

            {/* Credential Login Form */}
            {loginMethod === 'credentials' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={credentials.email}
                    onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                    placeholder="user1@acme.com"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                    placeholder="Enter your password"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <p className="font-medium mb-1">For testing, use any of these emails with any password:</p>
                  <p>• user1@acme.com (Sarah Chen - Tenant Owner)</p>
                  <p>• analyst@acme.com (Mike Johnson - Agent User)</p>
                  <p>• audit@acme.com (Lisa Wang - Auditor)</p>
                  <p>• admin@platform.com (Alex Rodriguez - Platform Owner)</p>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-red-900 dark:text-red-100 font-medium">
                    Authentication Error
                  </p>
                </div>
                <p className="text-red-700 dark:text-red-300 mt-1 text-sm">
                  {error}
                </p>
              </div>
            )}

            {/* Demo Users */}
            {loginMethod === 'demo' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Select Demo User</h3>
              <div className="space-y-3">
                {demoUsers.map((user) => (
                  <div
                    key={user.email}
                    className={clsx(
                      'p-4 border rounded-lg cursor-pointer transition-colors',
                      selectedUser === user.email
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedUser(user.email)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-medium">{user.name}</h4>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded">
                              {user.role}
                            </span>
                            <span className="text-muted-foreground">
                              {user.tenant}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            {user.description}
                          </p>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className={clsx(
                          'w-4 h-4 rounded-full border-2 transition-colors',
                          selectedUser === user.email
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        )}>
                          {selectedUser === user.email && (
                            <div className="w-2 h-2 bg-primary-foreground rounded-full m-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            )}

            {/* Login Button */}
            <Button
              onClick={loginMethod === 'credentials' ? handleCredentialLogin : handleDemoLogin}
              disabled={
                (loginMethod === 'credentials' && (!credentials.email || !credentials.password)) ||
                (loginMethod === 'demo' && !selectedUser) ||
                isLoading
              }
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Sign in with Azure AD B2C
                </>
              )}
            </Button>

            {/* Platform Info */}
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>This demo showcases a multi-tenant SaaS platform with:</p>
              <ul className="text-xs space-y-1">
                <li>• Tenant-isolated AI agents with configurable MCP tools</li>
                <li>• Role-based access control (Platform Owner, Tenant Owner, Agent User, Auditor)</li>
                <li>• Azure AD B2C integration with tenant context and cross-tenant management</li>
                <li>• Platform-compliant audit logging and compliance reporting</li>
                <li>• Real-time GRC data visualization and risk assessment</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};