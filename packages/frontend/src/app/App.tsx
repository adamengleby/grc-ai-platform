import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/app/store/auth';
import { DashboardLayout } from '@/app/components/layout/DashboardLayout';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { AgentsPage } from '@/features/agents/pages/AgentsPage';
import { AuditPage } from '@/features/audit/pages/AuditPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import { ToolsPage } from '@/features/tools/pages/ToolsPage';
import { ConnectionsPage } from '@/features/connections/pages/ConnectionsPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';
import { ChatPage } from '@/features/chat/pages/ChatPage';
import { PlatformAdminPage } from '@/features/platform-admin/pages/PlatformAdminPage';
import '@/styles/globals.css';

/**
 * Main application component with routing and authentication
 * Handles theme initialization and route protection
 */
function App() {
  const { initializeAuth } = useAuthStore();

  // Initialize theme and authentication on app start
  useEffect(() => {
    // Set initial theme from localStorage
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }

    // Initialize auth state synchronously to prevent cycling
    initializeAuth();
  }, [initializeAuth]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected routes - wrapped in DashboardLayout */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/analytics" replace />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="mcp-servers" element={<Navigate to="/settings?tab=mcp-servers" replace />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="llm-config" element={<Navigate to="/settings?tab=llm" replace />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="platform-admin" element={<PlatformAdminPage />} />
        </Route>
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Routes>
    </div>
  );
}

export default App;