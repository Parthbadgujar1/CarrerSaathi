import { useState } from 'react';
import { HeartPulse, Lightbulb, RefreshCw, ShieldCheck, GraduationCap, Briefcase } from 'lucide-react';

const CATEGORIES = {
  security: { label: 'Security', icon: ShieldCheck },
  wellness: { label: 'Wellness', icon: HeartPulse },
  career: { label: 'Career', icon: Briefcase },
  study: { label: 'Study', icon: GraduationCap },
};

export const TIPS = [
  { c: 'security', t: 'Never pay a fee to get a job or internship. Genuine employers and the Sunsys Techsol portals never ask for money to hire you.' },
  { c: 'security', t: 'Use a different, long password for every account and turn on two-step verification on your email first — it protects everything else.' },
  { c: 'security', t: 'Check the sender and the link before you click. Fake "offer letter" emails often use look-alike domains.' },
  { c: 'security', t: 'Keep your phone, browser and apps updated. Security updates close the holes attackers use.' },
  { c: 'security', t: 'Share only what is needed on your resume — skip Aadhaar, PAN or your full home address when applying online.' },
  { c: 'security', t: 'Avoid public Wi-Fi for banking or logins; if you must use it, sign out when you finish.' },
  { c: 'wellness', t: 'Take a 5-minute break every hour of study. Stand up, stretch and look away from the screen.' },
  { c: 'wellness', t: 'Aim for 7–8 hours of sleep. A rested brain remembers more than an extra late-night hour does.' },
  { c: 'wellness', t: 'Try box breathing: in 4, hold 4, out 4, hold 4. Five rounds can settle exam or interview nerves.' },
  { c: 'wellness', t: 'Drink water regularly and walk for 20 minutes a day — small habits beat occasional big efforts.' },
  { c: 'wellness', t: 'Feeling low for days? Talk to a friend, your mentor or Tele-MANAS (14416) — asking for help is a strength.' },
  { c: 'wellness', t: 'Try 10 minutes of yoga each morning — see the Wellness page for free video guides.' },
  { c: 'career', t: 'Build one small project every month and put it on GitHub or your portfolio — proof of skill beats a long list of courses.' },
  { c: 'career', t: 'Update your LinkedIn headline with your target role, e.g. "Aspiring Data Analyst | SQL | Power BI".' },
  { c: 'career', t: 'Apply to a few roles every week and track them. Consistency matters more than waiting for a perfect opening.' },
  { c: 'career', t: 'Practise a mock interview out loud. Explaining your project in 2 minutes is a skill you can train.' },
  { c: 'career', t: 'Keep your resume to one page, with measurable results — "reduced load time by 30%" beats "worked on website".' },
  { c: 'career', t: 'Ask a mentor one specific question each week. Specific questions get useful answers.' },
  { c: 'study', t: 'Study in 25-minute focus blocks with 5-minute breaks. The Focus timer on the Wellness page can run them for you.' },
  { c: 'study', t: 'Teach a concept to someone else — if you can explain it simply, you understand it.' },
  { c: 'study', t: 'Plan the week on Sunday: pick 3 roadmap steps and schedule them. Ticking steps off builds momentum.' },
  { c: 'study', t: 'Revise within 24 hours of learning something new — it moves it into long-term memory.' },
];

/** Rotating tips for security, wellness, career and study. */
export function TipsCard({ compact = false }) {
  const day = Math.floor(Date.now() / 86_400_000);
  const [filter, setFilter] = useState('all');
  const [offset, setOffset] = useState(0);
  const pool = filter === 'all' ? TIPS : TIPS.filter((t) => t.c === filter);
  const tip = pool[(day + offset) % pool.length];
  const Cat = CATEGORIES[tip.c];

  return (
    <section className="card" aria-labelledby="tips-h">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 id="tips-h" className="row" style={{ '--gap': '8px' }}>
          <Lightbulb size={17} aria-hidden="true" /> Tips for you
        </h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOffset((o) => o + 1)}>
          <RefreshCw aria-hidden="true" /> Next tip
        </button>
      </div>
      {!compact && (
        <div className="chips mb-1" role="group" aria-label="Tip topic">
          {[['all', { label: 'All' }], ...Object.entries(CATEGORIES)].map(([key, v]) => (
            <button
              key={key}
              type="button"
              className={`badge ${filter === key ? 'badge-primary' : ''}`}
              style={{ cursor: 'pointer' }}
              aria-pressed={filter === key}
              onClick={() => {
                setFilter(key);
                setOffset(0);
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', '--gap': '12px' }} aria-live="polite">
        <span className="stat-icon">
          <Cat.icon aria-hidden="true" />
        </span>
        <div>
          <div className="xs subtle" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{Cat.label}</div>
          <p className="mb-0">{tip.t}</p>
        </div>
      </div>
    </section>
  );
}
