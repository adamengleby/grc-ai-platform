import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export const UsersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage tenant users, roles, and permissions
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Tenant User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            User management interface will be available here. This would include:
          </p>
          <ul className="mt-2 text-sm text-muted-foreground space-y-1">
            <li>• Invite and manage tenant users</li>
            <li>• Assign roles (Tenant Owner, Agent User, Auditor)</li>
            <li>• Configure user permissions</li>
            <li>• Monitor user activity</li>
            <li>• Manage user access to MCP tools</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};