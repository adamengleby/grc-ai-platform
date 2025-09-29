import React from 'react';
import { useAuthStore } from '@/store/auth';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';
import { OperationalDashboard } from '@/components/dashboard/OperationalDashboard';
import { AuditDashboard } from '@/components/dashboard/AuditDashboard';

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