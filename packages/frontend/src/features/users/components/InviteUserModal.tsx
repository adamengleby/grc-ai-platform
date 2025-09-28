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
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { UserPlus } from 'lucide-react';
import { UserRole, UserInvitation } from '@/types/user';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent: (invitation: UserInvitation) => void;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  open,
  onOpenChange,
  onInviteSent,
}) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'AgentUser' as UserRole,
    department: '',
    jobTitle: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const invitation: UserInvitation = {
        id: `inv_${Date.now()}`,
        email: formData.email,
        role: formData.role,
        invitedBy: 'current-user-id',
        invitedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        message: formData.message || undefined
      };
      
      onInviteSent(invitation);
      onOpenChange(false);
      
      // Reset form
      setFormData({
        email: '',
        name: '',
        role: 'AgentUser',
        department: '',
        jobTitle: '',
        message: ''
      });
    } catch (error) {
      console.error('Failed to send invitation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = [
    { value: 'AgentUser', label: 'Agent User' },
    { value: 'Auditor', label: 'Auditor' },
    { value: 'ComplianceOfficer', label: 'Compliance Officer' },
    { value: 'TenantOwner', label: 'Tenant Owner' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <DialogTitle>Invite New User</DialogTitle>
          </div>
          <DialogDescription>
            Send an invitation to add a new user to your tenant.
          </DialogDescription>
        </DialogHeader>
        
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.com"
                className="mt-2"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Smith"
                className="mt-2"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">Role</Label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                className="mt-2 w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <Label htmlFor="department" className="text-sm font-medium text-gray-700">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="IT, Legal, Operations..."
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="jobTitle" className="text-sm font-medium text-gray-700">Job Title</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                placeholder="Risk Analyst, Compliance Manager..."
                className="mt-2"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="message" className="text-sm font-medium text-gray-700">Personal Message (Optional)</Label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Add a personal welcome message..."
              rows={3}
              className="mt-2 w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          </form>
        </DialogBody>
        
        <DialogFooter className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};