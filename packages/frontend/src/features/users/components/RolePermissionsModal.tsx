import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogBody 
} from '@/app/components/ui/Dialog';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Shield, Check, AlertTriangle } from 'lucide-react';
import { UserWithMetadata, UserRole } from '@/types/user';

interface RolePermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithMetadata;
  onUserUpdated: (user: UserWithMetadata) => void;
}

const roleDefinitions = [
  {
    name: 'TenantOwner' as UserRole,
    displayName: 'Tenant Owner',
    description: 'Full tenant management access with administrative privileges',
    color: 'text-red-600 bg-red-50 border-red-200'
  },
  {
    name: 'AgentUser' as UserRole,
    displayName: 'Agent User',
    description: 'Operational dashboard access with AI agent interaction capabilities',
    color: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  {
    name: 'Auditor' as UserRole,
    displayName: 'Auditor',
    description: 'Read-only audit access for compliance and security review',
    color: 'text-green-600 bg-green-50 border-green-200'
  },
  {
    name: 'ComplianceOfficer' as UserRole,
    displayName: 'Compliance Officer',
    description: 'Compliance-specific views with approval and oversight capabilities',
    color: 'text-purple-600 bg-purple-50 border-purple-200'
  }
];

export const RolePermissionsModal: React.FC<RolePermissionsModalProps> = ({
  open,
  onOpenChange,
  user,
  onUserUpdated,
}) => {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(user.roles);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleToggle = (role: UserRole) => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedUser: UserWithMetadata = {
        ...user,
        roles: selectedRoles,
        updatedAt: new Date().toISOString(),
      };
      
      onUserUpdated(updatedUser);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update user roles:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges = JSON.stringify(selectedRoles.sort()) !== JSON.stringify(user.roles.sort());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <DialogTitle>Manage Roles & Permissions</DialogTitle>
              <DialogDescription>
                Configure roles and permissions for {user.name} ({user.email})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <DialogBody>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Available Roles</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {roleDefinitions.map((role) => {
                const isSelected = selectedRoles.includes(role.name);
                const isCurrentRole = user.roles.includes(role.name);
                
                return (
                  <Card 
                    key={role.name} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleRoleToggle(role.name)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-lg ${role.color}`}>
                            <Shield className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-base flex items-center space-x-2">
                              <span>{role.displayName}</span>
                              {isCurrentRole && (
                                <Badge variant="outline" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {role.description}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {isSelected && (
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
          
          {selectedRoles.includes('TenantOwner') && !user.roles.includes('TenantOwner') && (
              <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-4">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-800">
                      Warning: High Privilege Role
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      You are about to assign the Tenant Owner role, which grants full administrative access.
                    </p>
                  </div>
                </div>
              </div>
            )}
          
          {selectedRoles.length > 0 && (
              <div className="p-6 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-semibold mb-3">Selected Roles:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedRoles.map((role) => {
                  const roleDef = roleDefinitions.find(r => r.name === role);
                  return (
                    <Badge key={role} variant="secondary" className="flex items-center space-x-1">
                      <Shield className="h-3 w-3" />
                      <span>{roleDef?.displayName || role}</span>
                    </Badge>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        </DialogBody>
        
        <DialogFooter className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedRoles(user.roles);
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSubmitting}
          >
            {isSubmitting ? 'Updating...' : 'Update Roles'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};