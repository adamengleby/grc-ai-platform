import React from 'react';
import { Check, Building2, Globe, Factory } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/auth';

export interface McpTenant {
  id: string;
  name: string;
  industry: string;
  region: string;
  settings: {
    riskAppetite: 'low' | 'moderate' | 'high';
    complianceFrameworks: string[];
    notificationPreferences: {
      email: boolean;
      sms: boolean;
      criticalAlertsOnly: boolean;
    };
  };
}

interface TenantSelectorProps {
  selectedTenant: McpTenant | null;
  onTenantChange: (tenant: McpTenant) => void;
  className?: string;
  allowCrossTenantAccess?: boolean; // For platform admin cross-tenant access
}

// Mock tenant data for all available tenants (only visible to platform owners)
const allAvailableTenants: McpTenant[] = [
  {
    id: 'tenant-fintech-001',
    name: 'FinTech Solutions Corp',
    industry: 'Financial Services',
    region: 'North America',
    settings: {
      riskAppetite: 'moderate',
      complianceFrameworks: ['SOX', 'PCI-DSS', 'GDPR'],
      notificationPreferences: {
        email: true,
        sms: false,
        criticalAlertsOnly: false
      }
    }
  },
  {
    id: 'tenant-healthcare-002',
    name: 'Global Healthcare Systems',
    industry: 'Healthcare',
    region: 'Europe',
    settings: {
      riskAppetite: 'low',
      complianceFrameworks: ['HIPAA', 'GDPR', 'ISO 27001'],
      notificationPreferences: {
        email: true,
        sms: true,
        criticalAlertsOnly: true
      }
    }
  },
  {
    id: 'tenant-manufacturing-003',
    name: 'Advanced Manufacturing Ltd',
    industry: 'Manufacturing',
    region: 'Asia Pacific',
    settings: {
      riskAppetite: 'high',
      complianceFrameworks: ['ISO 9001', 'ISO 14001', 'OHSAS 18001'],
      notificationPreferences: {
        email: true,
        sms: false,
        criticalAlertsOnly: false
      }
    }
  }
];

// Helper function to map auth tenant ID to MCP tenant ID format
const mapTenantIdToMcpFormat = (authTenantId: string): string => {
  switch (authTenantId) {
    case 'tenant-fintech':
      return 'tenant-fintech-001';
    case 'tenant-acme':
      return 'tenant-acme'; // Keep original tenant ID
    case 'tenant-healthcare':
      return 'tenant-healthcare-002';
    default:
      return authTenantId;
  }
};

// Helper function to get user-accessible tenants based on role and permissions
const getUserAccessibleTenants = (user: any, tenant: any, allowCrossTenantAccess: boolean): McpTenant[] => {
  // In production mode, regular users only see their own tenant
  // Only platform owners (SaaS admins) should see all tenants
  const isPlatformOwner = user?.roles?.includes('PlatformOwner') || user?.roles?.includes('SuperAdmin');
  
  if (allowCrossTenantAccess || isPlatformOwner) {
    // Platform owner - show all tenants for cross-tenant access
    return allAvailableTenants;
  } else {
    // Production mode - only show user's own tenant
    const userMcpTenantId = mapTenantIdToMcpFormat(tenant?.id || '');
    return allAvailableTenants.filter(t => t.id === userMcpTenantId);
  }
};

const getIndustryIcon = (industry: string) => {
  switch (industry.toLowerCase()) {
    case 'financial services':
      return <Building2 className="h-4 w-4" />;
    case 'healthcare':
      return <div className="h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">+</div>;
    case 'manufacturing':
      return <Factory className="h-4 w-4" />;
    default:
      return <Building2 className="h-4 w-4" />;
  }
};

const getRiskAppetiteColor = (appetite: string) => {
  switch (appetite) {
    case 'low':
      return 'text-green-600 bg-green-100';
    case 'moderate':
      return 'text-yellow-600 bg-yellow-100';
    case 'high':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const TenantSelector: React.FC<TenantSelectorProps> = ({
  selectedTenant,
  onTenantChange,
  className,
  allowCrossTenantAccess = false // Default to production mode (tenant isolation)
}) => {
  const { user, tenant: currentTenant } = useAuthStore();
  
  // Get tenants the current user is allowed to access
  const availableTenants = getUserAccessibleTenants(user, currentTenant, allowCrossTenantAccess);
  
  return (
    <div className={clsx('space-y-3', className)}>
      <div className="flex items-center space-x-2 mb-4">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {availableTenants.length > 1 ? 'Select Tenant Context' : 'Tenant Context'}
        </span>
        {!allowCrossTenantAccess && availableTenants.length === 1 && (
          <span className="text-xs text-muted-foreground">(Production Mode)</span>
        )}
      </div>

      {availableTenants.map((tenant) => {
        const isSelected = selectedTenant?.id === tenant.id;
        
        return (
          <div
            key={tenant.id}
            className={clsx(
              'p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md',
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            )}
            onClick={() => onTenantChange(tenant)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {getIndustryIcon(tenant.industry)}
                  <h3 className="font-semibold text-sm">{tenant.name}</h3>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Factory className="h-3 w-3" />
                    <span>{tenant.industry}</span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Globe className="h-3 w-3" />
                    <span>{tenant.region}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 mt-2">
                  <span
                    className={clsx(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      getRiskAppetiteColor(tenant.settings.riskAppetite)
                    )}
                  >
                    {tenant.settings.riskAppetite.charAt(0).toUpperCase() + tenant.settings.riskAppetite.slice(1)} Risk
                  </span>
                  
                  <div className="flex flex-wrap gap-1">
                    {tenant.settings.complianceFrameworks.slice(0, 2).map((framework) => (
                      <span
                        key={framework}
                        className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-xs"
                      >
                        {framework}
                      </span>
                    ))}
                    {tenant.settings.complianceFrameworks.length > 2 && (
                      <span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">
                        +{tenant.settings.complianceFrameworks.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Export the tenant data and helper functions for use in other components
export const availableTenants = allAvailableTenants;
export { getUserAccessibleTenants, mapTenantIdToMcpFormat };