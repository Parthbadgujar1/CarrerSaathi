/**
 * First-party UTM attribution.
 * Campaign parameters from the landing URL are kept in sessionStorage only and
 * attached to the sign-up ONLY if the visitor accepted analytics cookies.
 * No third-party trackers are involved.
 */
import { safeStorage } from './storage';

const KEY = 'cs-utm';

export function captureUtm() {
  const params = new URLSearchParams(window.location.search);
  const utm = {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
  };
  if (!utm.utmSource && safeStorage.get(KEY, null, 'session')) return;
  const clean = Object.fromEntries(Object.entries(utm).filter(([, v]) => v).map(([k, v]) => [k, v.slice(0, 100)]));
  safeStorage.set(
    KEY,
    {
      ...clean,
      referrer: document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer.slice(0, 300) : undefined,
      landingPage: window.location.pathname.slice(0, 300),
    },
    'session',
  );
}

export function getUtm(analyticsAllowed) {
  if (!analyticsAllowed) return undefined;
  const v = safeStorage.get(KEY, null, 'session');
  return v && Object.keys(v).length ? v : undefined;
}
