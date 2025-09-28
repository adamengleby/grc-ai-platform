import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Alert } from '@/app/components/ui/Alert';
import { Badge } from '@/app/components/ui/Badge';
import {
  Building2,
  Plus,
  Settings,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';
import { tenantManagementApi } from '../services/tenantManagementApi';
import { Tenant } from '../types';

interface TenantManagementSectionProps {
  canModify: boolean;
  isSaving: boolean;
}

export function TenantManagementSection({ canModify, isSaving }: TenantManagementSectionProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tenantManagementApi.getTenants();
      setTenants(response.tenants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <CardTitle>Tenant Management</CardTitle>
            </div>
            {canModify && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                disabled={isSaving}
              >
                <Plus className="h-4 w-4" />
                <span>Create Tenant</span>
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-sm">
            Manage multi-tenant configurations, SAML authentication, and access controls.
          </p>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-red-800">{error}</span>
        </Alert>
      )}

      {/* Tenants List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No tenants configured</p>
              <p className="text-gray-400 text-sm">Create your first tenant to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tenants.map((tenant) => (
                <div
                  key={tenant.tenant_id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                        <p className="text-sm text-gray-500">/{tenant.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(tenant.status)}
                    </div>
                  </div>

                  {tenant.description && (
                    <p className="text-sm text-gray-600 mb-3">{tenant.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Contact: {tenant.contact_email}</span>
                      {tenant.domain && <span>Domain: {tenant.domain}</span>}
                      <span>Created: {new Date(tenant.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedTenant(tenant)}
                        className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      >
                        <Settings className="h-3 w-3" />
                        <span>Configure SAML</span>
                      </button>
                      <button className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                        <Users className="h-3 w-3" />
                        <span>Users</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 text-left">
              <Shield className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-medium">SAML Testing</p>
                <p className="text-sm text-gray-500">Test SAML configurations</p>
              </div>
            </button>
            
            <button className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 text-left">
              <Users className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium">User Management</p>
                <p className="text-sm text-gray-500">Manage tenant users</p>
              </div>
            </button>
            
            <button className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 text-left">
              <ExternalLink className="h-6 w-6 text-purple-600" />
              <div>
                <p className="font-medium">Documentation</p>
                <p className="text-sm text-gray-500">SAML setup guides</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Platform Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platform Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{tenants.length}</div>
              <div className="text-sm text-blue-700">Total Tenants</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {tenants.filter(t => t.status === 'active').length}
              </div>
              <div className="text-sm text-green-700">Active Tenants</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">0</div>
              <div className="text-sm text-purple-700">SAML Configured</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">0</div>
              <div className="text-sm text-orange-700">Total Users</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}