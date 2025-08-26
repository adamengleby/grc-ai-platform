// Zustand store for authentication and tenant state management
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { AzureB2CToken, User, Tenant, TenantContext, Permission } from '@/types/tenant';
import { authService } from '@/lib/auth';

// Debounce timer for auth operations
let authDebounceTimer: NodeJS.Timeout | null = null;

interface AuthState {
  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean; // Track if auth has been initialized
  token: AzureB2CToken | null;
  user: User | null;
  tenant: Tenant | null;
  availableTenants: Tenant[];
  error: string | null;

  // Actions
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
  initializeAuth: () => void; // New method for initial auth check
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector((set, get) => ({
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false, // Track initialization state
    token: null,
    user: null,
    tenant: null,
    availableTenants: [],
    error: null,

    login: async (email: string) => {
      console.log('Auth store: Starting login process for', email);
      set({ isLoading: true, error: null });
      
      try {
        const { token, user, tenant } = await authService.login(email);
        const availableTenants = await authService.getAvailableTenants();
        
        console.log('Auth store: Login successful', { user: user.name, tenant: tenant.name });
        set({
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          token,
          user,
          tenant,
          availableTenants,
          error: null,
        });
      } catch (error) {
        console.error('Auth store: Login failed', error);
        set({
          isAuthenticated: false,
          isLoading: false,
          token: null,
          user: null,
          tenant: null,
          error: error instanceof Error ? error.message : 'Login failed',
        });
      }
    },

    logout: async () => {
      set({ isLoading: true });
      
      try {
        // Clear all chat sessions before logout
        const currentState = get();
        if (currentState.tenant?.id) {
          try {
            // Get all keys that match our chat pattern
            const chatKeys = Object.keys(localStorage).filter(key => 
              key.startsWith(`chat_session_${currentState.tenant!.id}_`)
            );
            
            // Remove all chat sessions for this tenant
            chatKeys.forEach(key => localStorage.removeItem(key));
            
            console.log(`Cleared ${chatKeys.length} chat sessions on logout for tenant ${currentState.tenant!.id}`);
          } catch (error) {
            console.warn('Failed to clear chat sessions on logout:', error);
          }
        }
        
        // Also clear global chat state
        try {
          if (currentState.tenant?.id) {
            localStorage.removeItem(`chat_session_${currentState.tenant.id}_global`);
          }
        } catch (error) {
          console.warn('Failed to clear global chat state on logout:', error);
        }
        
        await authService.logout();
        set({
          isAuthenticated: false,
          isLoading: false,
          isInitialized: false, // Reset initialization on logout
          token: null,
          user: null,
          tenant: null,
          availableTenants: [],
          error: null,
        });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Logout failed',
        });
      }
    },

    switchTenant: async (tenantId: string) => {
      set({ isLoading: true, error: null });
      
      try {
        const tenant = await authService.switchTenant(tenantId);
        set({
          tenant,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to switch tenant',
        });
      }
    },

    // Initialize auth without setting loading state to prevent cycling
    initializeAuth: () => {
      const state = get();
      
      // Only initialize once
      if (state.isInitialized) {
        return;
      }
      
      console.log('Auth store: Initializing authentication state');
      
      try {
        const isAuth = authService.isAuthenticated();
        const token = authService.getCurrentToken();
        const user = authService.getCurrentUser();
        const tenant = authService.getCurrentTenant();
        
        console.log('Auth store: Initial auth check results', { isAuth, hasToken: !!token, hasUser: !!user, hasTenant: !!tenant });
        
        if (isAuth && token && user && tenant) {
          console.log('Auth store: Restoring authenticated state on init', { user: user.name, tenant: tenant.name });
          set({
            isAuthenticated: true,
            isInitialized: true,
            token,
            user,
            tenant,
            availableTenants: [tenant], // Start with current tenant, load others async if needed
            error: null,
          });
        } else {
          console.log('Auth store: No valid authentication found on init');
          set({
            isAuthenticated: false,
            isInitialized: true,
            token: null,
            user: null,
            tenant: null,
            availableTenants: [],
            error: null,
          });
        }
      } catch (error) {
        console.error('Auth store: Error during initialization', error);
        set({
          isAuthenticated: false,
          isInitialized: true,
          token: null,
          user: null,
          tenant: null,
          availableTenants: [],
          error: error instanceof Error ? error.message : 'Authentication initialization failed',
        });
      }
    },

    refreshAuth: async () => {
      const state = get();
      
      // Prevent multiple simultaneous refresh calls
      if (state.isLoading) {
        console.log('Auth store: Refresh already in progress, skipping');
        return;
      }

      // Clear previous debounce timer
      if (authDebounceTimer) {
        clearTimeout(authDebounceTimer);
      }

      // Debounce auth refresh to prevent rapid calls
      return new Promise<void>((resolve) => {
        authDebounceTimer = setTimeout(async () => {
          console.log('Auth store: Refreshing authentication state');
          set({ isLoading: true });
          
          try {
            const isAuth = authService.isAuthenticated();
            const token = authService.getCurrentToken();
            const user = authService.getCurrentUser();
            const tenant = authService.getCurrentTenant();
            
            console.log('Auth store: Auth check results', { isAuth, hasToken: !!token, hasUser: !!user, hasTenant: !!tenant });
            
            if (isAuth && token && user && tenant) {
              const availableTenants = await authService.getAvailableTenants();
              console.log('Auth store: Restoring authenticated state', { user: user.name, tenant: tenant.name });
              set({
                isAuthenticated: true,
                isLoading: false,
                isInitialized: true,
                token,
                user,
                tenant,
                availableTenants,
                error: null,
              });
            } else {
              // No valid auth - just set to unauthenticated state without clearing localStorage
              console.log('Auth store: No valid authentication found');
              set({
                isAuthenticated: false,
                isLoading: false,
                isInitialized: true,
                token: null,
                user: null,
                tenant: null,
                availableTenants: [],
                error: null,
              });
            }
          } catch (error) {
            console.error('Auth store: Error during refresh', error);
            set({
              isAuthenticated: false,
              isLoading: false,
              isInitialized: true,
              token: null,
              user: null,
              tenant: null,
              availableTenants: [],
              error: error instanceof Error ? error.message : 'Authentication refresh failed',
            });
          }
          resolve();
        }, 300); // 300ms debounce
      });
    },

    clearError: () => set({ error: null }),
  }))
);

