import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Briefcase, CalendarDays, CheckCircle2, Compass, GraduationCap, HeartPulse, MessagesSquare, Sparkles, Users, Building2,
} from 'lucide-react';
import { publicApi, roadmapApi } from '../../services/api';
import { useDocumentTitle } from '../../hooks';
import { Button, Skeleton } from '../../components/ui';
import { RoadmapCard } from '../../components/roadmap/RoadmapParts';
import { SITE } from '../../config/site';
import { PlatformShowcase } from '../../components/common/PlatformShowcase';
import { FAQS, FaqList } from './Faq';

/** "Why choose" cards — numbered, as on kaushalsaathi.com. */
const WHY = [
  { icon: Compass, title: 'Roadmaps for every degree', text: 'Step-by-step plans for tech, management, commerce, design, core engineering and government careers — or an AI-generated plan for any mix of fields.' },
  { icon: BadgeCheck, title: 'Industry readiness score', text: 'A clear 0–100 score from your profile, career kit (resume, LinkedIn, portfolio), roadmap progress and consistency — with the next best step.' },
  { icon: Briefcase, title: 'Opportunities in one place', text: 'Internships, jobs, hackathons and scholarships, plus direct paths into InternSaathi, NaukriSaathi, Unstop and Indeed — with an application tracker.' },
  { icon: MessagesSquare, title: 'Mentors & communities', text: 'Talk 1:1 with industry mentors and learn alongside peers in communities built around your career interests.' },
  { icon: CalendarDays, title: 'Live sessions', text: 'Seminars, workshops and mock interviews by mentors and the Skill NexGen team — join right from your dashboard.' },
  { icon: HeartPulse, title: 'Wellbeing built in', text: 'Daily check-ins, breathing exercise, focus timer and gentle support — because a healthy mind is part of a great career.' },
];

/** "Simple. Smart. Seamless." steps with an audience switcher, as on naukrisaathi.com. */
const STEPS = {
  students: {
    label: 'For Students',
    icon: GraduationCap,
    steps: [
      ['Create your free profile', 'Add your degree, college and interests in about two minutes.'],
      ['Pick or generate a roadmap', 'Choose from the library, take the Career Compass quiz or ask the AI planner.'],
      ['Build your career kit', 'Resume, LinkedIn, projects — tracked in one checklist with your readiness score.'],
      ['Apply, connect & grow', 'Track applications, talk to mentors, join live sessions and stay balanced.'],
    ],
  },
  mentors: {
    label: 'For Mentors',
    icon: Users,
    steps: [
      ['Apply to mentor', 'Share your experience; the Skill NexGen team reviews every application.'],
      ['Accept mentees', 'Students request you by expertise — you decide whom to guide.'],
      ['Track & set goals', 'See each mentee’s roadmap, career kit and readiness; add goals and feedback.'],
      ['Host & share', 'Run sessions or mock interviews and post opportunities to matching students.'],
    ],
  },
  admins: {
    label: 'For Colleges & Admins',
    icon: Building2,
    steps: [
      ['Onboard students', 'Share a sign-up link; registrations appear instantly with source tracking.'],
      ['Monitor progress', 'Dashboards for readiness, tracks, colleges and engagement.'],
      ['Export records', 'Download student details and progress to Excel with the columns you choose.'],
      ['Engage at scale', 'Schedule seminars, publish opportunities and send announcements.'],
    ],
  },
};

const BRIDGE = [
  'Roadmaps aligned with what employers expect today',
  'Portfolio-ready projects inside every roadmap',
  'Skill-gap analysis against each career path',
  'Resume builder and LinkedIn / GitHub checklist',
  'Mock interviews and guidance from industry mentors',
  'Direct routes to internships and jobs across the Skill NexGen network',
];

