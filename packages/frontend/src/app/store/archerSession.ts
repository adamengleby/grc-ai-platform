/**
 * Archer Session Store for MCP Tool Access
 * Manages Archer session data for MCP tool calls
 */

import { create } from 'zustand';

export interface ArcherSessionData {
  sessionId: string;
  expiresAt: Date;
  oauthToken?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    allowed_tools: string[];
  };
  userInfo: {
    username: string;
    instanceId: string;
    baseUrl: string;
  };
}

interface ArcherSessionState {
  session: ArcherSessionData | null;
  setSession: (session: ArcherSessionData | null) => void;
  clearSession: () => void;
  isValidSession: () => boolean;
  getArcherConnection: () => any | null;
}

export const useArcherSessionStore = create<ArcherSessionState>((set, get) => ({
  session: null,

  setSession: (session: ArcherSessionData | null) => {
    console.log('[Archer Session Store] Setting session:', session ? 'session provided' : 'session cleared');
    set({ session });
  },

  clearSession: () => {
    console.log('[Archer Session Store] Clearing session');
    set({ session: null });
  },

  isValidSession: () => {
    const state = get();
    if (!state.session) return false;
    return new Date() < new Date(state.session.expiresAt);
  },

  getArcherConnection: () => {
    const state = get();
    if (!state.session || !state.isValidSession()) {
      return null;
    }

    // Return archer_connection object expected by MCP server
    return {
      sessionId: state.session.sessionId,
      baseUrl: state.session.userInfo.baseUrl,
      instanceId: state.session.userInfo.instanceId,
      username: state.session.userInfo.username
    };
  },
}));

// Export helper function to get current Archer connection
export const getCurrentArcherConnection = (): any | null => {
  return useArcherSessionStore.getState().getArcherConnection();
};