import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { useConsent } from '../../store/ui.store';
import { Button, Modal, Switch } from '../ui';

/**
 * Cookie consent with equal-weight "Accept" and "Reject" (no dark patterns),
 * granular settings, and a footer link to change the choice at any time.
 */
export function CookieBanner() {
  const { bannerOpen, acceptAll, rejectAll, openSettings } = useConsent();
  if (!bannerOpen) return null;
  return (
    <section className="cookie-banner" role="region" aria-label="Cookie consent">
      <h2 className="row" style={{ '--gap': '8px' }}>
        <Cookie size={18} aria-hidden="true" /> Your privacy choices
      </h2>
      <p>
        We use strictly necessary storage to keep you signed in and remember your settings. With your permission we also record
        which campaign link brought you here (first-party only — no ads, no third-party trackers). See our{' '}
        <Link to="/cookies">Cookie Policy</Link>.
      </p>
      <div className="cookie-actions">
        <Button onClick={rejectAll}>Reject optional</Button>
        <Button onClick={acceptAll}>Accept all</Button>
        <Button variant="ghost" size="sm" onClick={openSettings}>
          Customise
        </Button>
      </div>
    </section>
  );
}

export function CookieSettings() {
  const settingsOpen = useConsent((s) => s.settingsOpen);
  // Mount fresh each time so the switches reflect the latest saved choice.
  return settingsOpen ? <CookieSettingsDialog /> : null;
}

function CookieSettingsDialog() {
  const { closeSettings, consent, savePreferences } = useConsent();
  const [analytics, setAnalytics] = useState(consent?.analytics ?? false);
  return (
    <Modal
      open
      onClose={closeSettings}
      title="Cookie settings"
      footer={
        <>
          <Button onClick={closeSettings}>Cancel</Button>
          <Button variant="primary" onClick={() => savePreferences({ analytics })}>
            Save choices
          </Button>
        </>
      }
    >
      <div className="stack">
        <Switch
          label="Strictly necessary"
          description="Sign-in session (httpOnly cookie), security, your theme and these consent choices. Always on — the site cannot work without them."
          checked
          disabled
          onChange={() => {}}
        />
        <hr style={{ margin: 0 }} />
        <Switch
          label="Campaign attribution (analytics)"
          description="Remembers the campaign link (UTM) you arrived from for this browser session and attaches it to your sign-up so we know which outreach works. First-party only."
          checked={analytics}
          onChange={setAnalytics}
        />
        <p className="small muted mb-0">
          We do not use advertising cookies or third-party analytics. You can change this at any time from “Cookie settings” in the footer.
        </p>
      </div>
    </Modal>
  );
}
