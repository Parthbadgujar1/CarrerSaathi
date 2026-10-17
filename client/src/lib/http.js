/**
 * HTTP client.
 * - Access token lives only in memory (never localStorage → safe from XSS theft).
 * - The refresh token is an httpOnly cookie; on 401 TOKEN_EXPIRED we refresh once
 *   (shared across concurrent requests) and replay the original request.
 * - Errors are normalised so UI code can show friendly messages and field errors.
 */
import axios from 'axios';

let accessToken = null;
let refreshPromise = null;
let onSessionExpired = () => {};
let onTokenRefreshed = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const configureAuthHandlers = ({ expired, refreshed }) => {
  if (expired) onSessionExpired = expired;
  if (refreshed) onTokenRefreshed = refreshed;
};

export const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 30_000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/v1/auth/refresh', null, { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' }, timeout: 15_000 })
      .then((res) => {
        if (res.status === 204 || !res.data?.data) throw Object.assign(new Error('No active session'), { code: 'NO_SESSION' });
        const { accessToken: token, user } = res.data.data;
        setAccessToken(token);
        onTokenRefreshed(user, token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const REFRESHABLE = new Set(['TOKEN_EXPIRED', 'TOKEN_INVALID']);
const SESSION_ENDED = new Set(['SESSION_REVOKED', 'PASSWORD_CHANGED', 'ACCOUNT_INACTIVE', 'REFRESH_INVALID', 'REFRESH_REUSED', 'NO_SESSION']);

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    if (status === 401 && REFRESHABLE.has(code) && !original._retried && !original.url?.includes('/auth/')) {
      original._retried = true;
      try {
        await refreshSession();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return http(original);
      } catch (refreshErr) {
        setAccessToken(null);
        onSessionExpired('Your session has expired. Please sign in again.');
        return Promise.reject(refreshErr);
      }
    }
    if (status === 401 && SESSION_ENDED.has(code) && accessToken) {
      setAccessToken(null);
      onSessionExpired(error.response.data.error.message);
    }
    return Promise.reject(error);
  },
);

/** Human-friendly message for any error thrown by the API layer. */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (err.code === 'ECONNABORTED') return 'The request timed out. Please check your connection and retry.';
  if (!err.response) return navigator.onLine === false ? 'You appear to be offline. Please reconnect and try again.' : 'Cannot reach the server right now. Please try again shortly.';
  return err.response.data?.error?.message || err.response.data?.message || fallback;
}

/** Field-level validation errors as { "education.college": "message" }. */
export function getFieldErrors(err) {
  const details = err?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return details.reduce((acc, d) => {
    if (d.field && !acc[d.field]) acc[d.field] = d.message;
    return acc;
  }, {});
}

export const unwrap = (promise) => promise.then((res) => res.data);