// Helper hook to get tenant context
export const useTenantContext = (): TenantContext | null => {
  const { tenant, user, switchTenant } = useAuthStore();
  
  if (!tenant || !user) return null;

  // Generate permissions based on user roles
  const permissions = user.roles.flatMap((role): Permission[] => {
    switch (role) {
      case 'PlatformOwner':
        return [
          { resource: '*', actions: ['read', 'write', 'delete', 'admin'] },
          { resource: 'cross-tenant', actions: ['read', 'write', 'delete', 'admin'] },
        ];
      case 'TenantOwner':
        return [
          { resource: '*', actions: ['read', 'write', 'delete', 'admin'] },
        ];
      case 'AgentUser':
        return [
          { resource: 'dashboard', actions: ['read'] },
          { resource: 'agents', actions: ['read', 'write'] },
          { resource: 'mcp-tools', actions: ['read', 'write'] },
        ];
      case 'Auditor':
      case 'ComplianceOfficer':
        return [
          { resource: 'audit', actions: ['read'] },
          { resource: 'compliance', actions: ['read'] },
          { resource: 'reports', actions: ['read'] },
        ];
      default:
        return [];
    }
  });

  return {
    tenant,
    user,
    permissions,
    switchTenant,
  };
};

// Subscribe to auth changes for side effects
useAuthStore.subscribe(
  (state) => state.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      // Clear any cached data when user logs out
      console.log('User logged out, clearing cached data');
    }
  }
);