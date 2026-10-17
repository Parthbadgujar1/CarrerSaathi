import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useDocumentTitle } from '../../hooks';
import { SITE } from '../../config/site';
import { useConsent } from '../../store/ui.store';
import { Button } from '../../components/ui';
import { LastUpdated } from '../../components/common/SiteChrome';

function LegalPage({ title, intro, children }) {
  useDocumentTitle(title);
  return (
    <div className="container">
      <header className="page-head">
        <div className="row-between">
          <h1 className="mb-0">{title}</h1>
          <Button icon={Printer} onClick={() => window.print()} className="no-print">
            Print
          </Button>
        </div>
        <div className="mt-1">
          <LastUpdated date={SITE.legalUpdated} />
        </div>
        {intro && <p className="muted mt-2" style={{ maxWidth: 760 }}>{intro}</p>}
      </header>
      <article className="prose">{children}</article>
    </div>
  );
}

const Contact = () => (
  <>
    {SITE.company}
    {SITE.address ? `, ${SITE.address}` : ''}
    {SITE.email && (
      <>
        {' '}· <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
      </>
    )}
    {SITE.phone && <> · {SITE.phone}</>}
  </>
);

export function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This policy explains what personal data ${SITE.name} collects, why, how long we keep it and the choices you have. We follow the principles of India's Digital Personal Data Protection Act, 2023: collect only what is needed, use it only for stated purposes, keep it secure and respect your rights.`}
    >
      <h2>1. Who we are</h2>
      <p>
        {SITE.name} is operated by <Contact />. For any privacy question or request, contact us using the details above
        {SITE.grievanceOfficer ? ` or our Grievance Officer, ${SITE.grievanceOfficer}` : ''}.
      </p>

      <h2>2. What we collect</h2>
      <table>
        <thead>
          <tr><th>Data</th><th>Why we need it</th></tr>
        </thead>
        <tbody>
          <tr><td>Name, email, password (stored only as a secure hash)</td><td>To create and secure your account and contact you about it.</td></tr>
          <tr><td>Phone (optional), college, degree, branch, graduation year</td><td>To personalise roadmaps and opportunities, and so your institution's programme admins can maintain student records.</td></tr>
          <tr><td>Address, CGPA, skills, links (optional)</td><td>Only if you add them — for your resume and profile.</td></tr>
          <tr><td>Roadmap progress, career-kit checklist, applications you track</td><td>To calculate your readiness score and show your progress.</td></tr>
          <tr><td>Wellness check-ins and private journal</td><td>For your own wellbeing tracking. Journal entries are encrypted. Mentors see only averages, and only if you enable sharing.</td></tr>
          <tr><td>Messages in chats and communities</td><td>To deliver conversations with mentors and peers.</td></tr>
          <tr><td>Questions you ask the AI assistant or planner</td><td>To generate answers. See “AI providers” below.</td></tr>
          <tr><td>Campaign source (UTM) — only with your consent</td><td>To understand which outreach helps students find us.</td></tr>
          <tr><td>Security logs (login times, truncated IP, device type)</td><td>To protect your account and show you your active devices.</td></tr>
        </tbody>
      </table>
      <p>We do not collect sensitive data such as Aadhaar, financial details, caste, religion or health records, and we never ask for payment.</p>

      <h2>3. Who can see your data</h2>
      <ul>
        <li><strong>Programme admins</strong> can view and export student registration and progress records (name, contact, education, address fields you provided, progress) to run the programme.</li>
        <li><strong>Mentors</strong> see a reduced profile (no phone, email or address) and progress. Mentors you are connected with can see your links and, only if you allow it, a wellness summary.</li>
        <li><strong>Other students</strong> see only your name and the messages you post in communities.</li>
        <li>We <strong>never sell</strong> your data or use it for advertising.</li>
      </ul>

      <h2>4. Service providers</h2>
      <ul>
        <li><strong>Hosting & database</strong> — our servers and database provider store platform data.</li>
        <li><strong>Email</strong> — our email provider delivers account and notification emails.</li>
        <li><strong>AI providers</strong> (Groq, Google Gemini, OpenAI — whichever is configured) receive only the text needed to answer: the fields, goal and question you type, plus your degree and career tracks. We do not send your name, email or phone. Many requests are answered from our own cache or curated library without contacting any AI provider.</li>
        <li><strong>Video sessions</strong> use Jitsi Meet. When you join a session, your browser connects to the Jitsi service and the display name you choose is visible to participants.</li>
      </ul>

      <h2>5. How long we keep data</h2>
      <ul>
        <li>Account data: until you delete your account (with a 7-day grace period).</li>
        <li>Notifications: 90 days. AI usage logs: 90 days. Email delivery logs: 30 days.</li>
        <li>Contact-form messages and admin audit logs: 12 months.</li>
      </ul>

      <h2>6. Security</h2>
      <p>
        Passwords are hashed with bcrypt; sessions use short-lived tokens and secure httpOnly cookies with rotation; journal entries are encrypted
        at rest (AES-256-GCM); all inputs are validated; and access is limited by role. No system is perfectly secure, so please use a strong,
        unique password.
      </p>

      <h2 id="your-rights">7. Your rights and choices</h2>
      <ul>
        <li><strong>Access & portability:</strong> download all your data from Profile → Settings → “Download my data”.</li>
        <li><strong>Correction:</strong> edit your profile at any time.</li>
        <li><strong>Erasure:</strong> request deletion from Profile → Settings → “Delete account”. Data is permanently erased after 7 days; signing in before then cancels the request. You can also <Link to="/contact">contact us</Link>.</li>
        <li><strong>Withdraw consent:</strong> turn off announcement emails (or use the unsubscribe link in any announcement), wellness sharing, or analytics cookies at any time.</li>
        <li><strong>Grievances:</strong> contact us; we aim to respond within 7 working days.</li>
      </ul>

      <h2>8. Children</h2>
      <p>{SITE.name} is designed for students who have completed Class 12. If you are under 18, please use the platform only with the consent and guidance of a parent or guardian.</p>

      <h2>9. Changes</h2>
      <p>We will post changes here and update the “Last updated” date. For significant changes we will notify signed-in users.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service" intro={`These terms govern your use of ${SITE.name}. By creating an account you agree to them. Please read them — they are short and written in plain language.`}>
      <h2>1. The service</h2>
      <p>
        {SITE.name}, operated by <Contact />, provides career roadmaps, readiness tools, mentorship, communities, opportunity listings, live
        sessions and wellbeing tools. Student features are free of charge. There are no hidden fees.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Provide accurate information and keep your password confidential. You are responsible for activity on your account.</li>
        <li>One account per person. Mentor accounts require approval by an admin.</li>
        <li>Tell us immediately if you suspect unauthorised access.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>harass, bully, discriminate against or threaten anyone; share hateful, sexual or violent content;</li>
        <li>post spam, scams, fake opportunities or anything that asks students for money or personal documents;</li>
        <li>impersonate others, scrape the platform, attempt to break its security or overload it;</li>
        <li>share others' personal data without permission.</li>
      </ul>
      <p>We may remove content and suspend accounts that break these rules.</p>

      <h2>4. Guidance, not guarantees</h2>
      <p>
        Roadmaps, AI answers, readiness scores and mentor advice are guidance to help you plan. They are not guarantees of admission, employment
        or salary. AI-generated content can be inaccurate — verify important decisions. The wellbeing tools are not medical care; if you are in
        distress, contact Tele-MANAS (14416) or emergency services (112).
      </p>

      <h2>5. Third-party opportunities and links</h2>
      <p>
        Opportunities may link to external sites (for example the Skill NexGen family portals — Skill NexGen, KaushalSaathi, InternSaathi and NaukriSaathi — or job sites such as Unstop and Indeed). Those sites have their
        own terms. Never pay any fee to apply for a job or internship, and report suspicious listings to us.
      </p>

      <h2>6. Your content</h2>
      <p>You own what you post. You allow us to store and display it within the platform to provide the service. You can delete your messages and account.</p>

      <h2>7. Availability</h2>
      <p>We work hard to keep the platform available and secure, but it is provided “as is”. We may change or discontinue features with reasonable notice.</p>

      <h2>8. Liability</h2>
      <p>To the extent permitted by law, {SITE.company} is not liable for indirect losses arising from use of the platform or third-party sites.</p>

      <h2>9. Governing law</h2>
      <p>These terms are governed by the laws of India. Please contact us first so we can try to resolve any concern informally.</p>

      <h2>10. Contact</h2>
      <p>
        <Contact />
      </p>
    </LegalPage>
  );
}