export function Home() {
  useDocumentTitle();
  const [audience, setAudience] = useState('students');
  const { data: stats } = useQuery({ queryKey: ['public-stats'], queryFn: publicApi.stats, staleTime: 5 * 60_000 });
  const { data: roadmaps } = useQuery({ queryKey: ['roadmaps', 'public'], queryFn: () => roadmapApi.list() });
  const s = stats?.data;
  const library = roadmaps?.data || [];
  const categories = [...new Set(library.map((r) => r.category))];
  const featured = ['full-stack-web-development', 'data-analytics', 'digital-marketing', 'human-resources', 'ui-ux-design', 'finance-accounting']
    .map((slug) => library.find((r) => r.slug === slug))
    .filter(Boolean);
  const num = (v) => (v === undefined ? <Skeleton width={40} height={26} style={{ background: 'rgba(255,255,255,.18)' }} /> : v);

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">
              <span className="chip">
                <Sparkles aria-hidden="true" /> Free
              </span>
              CareerSaathi · by {SITE.company}
            </span>
            <h1 id="hero-title">
              Plan Your Career. <span className="hl">Become Industry&#8209;Ready.</span>
            </h1>
            <p className="lead">
              Personalised roadmaps, industry mentors, real opportunities and wellbeing support — free for every graduation student, from B.Tech and
              B.Com to BBA, BA, M.Tech and MBA.
            </p>
            <div className="row" style={{ '--gap': '12px' }}>
              <Button variant="brand" size="lg" to="/register" iconRight={ArrowRight}>
                Get Started Free
              </Button>
              <Button variant="glass" size="lg" to="/roadmaps" icon={Compass}>
                Explore Roadmaps
              </Button>
            </div>
            <div className="hero-pills">
              <span><Compass aria-hidden="true" /> Personalised roadmaps</span>
              <span><Users aria-hidden="true" /> Industry mentors</span>
              <span><CalendarDays aria-hidden="true" /> Live sessions</span>
              <span><HeartPulse aria-hidden="true" /> Wellbeing support</span>
            </div>
          </div>
          <div className="hero-panel" aria-label="CareerSaathi at a glance">
            <div className="glass-card">
              <div className="big">{num(s?.roadmaps)}</div>
              <div className="lbl">Career roadmaps</div>
            </div>
            <div className="glass-card">
              <div className="big">{num(s?.mentors)}</div>
              <div className="lbl">Active mentors</div>
            </div>
            <div className="glass-card">
              <div className="big">{num(s?.opportunities)}</div>
              <div className="lbl">Open opportunities</div>
            </div>
            <div className="glass-card">
              <div className="big">Free</div>
              <div className="lbl">For every student · no hidden fees</div>
            </div>
            <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
              <div className="lbl" style={{ marginBottom: 8 }}>Your journey across the {SITE.company} family</div>
              <div className="row" style={{ '--gap': '6px', fontWeight: 700, fontSize: '0.9rem' }}>
                <span>Plan</span>
                <ArrowRight size={14} aria-hidden="true" />
                <span>Learn</span>
                <ArrowRight size={14} aria-hidden="true" />
                <span>Train</span>
                <ArrowRight size={14} aria-hidden="true" />
                <span>Intern</span>
                <ArrowRight size={14} aria-hidden="true" />
                <span style={{ color: 'var(--highlight)' }}>Get hired</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Why choose ---------------- */}
      <section id="features" className="section section-alt" aria-labelledby="why-title">
        <div className="container">
          <div className="section-head">
            <span className="section-kicker">Why CareerSaathi</span>
            <h2 id="why-title">Why Choose CareerSaathi?</h2>
            <p>More than a job board or a course list — a structured path from where you are today to your first role, with support at every step.</p>
          </div>
          <div className="grid-3">
            {WHY.map((f, i) => (
              <article key={f.title} className="card card-hover why-card">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="why-num" aria-hidden="true">{i + 1}</span>
                  <f.icon size={22} color="var(--primary)" aria-hidden="true" />
                </div>
                <h3>{f.title}</h3>
                <p className="small muted mb-0">{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Skill NexGen family portals ---------------- */}
      <section id="network" className="section" aria-labelledby="network-title">
        <div className="container">
          <div className="section-head center" style={{ marginInline: 'auto', maxWidth: 760 }}>
            <span className="section-kicker">The {SITE.company} family</span>
            <h2 id="network-title">
              Four powerful platforms, <span className="hl">one mission</span>
            </h2>
            <p>
              Making every career journey seamless from day one — CareerSaathi plans your path, and these portals take you from learning to
              earning.
            </p>
          </div>
          <PlatformShowcase />
        </div>
      </section>

      {/* ---------------- Steps ---------------- */}
      <section className="section section-alt" aria-labelledby="steps-title">
        <div className="container">
          <div className="section-head center" style={{ marginInline: 'auto' }}>
            <span className="section-kicker">Simple. Smart. Seamless.</span>
            <h2 id="steps-title">Get started in four easy steps</h2>
          </div>
          <div className="row mb-3" style={{ justifyContent: 'center' }}>
            <div className="segmented" role="group" aria-label="Show steps for">
              {Object.entries(STEPS).map(([key, a]) => (
                <button key={key} type="button" aria-pressed={audience === key} onClick={() => setAudience(key)}>
                  <a.icon size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <ol className="steps-list" style={{ padding: 0, margin: 0 }} aria-live="polite">
            {STEPS[audience].steps.map(([title, text]) => (
              <li key={title}>
                <h3>{title}</h3>
                <p className="muted small mb-0">{text}</p>
              </li>
            ))}
          </ol>
          <div className="center mt-3">
            <Button variant="primary" to={audience === 'mentors' ? '/mentor-apply' : audience === 'admins' ? '/contact' : '/register'} iconRight={ArrowRight}>
              {audience === 'mentors' ? 'Apply to become a mentor' : audience === 'admins' ? 'Partner with us' : 'Create my free account'}
            </Button>
          </div>
        </div>
      </section>

      {/* ---------------- Bridging the gap ---------------- */}
      <section className="section band-ink" aria-labelledby="bridge-title">
        <div className="container grid-2" style={{ alignItems: 'center', gap: 40 }}>
          <div>
            <span className="section-kicker">Learning to career</span>
            <h2 id="bridge-title">Bridging the Gap Between Academia and <span className="hl">Industry</span></h2>
            <p className="muted">Colleges teach the foundations; employers look for proof of skills. CareerSaathi connects the two.</p>
            <ul className="check-list mt-2">
              {BRIDGE.map((b) => (
                <li key={b}>
                  <CheckCircle2 aria-hidden="true" /> <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hero-panel">
            <div className="glass-card">
              <div className="lbl">Career streams</div>
              <div className="big">{categories.length || '—'}</div>
              <div className="lbl">from tech to public sector</div>
            </div>
            <div className="glass-card">
              <div className="lbl">Readiness score</div>
              <div className="big">0–100</div>
              <div className="lbl">clear, explainable progress</div>
            </div>
            <div className="glass-card">
              <div className="lbl">Practical learning</div>
              <div className="big">Projects</div>
              <div className="lbl">in every roadmap</div>
            </div>
            <div className="glass-card">
              <div className="lbl">Career support</div>
              <div className="big">Mentors</div>
              <div className="lbl">1:1 chat & live sessions</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Popular roadmaps ---------------- */}
      <section className="section" aria-labelledby="paths-title">
        <div className="container">
          <div className="row-between mb-3" style={{ alignItems: 'flex-end' }}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <span className="section-kicker">Career paths</span>
              <h2 id="paths-title">Start with a popular roadmap</h2>
              <p className="mb-0">Curated around free, reputable resources — follow one, or combine several with the AI planner.</p>
            </div>
            <Button to="/roadmaps" iconRight={ArrowRight}>View all roadmaps</Button>
          </div>
          <div className="grid-3">
            {featured.length
              ? featured.map((r) => <RoadmapCard key={r._id} roadmap={r} to={`/roadmaps/${r.slug}`} />)
              : Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card"><Skeleton height={120} /></div>
                ))}
          </div>
          <div className="chips mt-2">
            {categories.map((c) => (
              <Link key={c} to={`/roadmaps?category=${encodeURIComponent(c)}`} className="badge badge-primary">
                {c}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FAQ preview ---------------- */}
      <section className="section" aria-labelledby="faq-title">
        <div className="container grid-2" style={{ alignItems: 'start', gap: 40 }}>
          <div>
            <span className="section-kicker">FAQs</span>
            <h2 id="faq-title">Questions students ask us</h2>
            <p className="muted">Quick answers about cost, AI, mentors and your data.</p>
            <div className="card mt-2" style={{ background: 'var(--bg-subtle)' }}>
              <h3 style={{ marginBottom: 4 }}>Still have questions?</h3>
              <p className="small muted">Our team is here to help.</p>
              <div className="row">
                <Button variant="primary" to="/contact">Contact us</Button>
                <Button to="/faq">All FAQs</Button>
              </div>
            </div>
          </div>
          <FaqList items={FAQS.slice(0, 5)} />
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band">
            <h2>Ready to Transform Your <span className="hl">Career</span>?</h2>
            <p>Join CareerSaathi today — free for students, with no hidden fees or premium tiers.</p>
            <div className="row" style={{ justifyContent: 'center', '--gap': '12px' }}>
              <Button variant="brand" size="lg" to="/register" iconRight={ArrowRight}>
                Get Started Free
              </Button>
              <Button variant="glass" size="lg" to="/mentor-apply">
                Become a Mentor
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
