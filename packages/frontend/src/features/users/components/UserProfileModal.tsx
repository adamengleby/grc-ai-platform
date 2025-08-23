import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogBody 
} from '@/app/components/ui/Dialog';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { Badge } from '@/app/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Briefcase, 
  Shield, 
  Clock, 
  Settings
} from 'lucide-react';
import { UserWithMetadata } from '@/types/user';
import { formatDistanceToNow } from 'date-fns';

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithMetadata;
  onUserUpdated: (user: UserWithMetadata) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  open,
  onOpenChange,
  user,
  onUserUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    firstName: user.profile.firstName,
    lastName: user.profile.lastName,
    phoneNumber: user.profile.phoneNumber || '',
    department: user.profile.department || '',
    jobTitle: user.profile.jobTitle || '',
  });

  const handleSave = async () => {
    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedUser: UserWithMetadata = {
        ...user,
        name: formData.name,
        email: formData.email,
        profile: {
          ...user.profile,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          department: formData.department,
          jobTitle: formData.jobTitle,
        },
        updatedAt: new Date().toISOString(),
      };
      
      onUserUpdated(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user.name,
      email: user.email,
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
      phoneNumber: user.profile.phoneNumber || '',
      department: user.profile.department || '',
      jobTitle: user.profile.jobTitle || '',
    });
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center shadow-sm">
                {user.profile?.avatar ? (
                  <img 
                    src={user.profile.avatar} 
                    alt={user.name}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-blue-600" />
                )}
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold text-gray-900">{user.name}</DialogTitle>
                <p className="text-gray-600 font-medium">{user.email}</p>
                {user.profile?.jobTitle && (
                  <p className="text-sm text-gray-500">{user.profile.jobTitle}</p>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {user.roles.map((role) => (
                <Badge key={role} variant="secondary" className="text-xs font-medium px-3 py-1">
                  {role.replace(/([A-Z])/g, ' $1').trim()}
                </Badge>
              ))}
            </div>
          </div>
        </DialogHeader>
        
        <DialogBody className="py-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-3 text-lg font-semibold text-gray-900">
                    <User className="h-5 w-5 text-blue-600" />
                    <span>Profile Information</span>
                  </CardTitle>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all duration-200"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="department" className="text-sm font-medium text-gray-700">Department</Label>
                      <Input
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                        placeholder="IT, HR, Finance, etc."
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle" className="text-sm font-medium text-gray-700">Job Title</Label>
                      <Input
                        id="jobTitle"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                        placeholder="Senior Developer, Manager, etc."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 mb-1">Email Address</p>
                          <p className="text-sm text-gray-700">{user.email}</p>
                        </div>
                      </div>
                      
                      {user.profile.phoneNumber && (
                        <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Phone className="h-5 w-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900 mb-1">Phone Number</p>
                            <p className="text-sm text-gray-700">{user.profile.phoneNumber}</p>
                          </div>
                        </div>
                      )}
                      
                      {user.profile.department && (
                        <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Building className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900 mb-1">Department</p>
                            <p className="text-sm text-gray-700">{user.profile.department}</p>
                          </div>
                        </div>
                      )}
                      
                      {user.profile.jobTitle && (
                        <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <Briefcase className="h-5 w-5 text-orange-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900 mb-1">Job Title</p>
                            <p className="text-sm text-gray-700">{user.profile.jobTitle}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {isEditing && (
                  <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      className="px-6 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSubmitting}
                      className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-3 text-lg font-semibold text-gray-900">
                  <Shield className="h-5 w-5 text-green-600" />
                  <span>Account Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Account Status</span>
                  <Badge 
                    variant={user.isActive ? 'default' : 'destructive'} 
                    className="px-3 py-1 text-xs font-medium"
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Multi-Factor Authentication</span>
                  <Badge 
                    variant={user.mfaEnabled ? 'default' : 'outline'} 
                    className={`px-3 py-1 text-xs font-medium ${
                      user.mfaEnabled 
                        ? 'bg-green-100 text-green-800 border-green-200' 
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    }`}
                  >
                    {user.mfaEnabled ? 'Enabled' : 'Not Enabled'}
                  </Badge>
                </div>
                
                <div className="space-y-4 pt-2 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Clock className="h-4 w-4 text-gray-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Activity Timeline</span>
                  </div>
                  
                  <div className="text-sm space-y-3 ml-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Account Created</span>
                      <span className="font-medium text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Last Login</span>
                      <span className="font-medium text-gray-900">
                        {user.lastLogin ? formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true }) : 'Never'}
                      </span>
                    </div>
                    {user.lastActiveAt && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Last Activity</span>
                        <span className="font-medium text-gray-900">{formatDistanceToNow(new Date(user.lastActiveAt), { addSuffix: true })}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-3 text-lg font-semibold text-gray-900">
                  <Shield className="h-5 w-5 text-indigo-600" />
                  <span>Roles & Permissions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {user.roles.map((role, index) => (
                    <div key={role} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded-lg ${
                        index % 4 === 0 ? 'bg-blue-100' :
                        index % 4 === 1 ? 'bg-green-100' :
                        index % 4 === 2 ? 'bg-purple-100' : 'bg-orange-100'
                      }`}>
                        <Shield className={`h-4 w-4 ${
                          index % 4 === 0 ? 'text-blue-600' :
                          index % 4 === 1 ? 'text-green-600' :
                          index % 4 === 2 ? 'text-purple-600' : 'text-orange-600'
                        }`} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {role.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          </div>
        </DialogBody>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="px-6 hover:bg-gray-100 border-gray-300"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};