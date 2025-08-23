import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useDashboardStore } from '@/store/dashboard';
import { Button } from '@/components/ui/Button';
import {
  LayoutDashboard,
  Users,
  FileText,
  Shield,
  Bot,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Brain,
  Link,
  Settings as SettingsIcon,
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  roles: string[];
  badge?: string;
  group?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Dashboard sidebar with role-based navigation
 * Adapts menu items based on user permissions and tenant settings
 */
export const DashboardSidebar: React.FC = () => {
  const { user, tenant } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useDashboardStore();
  const location = useLocation();

  if (!user || !tenant) return null;

  // Define navigation groups for better organization
  const navGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        {
          href: '/dashboard',
          icon: <LayoutDashboard className="h-5 w-5" />,
          label: 'Dashboard',
          roles: ['TenantOwner', 'AgentUser', 'Auditor', 'ComplianceOfficer'],
        },
      ]
    },
    {
      title: 'AI & Automation',
      items: [
        {
          href: '/agents',
          icon: <Bot className="h-5 w-5" />,
          label: 'AI Agents',
          roles: ['TenantOwner', 'AgentUser'],
        },
        {
          href: '/chat',
          icon: <MessageSquare className="h-5 w-5" />,
          label: 'GRC Chat',
          roles: ['TenantOwner', 'AgentUser'],
        },
        {
          href: '/ai-insights',
          icon: <Brain className="h-5 w-5" />,
          label: 'AI Insights',
          roles: ['TenantOwner', 'AgentUser', 'ComplianceOfficer'],
          badge: 'New',
        },
      ]
    },
    {
      title: 'Configuration',
      items: [
        {
          href: '/connections',
          icon: <Link className="h-5 w-5" />,
          label: 'Connections',
          roles: ['TenantOwner'],
        },
        {
          href: '/settings',
          icon: <SettingsIcon className="h-5 w-5" />,
          label: 'Settings',
          roles: ['TenantOwner'],
        },
      ]
    },
    {
      title: 'Administration',
      items: [
        {
          href: '/users',
          icon: <Users className="h-5 w-5" />,
          label: 'User Management',
          roles: ['TenantOwner'],
        },
        {
          href: '/audit',
          icon: <FileText className="h-5 w-5" />,
          label: 'Audit Trail',
          roles: ['TenantOwner', 'Auditor', 'ComplianceOfficer'],
        },
      ]
    }
  ];

  // Filter navigation groups and items based on user roles
  const allowedNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item =>
      item.roles.some(role => user.roles.includes(role as any))
    )
  })).filter(group => group.items.length > 0);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className={clsx(
      'fixed left-0 top-0 z-50 h-full bg-card border-r transition-all duration-300 flex flex-col',
      sidebarCollapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">GRC Platform</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {tenant.name}
                </p>
              </div>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="shrink-0"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Tenant info when collapsed */}
      {sidebarCollapsed && (
        <div className="p-2 border-b">
          <div className="flex justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {allowedNavGroups.map((group) => (
          <div key={group.title} className="mb-6 last:mb-0">
            {!sidebarCollapsed && (
              <h3 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </h3>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive: linkActive }) =>
                    clsx(
                      'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive(item.href) || linkActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                      sidebarCollapsed && 'justify-center px-2'
                    )
                  }
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

    </div>
  );
};