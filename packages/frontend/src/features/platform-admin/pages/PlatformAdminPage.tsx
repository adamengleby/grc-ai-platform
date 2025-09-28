import { TenantManagementSection } from '@/features/tenant-management/components/TenantManagementSection';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Alert } from '@/app/components/ui/Alert';
import { Badge } from '@/app/components/ui/Badge';
import { useAuthStore } from '@/app/store/auth';
import {
  Shield,
  Building2,
  Users,
  Settings,
  BarChart3,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

export function PlatformAdminPage() {
  const { user } = useAuthStore();
  
  // Check if user has platform admin role
  const isPlatformAdmin = user?.roles?.includes('PlatformOwner') || false;
  const isSaving = false;

  if (!isPlatformAdmin) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-red-800">Access denied. Platform administrator privileges required.</span>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Platform Administration</h1>
        </div>
        <p className="text-gray-600">
          Manage tenants, platform configuration, and system-wide settings for the GRC Analytics Platform.
        </p>
      </div>

      {/* Platform Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                <p className="text-2xl font-bold text-gray-900">1</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">SAML Configured</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Healthy</span>
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tenant Management Section */}
      <TenantManagementSection 
        canModify={isPlatformAdmin}
        isSaving={isSaving}
      />

      {/* Platform Settings */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Platform Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Security Settings</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm">Require SAML for all tenants</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm">Enable platform audit logging</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Force password complexity rules</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">System Limits</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm text-gray-600">Max tenants per platform</label>
                  <input 
                    type="number" 
                    defaultValue={100} 
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Max users per tenant</label>
                  <input 
                    type="number" 
                    defaultValue={1000} 
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Save Platform Settings
            </button>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Database</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Type: SQLite (Development)</p>
                <p>Status: <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge></p>
                <p>Tables: 15</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Authentication</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>SAML Providers: 0</p>
                <p>Active Sessions: 0</p>
                <p>Session Timeout: 8 hours</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Platform</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Version: 1.0.0</p>
                <p>Environment: Development</p>
                <p>Uptime: 2h 45m</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}