import React, { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/app/store/auth';
import { useDashboardStore } from '@/app/store/dashboard';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { Loader2 } from 'lucide-react';

/**
 * Main dashboard layout component that wraps all authenticated pages
 * Handles authentication checks, tenant context, and responsive layout
 */
export const DashboardLayout: React.FC = () => {
  const { isAuthenticated, isLoading, isInitialized, user, tenant } = useAuthStore();
  const { loadDashboardData, sidebarCollapsed } = useDashboardStore();

  // Don't auto-refresh auth in dashboard layout - this should only happen in App.tsx
  // The redirect to login will happen if not authenticated

  // Load dashboard data when tenant changes
  useEffect(() => {
    if (tenant && isAuthenticated) {
      loadDashboardData(tenant.id);
    }
  }, [tenant?.id, isAuthenticated, loadDashboardData]);


  // Wait for auth initialization before making decisions
  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  // After initialization, redirect to login if not authenticated
  if (!isAuthenticated || !user || !tenant) {
    console.log('DashboardLayout: Redirecting to login - not authenticated');
    return <Navigate to="/login" replace />;
  }

  // Show loading spinner only if we have auth but loading other data
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <DashboardSidebar />
      
      {/* Main content area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'ml-16' : 'ml-64'
      }`}>
        {/* Header */}
        <DashboardHeader />
        
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-muted/50">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};