import React from 'react';
import { Card, CardContent } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { 
  User, 
  Mail, 
  Clock, 
  Shield, 
  MoreHorizontal, 
  Edit,
  Lock,
  Unlock
} from 'lucide-react';
import { UserWithMetadata, UserRole } from '@/types/user';
import { formatDistanceToNow } from 'date-fns';

interface UserTableProps {
  users: UserWithMetadata[];
  onUserSelect: (user: UserWithMetadata) => void;
  onEditProfile: (user: UserWithMetadata) => void;
  onManageRoles: (user: UserWithMetadata) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  onUserSelect,
  onEditProfile,
  onManageRoles,
}) => {
  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'TenantOwner':
        return 'default';
      case 'AgentUser':
        return 'secondary';
      case 'Auditor':
        return 'outline';
      case 'ComplianceOfficer':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatRoleName = (role: UserRole) => {
    switch (role) {
      case 'TenantOwner':
        return 'Tenant Owner';
      case 'AgentUser':
        return 'Agent User';
      case 'ComplianceOfficer':
        return 'Compliance Officer';
      default:
        return role;
    }
  };

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No users found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search criteria or filters.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr className="border-b border-gray-200">
                <th className="text-left p-4 font-semibold text-gray-900 text-sm">User</th>
                <th className="text-left p-4 font-semibold text-gray-900 text-sm">Roles</th>
                <th className="text-left p-4 font-semibold text-gray-900 text-sm">Department</th>
                <th className="text-left p-4 font-semibold text-gray-900 text-sm">Status</th>
                <th className="text-left p-4 font-semibold text-gray-900 text-sm">Last Login</th>
                <th className="text-left p-4 font-semibold text-gray-900 text-sm">Security</th>
                <th className="text-center p-4 font-semibold text-gray-900 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr 
                  key={user.id} 
                  className="border-b border-gray-100 hover:bg-gray-50/80 transition-all duration-200 cursor-pointer group"
                  onClick={() => onUserSelect(user)}
                >
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center shadow-sm">
                        {user.profile?.avatar ? (
                          <img 
                            src={user.profile.avatar} 
                            alt={user.name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-6 w-6 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 truncate">{user.name}</div>
                        <div className="text-sm text-gray-600 flex items-center">
                          <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        {user.profile?.jobTitle && (
                          <div className="text-xs text-gray-500 truncate">
                            {user.profile.jobTitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge 
                          key={role} 
                          variant={getRoleBadgeVariant(role)}
                          className="text-xs"
                        >
                          {formatRoleName(role)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="text-sm">
                      {user.profile?.department || 'Not specified'}
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <div className={`h-3 w-3 rounded-full ${
                        user.isActive ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <Badge 
                        variant={user.isActive ? 'default' : 'secondary'}
                        className={`text-xs font-medium ${
                          user.isActive 
                            ? 'bg-green-100 text-green-800 border-green-200' 
                            : 'bg-gray-100 text-gray-800 border-gray-200'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-700">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        {user.lastLogin ? 
                          formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true }) :
                          'Never logged in'
                        }
                      </div>
                      {user.lastActiveAt && (
                        <div className="text-xs text-gray-500 ml-6">
                          Active: {formatDistanceToNow(new Date(user.lastActiveAt), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      {user.mfaEnabled ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">
                          <Lock className="h-3 w-3 mr-1" />
                          MFA Enabled
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs font-medium">
                          <Unlock className="h-3 w-3 mr-1" />
                          MFA Required
                        </Badge>
                      )}
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditProfile(user);
                        }}
                        className="h-10 w-10 p-0 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 rounded-lg"
                        title="Edit Profile"
                      >
                        <Edit className="h-5 w-5 text-blue-500" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onManageRoles(user);
                        }}
                        className="h-10 w-10 p-0 hover:bg-green-50 hover:text-green-600 transition-all duration-200 rounded-lg"
                        title="Manage Roles"
                      >
                        <Shield className="h-5 w-5 text-green-500" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle more options
                        }}
                        className="h-10 w-10 p-0 hover:bg-gray-50 hover:text-gray-600 transition-all duration-200 rounded-lg"
                        title="More Options"
                      >
                        <MoreHorizontal className="h-5 w-5 text-gray-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};