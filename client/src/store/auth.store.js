import { create } from 'zustand';
import toast from 'react-hot-toast';
import { configureAuthHandlers, refreshSession, setAccessToken } from '../lib/http';
import { disconnectSocket } from '../lib/socket';
import { authService } from '../services/auth.service';
import { queryClient } from '../app/queryClient';

export const HOME_BY_ROLE = { student: '/app', mentor: '/mentor', admin: '/admin' };

export const useAuth = create((set, get) => ({
  user: null,
  status: 'loading', // 'loading' | 'authenticated' | 'guest'

  /** Restores the session from the httpOnly refresh cookie on page load. */
  async bootstrap() {
    try {
      await refreshSession(); // onTokenRefreshed sets the user
    } catch {
      set({ user: null, status: 'guest' });
    }
  },

  setSession(user, token) {
    setAccessToken(token);
    set({ user, status: 'authenticated' });
  },

  setUser(user) {
    set({ user });
  },

  async login(payload) {
    const res = await authService.login(payload);
    get().setSession(res.data.user, res.data.accessToken);
    return res;
  },

  async logout({ silent = false } = {}) {
    try {
      await authService.logout();
    } catch {
      /* even if the network fails, clear local state */
    }
    get().clear();
    if (!silent) toast.success('You have been signed out.');
  },

  clear() {
    setAccessToken(null);
    disconnectSocket();
    queryClient.clear();
    set({ user: null, status: 'guest' });
  },
}));

configureAuthHandlers({
  refreshed: (user) => useAuth.setState({ user, status: 'authenticated' }),
  expired: (message) => {
    const wasSignedIn = useAuth.getState().status === 'authenticated';
    useAuth.getState().clear();
    if (wasSignedIn) toast.error(message || 'Your session has ended. Please sign in again.', { id: 'session-expired' });
  },
});