export function CookiePolicy() {
  const openSettings = useConsent((s) => s.openSettings);
  return (
    <LegalPage title="Cookie Policy" intro="We keep cookies and similar storage to the minimum needed to run the platform. No advertising or third-party tracking cookies are used.">
      <h2>What we use</h2>
      <table>
        <thead>
          <tr><th>Name</th><th>Type</th><th>Purpose</th><th>Duration</th></tr>
        </thead>
        <tbody>
          <tr><td><code>cs_rt</code></td><td>Strictly necessary · httpOnly cookie</td><td>Keeps you signed in securely (refresh token, rotated on use).</td><td>Browser session, or 30 days with “Remember me”</td></tr>
          <tr><td><code>cs-consent</code></td><td>Strictly necessary · local storage</td><td>Remembers your cookie choices.</td><td>Until you clear it</td></tr>
          <tr><td><code>cs-theme</code></td><td>Strictly necessary · local storage</td><td>Remembers the light/dark theme you chose.</td><td>Until you clear it</td></tr>
          <tr><td><code>cs-utm</code></td><td>Analytics (optional) · session storage</td><td>Remembers the campaign link you arrived from, attached to your sign-up only if you consent.</td><td>Until you close the tab</td></tr>
        </tbody>
      </table>
      <h2>Embedded video sessions</h2>
      <p>When you join a live session, the Jitsi Meet service may set its own cookies inside the embedded meeting window.</p>
      <h2>Your choices</h2>
      <p>
        You can change your choice at any time:{' '}
        <button type="button" className="linklike" onClick={openSettings}>
          open cookie settings
        </button>
        . You can also block or delete cookies in your browser, but you will not be able to stay signed in.
      </p>
    </LegalPage>
  );
}
