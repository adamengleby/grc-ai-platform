import { useState } from 'react';
import { TenantManagementSection } from '../components/TenantManagementSection';
import { SAMLConfigurationForm } from '../components/SAMLConfigurationForm';
import { Tenant } from '../types';

export function TenantManagementPage() {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  
  // Mock user permissions - in real app this would come from auth store
  const canModify = true; // user?.roles?.includes('TenantOwner') || false;
  const isSaving = false;

  const handleCloseSAMLForm = () => {
    setSelectedTenant(null);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <TenantManagementSection 
        canModify={canModify}
        isSaving={isSaving}
      />
      
      {selectedTenant && (
        <SAMLConfigurationForm
          tenant={selectedTenant}
          canModify={canModify}
          onClose={handleCloseSAMLForm}
        />
      )}
    </div>
  );
}