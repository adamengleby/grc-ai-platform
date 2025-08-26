/**
 * Analytics Page - Main page component for the analytics dashboard
 */

import React from 'react';
import { RealTimeDashboard } from '../components/RealTimeDashboard';

export const AnalyticsPage: React.FC = () => {
  return (
    <div>
      {/* Force update - remove this comment after testing */}
      <RealTimeDashboard />
    </div>
  );
};