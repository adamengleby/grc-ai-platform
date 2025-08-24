// Debug tenant and auth state
// Run this in browser console

function debugTenantState() {
  console.log('🔍 Debugging tenant and auth state...');
  
  // Check all possible auth storage keys
  const allKeys = Object.keys(localStorage);
  const authKeys = allKeys.filter(key => 
    key.includes('auth') || 
    key.includes('tenant') || 
    key.includes('user')
  );
  
  console.log('Found auth-related keys:', authKeys);
  
  authKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      console.log(`\n${key}:`, JSON.parse(value));
    } catch (e) {
      console.log(`\n${key}:`, value);
    }
  });
  
  // Also check if there's a tenant in the page state
  console.log('\n🌐 Checking window/page state...');
  if (window.useAuthStore) {
    console.log('useAuthStore found:', window.useAuthStore.getState());
  }
  
  // Check if tenant is in any global variables
  console.log('\n🔍 Searching for tenant in global scope...');
  const globalTenantKeys = Object.keys(window).filter(key => 
    key.toLowerCase().includes('tenant') || 
    key.toLowerCase().includes('auth')
  );
  
  globalTenantKeys.forEach(key => {
    console.log(`window.${key}:`, window[key]);
  });
  
  // Try to find the React DevTools store
  console.log('\n⚛️ Looking for React state...');
  const reactFiberKey = Object.keys(document.querySelector('#root')).find(key => 
    key.startsWith('__reactInternalInstance') || 
    key.startsWith('_reactInternalFiber')
  );
  
  if (reactFiberKey) {
    console.log('React fiber found, but state inspection requires DevTools');
  }
}

debugTenantState();