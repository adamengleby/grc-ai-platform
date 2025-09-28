/**
 * OAuth Token Store for MCP Tool Access Control
 * Manages OAuth tokens received from Archer authentication
 */

import { create } from 'zustand';

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  allowed_tools: string[];
}

interface OAuthTokenState {
  token: OAuthToken | null;
  setToken: (token: OAuthToken | null) => void;
  clearToken: () => void;
  isValidToken: () => boolean;
  getAccessToken: () => string | null;
}

export const useOAuthTokenStore = create<OAuthTokenState>((set, get) => ({
  token: null,

  setToken: (token: OAuthToken | null) => {
    console.log('[OAuth Token Store] Setting token:', token ? 'token provided' : 'token cleared');
    set({ token });
  },

  clearToken: () => {
    console.log('[OAuth Token Store] Clearing token');
    set({ token: null });
  },

  isValidToken: () => {
    const state = get();
    return state.token !== null && state.token.access_token !== '';
  },

  getAccessToken: () => {
    const state = get();
    return state.token?.access_token || null;
  },
}));

// Export helper function to get current token
export const getCurrentOAuthToken = (): string | null => {
  return useOAuthTokenStore.getState().getAccessToken();
};