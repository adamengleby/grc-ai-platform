import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useDashboardStore } from '@/store/dashboard';
import { Button } from '@/components/ui/Button';
import {
  Bell,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  Building,
  Moon,
  Sun,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Dashboard header with tenant info, notifications, and user actions
 * Includes tenant switching, theme toggle, and user menu
 */
export const DashboardHeader: React.FC = () => {
  const navigate = useNavigate();
  const { user, tenant, availableTenants, switchTenant, logout } = useAuthStore();
  const { refreshMetrics } = useDashboardStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );

  if (!user || !tenant) return null;

  const handleTenantSwitch = async (tenantId: string) => {
    if (tenantId !== tenant.id) {
      await switchTenant(tenantId);
    }
    setIsTenantMenuOpen(false);
  };

  const handleThemeToggle = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    document.documentElement.classList.toggle('dark', newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const handleRefresh = () => {
    refreshMetrics(tenant.id);
  };

  const handleLogout = async () => {
    // Close the user menu immediately to prevent visual hanging
    setIsUserMenuOpen(false);
    
    try {
      // Perform logout
      await logout();
      // Navigate to login page immediately after logout
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, navigate to login
      navigate('/login', { replace: true });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'suspended':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'provisioning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="flex h-full items-center px-6">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents, tools, or ask GRC questions..."
              className="w-full bg-muted/50 border-0 pl-10 pr-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-4 ml-6">
          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title="Refresh dashboard data"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeToggle}
            title="Toggle theme"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
              3
            </span>
          </Button>

          {/* Tenant selector - only show dropdown for platform owners */}
          <div className="relative">
            {user.roles.includes('PlatformOwner') || availableTenants.length > 1 ? (
              <Button
                variant="outline"
                className="flex items-center space-x-2"
                onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
              >
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline max-w-32 truncate">
                  {tenant.name}
                </span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    getStatusBadge(tenant.status)
                  )}
                >
                  {tenant.status}
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            ) : (
              // Show tenant info without dropdown for regular users
              <div className="flex items-center space-x-2 px-3 py-2 border rounded-md bg-muted/20">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline max-w-32 truncate">
                  {tenant.name}
                </span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    getStatusBadge(tenant.status)
                  )}
                >
                  {tenant.status}
                </span>
              </div>
            )}

            {/* Tenant dropdown - only for platform owners */}
            {isTenantMenuOpen && (user.roles.includes('PlatformOwner') || availableTenants.length > 1) && (
              <div className="absolute right-0 top-12 w-72 bg-popover border rounded-md shadow-lg z-50">
                <div className="p-3 border-b">
                  <h3 className="font-medium">Switch Tenant</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a different tenant environment
                  </p>
                </div>
                <div className="py-2">
                  {availableTenants.map((t) => (
                    <button
                      key={t.id}
                      className={clsx(
                        'w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center justify-between',
                        t.id === tenant.id && 'bg-accent text-accent-foreground'
                      )}
                      onClick={() => handleTenantSwitch(t.id)}
                    >
                      <div>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {t.subscriptionTier} • {t.region}
                        </div>
                      </div>
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          getStatusBadge(t.status)
                        )}
                      >
                        {t.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <Button
              variant="ghost"
              className="flex items-center space-x-2"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  {user.roles[0]}
                </div>
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>

            {/* User dropdown */}
            {isUserMenuOpen && (
              <div className="absolute right-0 top-12 w-56 bg-popover border rounded-md shadow-lg z-50">
                <div className="p-3 border-b">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {user.roles.map(role => (
                      <span
                        key={role}
                        className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="py-2">
                  <button className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  <button
                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside handlers */}
      {(isUserMenuOpen || isTenantMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsUserMenuOpen(false);
            setIsTenantMenuOpen(false);
          }}
        />
      )}
    </header>
  );
};