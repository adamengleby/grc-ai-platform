import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';

export const ToolsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MCP Tools</h1>
        <p className="text-muted-foreground mt-2">
          Manage and test MCP tools and integrations
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Tool Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            MCP tools interface will be available here. This would include:
          </p>
          <ul className="mt-2 text-sm text-muted-foreground space-y-1">
            <li>• Browse available MCP tools</li>
            <li>• Test tool functionality</li>
            <li>• Configure tool parameters</li>
            <li>• Monitor tool usage</li>
            <li>• Manage tool permissions</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
