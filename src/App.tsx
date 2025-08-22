import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoginPage } from '@/components/auth/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AgentsPage } from '@/pages/AgentsPage';
import { ChatPage } from '@/pages/ChatPage';
import { AuditPage } from '@/pages/AuditPage';
import { UsersPage } from '@/pages/UsersPage';
import { AIInsightsPage } from '@/pages/AIInsightsPage';
import { ToolsPage } from '@/pages/ToolsPage';
import { ConnectionsPage } from '@/pages/ConnectionsPage';
import SettingsPage from '@/pages/SettingsPage';
import './styles/globals.css';

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
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected routes - wrapped in DashboardLayout */}
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="mcp-servers" element={<Navigate to="/settings?tab=mcp-servers" replace />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="ai-insights" element={<AIInsightsPage />} />
            <Route path="tools" element={<ToolsPage />} />
            <Route path="connections" element={<ConnectionsPage />} />
            <Route path="llm-config" element={<Navigate to="/settings?tab=llm" replace />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;