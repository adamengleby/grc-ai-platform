/**
 * Minimal Data Pipeline for Local Development
 */

import * as cron from 'node-cron';

console.log('🔄 GRC Data Pipeline starting...');

// Simple scheduled task for local development
cron.schedule('*/5 * * * *', () => {
  console.log('📊 Data pipeline tick - would process data here');
});

console.log('✅ Data pipeline running (processes every 5 minutes)');