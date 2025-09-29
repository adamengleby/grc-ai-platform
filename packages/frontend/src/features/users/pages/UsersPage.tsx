import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { UserPlus, Search, Shield } from 'lucide-react';
import { UserWithMetadata, UserRole } from '@/types/user';
// import { useAuthStore } from '@/app/store/auth';
import { UserTable } from '../components/UserTable';
import { UserProfileModal } from '../components/UserProfileModal';
import { InviteUserModal } from '../components/InviteUserModal';
import { RolePermissionsModal } from '../components/RolePermissionsModal';

const mockUsers: UserWithMetadata[] = [
  {
    id: '1',
    email: 'sarah.chen@acme.com',
    name: 'Sarah Chen',
    tenantId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    roles: ['TenantOwner'],
    lastLogin: '2024-01-15T10:30:00Z',
    isActive: true,
    mfaEnabled: true,
    createdAt: '2024-01-01T09:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    createdBy: 'system',
    lastActiveAt: '2024-01-15T14:30:00Z',
    profile: {
      firstName: 'Sarah',
      lastName: 'Chen',
      phoneNumber: '+1-555-0123',
      department: 'IT Security',
      jobTitle: 'Chief Information Security Officer',
      preferences: {
        theme: 'dark',
        language: 'en',
        timezone: 'America/New_York',
        notifications: {
          email: true,
          inApp: true,
          riskAlerts: true,
          complianceUpdates: true,
          auditReports: true
        }
      }
    },
    permissions: {
      role: 'TenantOwner',
      customPermissions: [],
      restrictions: []
    },
    auditHistory: []
  },
  {
    id: '2',
    email: 'mike.johnson@acme.com',
    name: 'Mike Johnson',
    tenantId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    roles: ['AgentUser'],
    lastLogin: '2024-01-14T16:45:00Z',
    isActive: true,
    mfaEnabled: false,
    createdAt: '2024-01-02T11:00:00Z',
    updatedAt: '2024-01-14T16:45:00Z',
    createdBy: '1',
    lastActiveAt: '2024-01-14T18:00:00Z',
    profile: {
      firstName: 'Mike',
      lastName: 'Johnson',
      department: 'Risk Management',
      jobTitle: 'Risk Analyst',
      preferences: {
        theme: 'light',
        language: 'en',
        timezone: 'America/Chicago',
        notifications: {
          email: true,
          inApp: false,
          riskAlerts: true,
          complianceUpdates: false,
          auditReports: false
        }
      }
    },
    permissions: {
      role: 'AgentUser',
      customPermissions: [],
      restrictions: []
    },
    auditHistory: []
  },
  {
    id: '3',
    email: 'emma.davis@acme.com',
    name: 'Emma Davis',
    tenantId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    roles: ['Auditor', 'ComplianceOfficer'],
    lastLogin: '2024-01-13T09:15:00Z',
    isActive: true,
    mfaEnabled: true,
    createdAt: '2024-01-03T14:30:00Z',
    updatedAt: '2024-01-13T09:15:00Z',
    createdBy: '1',
    lastActiveAt: '2024-01-13T17:30:00Z',
    profile: {
      firstName: 'Emma',
      lastName: 'Davis',
      department: 'Legal & Compliance',
      jobTitle: 'Compliance Manager',
      preferences: {
        theme: 'system',
        language: 'en',
        timezone: 'America/New_York',
        notifications: {
          email: true,
          inApp: true,
          riskAlerts: false,
          complianceUpdates: true,
          auditReports: true
        }
      }
    },
    permissions: {
      role: 'ComplianceOfficer',
      customPermissions: [],
      restrictions: []
    },
    auditHistory: []
  },
  {
    id: '4',
    email: 'inactive.user@acme.com',
    name: 'John Smith',
    tenantId: 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d',
    roles: ['AgentUser'],
    lastLogin: '2023-12-20T10:00:00Z',
    isActive: false,
    mfaEnabled: false,
    createdAt: '2023-11-15T10:00:00Z',
    updatedAt: '2023-12-20T10:00:00Z',
    createdBy: '1',
    profile: {
      firstName: 'John',
      lastName: 'Smith',
      department: 'Operations',
      jobTitle: 'Operations Analyst',
      preferences: {
        theme: 'light',
        language: 'en',
        timezone: 'America/Los_Angeles',
        notifications: {
          email: false,
          inApp: false,
          riskAlerts: false,
          complianceUpdates: false,
          auditReports: false
        }
      }
    },
    permissions: {
      role: 'AgentUser',
      customPermissions: [],
      restrictions: []
    },
    auditHistory: []
  }
];

export const UsersPage: React.FC = () => {
  // const { tenant } = useAuthStore();
  const [users, setUsers] = useState<UserWithMetadata[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithMetadata | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.roles.includes(roleFilter);
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && u.isActive) || 
                         (statusFilter === 'inactive' && !u.isActive);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const userStats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    mfaEnabled: users.filter(u => u.mfaEnabled).length,
  };

  const roleStats = {
    TenantOwner: users.filter(u => u.roles.includes('TenantOwner')).length,
    AgentUser: users.filter(u => u.roles.includes('AgentUser')).length,
    Auditor: users.filter(u => u.roles.includes('Auditor')).length,
    ComplianceOfficer: users.filter(u => u.roles.includes('ComplianceOfficer')).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage tenant users and their permissions
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{userStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <div>
                <p className="text-2xl font-bold">{userStats.active}</p>
                <p className="text-xs text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div>
                <p className="text-2xl font-bold">{userStats.inactive}</p>
                <p className="text-xs text-muted-foreground">Inactive Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{userStats.mfaEnabled}</p>
                <p className="text-xs text-muted-foreground">MFA Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Role Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(roleStats).map(([role, count]) => (
              <div key={role} className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {role.replace(/([A-Z])/g, ' $1').trim()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                className="px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Roles</option>
                <option value="TenantOwner">Tenant Owner</option>
                <option value="AgentUser">Agent User</option>
                <option value="Auditor">Auditor</option>
                <option value="ComplianceOfficer">Compliance Officer</option>
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Table */}
      <UserTable 
        users={filteredUsers}
        onUserSelect={setSelectedUser}
        onEditProfile={(user) => {
          setSelectedUser(user);
          setShowProfileModal(true);
        }}
        onManageRoles={(user) => {
          setSelectedUser(user);
          setShowRoleModal(true);
        }}
      />

      {/* Modals */}
      {showInviteModal && (
        <InviteUserModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          onInviteSent={(invitation) => {
            // Handle invitation sent
            console.log('Invitation sent:', invitation);
          }}
        />
      )}

      {showProfileModal && selectedUser && (
        <UserProfileModal
          open={showProfileModal}
          onOpenChange={setShowProfileModal}
          user={selectedUser}
          onUserUpdated={(updatedUser) => {
            setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
          }}
        />
      )}

      {showRoleModal && selectedUser && (
        <RolePermissionsModal
          open={showRoleModal}
          onOpenChange={setShowRoleModal}
          user={selectedUser}
          onUserUpdated={(updatedUser) => {
            setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
          }}
        />
      )}
    </div>
  );
};
