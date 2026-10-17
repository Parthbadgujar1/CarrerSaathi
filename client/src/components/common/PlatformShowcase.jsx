import { ArrowRight, Briefcase, GraduationCap, Rocket, Video, CheckCircle2 } from 'lucide-react';
import { ECOSYSTEM, PARENT } from '../../config/site';

const ICONS = { skillnexgen: GraduationCap, kaushalsaathi: Video, internsaathi: Rocket, naukrisaathi: Briefcase };

/**
 * Promotes the four Skill NexGen family portals (layout modelled on internsaathi.com):
 * accent icon tile, kicker, headline, description, checklist and a full-width CTA,
 * with arrow bubbles showing the journey from one platform to the next.
 */
export function PlatformShowcase({ showPowered = true }) {
  return (
    <>
      <div className="platform-grid">
        {ECOSYSTEM.map((p, i) => {
          const Icon = ICONS[p.key];
          return (
            <article key={p.key} className="platform-card" data-brand={p.key} aria-labelledby={`pf-${p.key}`}>
              <span className="platform-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="platform-kicker">{p.kicker}</span>
              <h3 id={`pf-${p.key}`}>{p.title}</h3>
              <p>{p.description}</p>
              <ul className="check-list">
                {p.points.map((pt) => (
                  <li key={pt}>
                    <CheckCircle2 aria-hidden="true" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <a className="platform-cta" href={p.url} target="_blank" rel="noopener noreferrer">
                {p.cta} <ArrowRight aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              {i % 2 === 0 && (
                <span className="platform-link" aria-hidden="true">
                  <ArrowRight />
                </span>
              )}
            </article>
          );
        })}
      </div>
      {showPowered && (
        <p className="powered-note">
          Powered by{' '}
          <a href={PARENT.url} target="_blank" rel="noopener noreferrer">
            {PARENT.name}
          </a>{' '}
          — enabling seamless career journeys through innovation, guidance, and mentorship.
        </p>
      )}
    </>
  );
}
