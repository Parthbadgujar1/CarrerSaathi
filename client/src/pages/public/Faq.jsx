import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useDocumentTitle } from '../../hooks';
import { SITE } from '../../config/site';

export const FAQS = [
  { q: 'What is CareerSaathi and who is behind it?', a: 'CareerSaathi is a unique initiative by Sunsys Techsol Pvt. Ltd. to help every student from Day 1 of college to their last journey into a career. Many students don’t know what being job-ready means until it is almost too late — we bridge that gap between academia and industry with roadmaps, mentors, opportunities and wellbeing support.' },
  { q: 'Is CareerSaathi really free for students?', a: 'Yes. Every student feature is free — there are no premium tiers, hidden fees or paid "boosts". We never ask students to pay to get a job or internship.' },
  { q: 'Who can join?', a: 'Any student who has completed Class 12 and is pursuing (or has recently completed) a diploma, undergraduate or postgraduate degree — B.Tech, B.E., B.Sc, BCA, B.Com, BBA, BA, B.Des, M.Tech, MBA, MCA and more.' },
  { q: 'Which career domains have study roadmaps?', a: 'Many: tech, data and AI, design, management, HR, finance, core engineering, writing, public sector and more. You can follow a curated roadmap built on free, reputable resources, or ask the AI planner for a plan that mixes several domains. If the AI is unavailable, we build your plan from the curated library — nothing breaks.' },
  { q: 'What is the industry readiness score?', a: 'A transparent 0–100 score: profile completeness (20), career kit such as resume, LinkedIn and portfolio (30), roadmap progress (35) and consistency like check-ins and applications (15). Your dashboard shows exactly how to raise it, and you can track your progress weekly, fortnightly or monthly.' },
  { q: 'How do I get a mentor?', a: 'Open Connect → Mentors, browse by expertise and send a request with a short message. Admins can also assign a mentor to you. Once accepted, you can chat and your mentor can set goals with you and follow your progress.' },
  { q: 'Where do I find internships, jobs and courses?', a: 'The Opportunities page links you to InternSaathi for internships and NaukriSaathi for jobs, and to Skill NexGen and KaushalSaathi when you want to grow your skills — all part of the Sunsys Techsol family. Always verify an employer before sharing documents, and never pay to get a job.' },
  { q: 'Who can see my wellness check-ins?', a: 'Only you. Journal entries are encrypted. Your mentor sees a summary (mood, stress, sleep averages) only if you switch on sharing in Profile → Settings. The Wellness page also has breathing, a focus timer and free yoga videos.' },
  { q: 'Is my data safe — can I download or delete it?', a: 'Yes. We never sell data, run ads or use third-party tracking. Profile → Settings lets you download all your data and request account deletion (completed after a 7-day grace period). See our Privacy Policy for details.' },
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
