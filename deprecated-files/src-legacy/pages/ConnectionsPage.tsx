import React from 'react';
import { ArcherConnectionConfig } from '@/components/archer/ArcherConnectionConfig';
import type { ArcherCredentials } from '@/lib/credentialsApi';

export const ConnectionsPage: React.FC = () => {
  const handleConnectionChange = (connection: ArcherCredentials | null) => {
    console.log('Active connection changed:', connection);
    // Here you could update global state, notify other components, etc.
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <ArcherConnectionConfig 
        onConnectionChange={handleConnectionChange}
        className="max-w-7xl mx-auto"
      />
    </div>
  );
};