import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useDocumentTitle } from '../../hooks';
import { SITE } from '../../config/site';

export const FAQS = [
  { q: 'Is CareerSaathi really free for students?', a: 'Yes. Every student feature is free — there are no premium tiers, hidden fees or paid "boosts".' },
  { q: 'Who can join?', a: 'Any student who has completed Class 12 and is pursuing (or has recently completed) a diploma, undergraduate or postgraduate degree — B.Tech, B.E., B.Sc, BCA, B.Com, BBA, BA, B.Des, M.Tech, MBA, MCA and more.' },
  { q: 'How are roadmaps created?', a: 'We maintain a curated library of roadmaps built around free, reputable resources (NPTEL, SWAYAM, official documentation, Microsoft/Google/AWS learning portals and more). You can also generate a custom roadmap with our AI planner for any field or a combination of fields.' },
  { q: 'What happens if the AI is unavailable?', a: 'Nothing breaks. If no AI provider responds, CareerSaathi automatically builds your plan from the curated library (and blends multiple fields together), and the assistant answers from a built-in career guide.' },
  { q: 'What is the industry readiness score?', a: 'A transparent 0–100 score: profile completeness (20), career kit such as resume, LinkedIn and portfolio (30), roadmap progress (35) and consistency like check-ins and applications (15). Your dashboard shows exactly how to raise it.' },
  { q: 'How do I get a mentor?', a: 'Open Connect → Mentors, browse by expertise and send a request with a short message. Admins can also assign a mentor to you. Once accepted, you can chat and your mentor can set goals with you.' },
  { q: 'Are the opportunities verified?', a: 'Opportunities are posted by admins and approved mentors, and we link out to the Skill NexGen family portals (Skill NexGen, KaushalSaathi, InternSaathi, NaukriSaathi) and trusted job sites such as Unstop and Indeed. Always verify an employer before sharing documents, and never pay to get a job.' },
  { q: 'Who can see my wellness check-ins?', a: 'Only you. Journal entries are encrypted. Your mentor sees a summary (mood, stress, sleep averages) only if you switch on sharing in Profile → Settings.' },
  { q: 'Can I download or delete my data?', a: 'Yes. Profile → Settings lets you download all your data as a file and request account deletion. Deletion completes after a 7-day grace period — sign in during that time to cancel.' },
  { q: 'Is my data sold or used for ads?', a: 'Never. We do not sell data, run ads or use third-party tracking. See our Privacy Policy for details.' },
];

export function FaqList({ items = FAQS }) {
  const base = useId();
  const [open, setOpen] = useState(0);
  return (
    <div>
      {items.map((item, i) => {
        const expanded = open === i;
        return (
          <div key={item.q} className="faq-item">
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              <button type="button" className="faq-q" aria-expanded={expanded} aria-controls={`${base}-${i}`} id={`${base}-q-${i}`} onClick={() => setOpen(expanded ? -1 : i)}>
                {item.q}
                <ChevronDown aria-hidden="true" />
              </button>
            </h3>
            <div id={`${base}-${i}`} role="region" aria-labelledby={`${base}-q-${i}`} hidden={!expanded} className="faq-a">
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Faq() {
  useDocumentTitle('Frequently asked questions');
  return (
    <div className="container">
      <header className="page-head">
        <h1>Frequently asked questions</h1>
        <p className="muted">
          Can't find your answer? <Link to="/contact">Contact the {SITE.company} team</Link>.
        </p>
      </header>
      <div style={{ maxWidth: 820 }}>
        <FaqList />
      </div>
    </div>
  );
}
