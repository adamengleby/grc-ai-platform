import React from 'react';
import { useAuthStore } from '@/app/store/auth';
import { ExecutiveDashboard } from '@/features/dashboard/components/ExecutiveDashboard';
import { OperationalDashboard } from '@/features/dashboard/components/OperationalDashboard';
import { AuditDashboard } from '@/features/dashboard/components/AuditDashboard';

/**
 * Main dashboard page that renders different views based on user role
 * - Tenant Owner: Executive Dashboard (strategic overview)
 * - Agent User: Operational Dashboard (agent management)
 * - Auditor/Compliance Officer: Audit Dashboard (compliance focus)
 */
export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  if (!user) return null;

  // Determine which dashboard to show based on primary role
  const primaryRole = user.roles[0];

  switch (primaryRole) {
    case 'TenantOwner':
      return <ExecutiveDashboard />;
    
    case 'AgentUser':
      return <OperationalDashboard />;
    
    case 'Auditor':
    case 'ComplianceOfficer':
      return <AuditDashboard />;
    
    default:
      // Fallback to operational dashboard for unknown roles
      return <OperationalDashboard />;
  }
};
