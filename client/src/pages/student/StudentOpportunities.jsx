import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Briefcase, ExternalLink, GraduationCap, Rocket, Video } from 'lucide-react';
import { opportunityApi } from '../../services/api';
import { ECOSYSTEM } from '../../config/site';
import { PageTitle } from '../../components/common/PageTitle';
import { Badge, Button, CardSkeleton, ErrorState } from '../../components/ui';
import { SOURCE_LABEL } from '../../components/opportunities/OpportunityCard';

const ICONS = { skillnexgen: GraduationCap, kaushalsaathi: Video, internsaathi: Rocket, naukrisaathi: Briefcase };

/** Opportunities = InternSaathi + NaukriSaathi. Skill-building = Skill NexGen + KaushalSaathi. */
const GROUPS = [
  {
    id: 'opp-h',
    title: 'Find internships & jobs',
    intro: 'Verified internships and fresher jobs — apply directly on our partner portals.',
    keys: ['internsaathi', 'naukrisaathi'],
  },
  {
    id: 'skill-h',
    title: 'Want to grow your skills and learn?',
    intro: 'Build job-ready skills with industry-focused courses and live, mentor-led training.',
    keys: ['skillnexgen', 'kaushalsaathi'],
  },
];

function PortalCard({ portal, url }) {
  const Icon = ICONS[portal.key] || Briefcase;
  return (
    <article className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ '--gap': '10px' }}>
        <span className="stat-icon">
          <Icon aria-hidden="true" />
        </span>
        <div>
          <h3 style={{ margin: 0 }}>{portal.label}</h3>
          <span className="xs subtle">{portal.step}</span>
        </div>
      </div>
      <p className="small muted mb-0">{portal.description}</p>
      <ul className="small muted" style={{ margin: 0, paddingLeft: 18, flex: 1 }}>
        {portal.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {url ? (
        <Button variant="primary" size="sm" href={url} target="_blank" rel="noopener noreferrer" iconRight={ArrowUpRight} style={{ alignSelf: 'flex-start' }}>
          {portal.cta}
          <span className="sr-only"> (opens in a new tab)</span>
        </Button>
      ) : (
        <span className="xs subtle">Link coming soon</span>
      )}
    </article>
  );
}

export function StudentOpportunities() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['opportunities', 'external'], queryFn: opportunityApi.external });

  return (
    <>
      <PageTitle title="Opportunities" subtitle="Internships, jobs and skill-building — all through the Sunsys Techsol family of platforms." />
      {isLoading ? (
        <div className="grid-2">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="stack" style={{ '--gap': '28px' }}>
          {GROUPS.map((g) => (
            <section key={g.id} aria-labelledby={g.id}>
              <h2 id={g.id} style={{ fontSize: '1.15rem', marginBottom: 2 }}>{g.title}</h2>
              <p className="small muted">{g.intro}</p>
              <div className="grid-2">
                {g.keys.map((key) => {
                  const portal = ECOSYSTEM.find((p) => p.key === key);
                  const url = data.data.ecosystem.find((e) => e.key === key)?.url || portal.url;
                  return <PortalCard key={key} portal={portal} url={url} />;
                })}
              </div>
            </section>
          ))}

          {data.data.searches.map((s) => (
            <section key={s.track} aria-label={`Searches for ${s.track}`}>
              <h2 style={{ fontSize: '1.05rem' }}>
                Live listings for <span style={{ color: 'var(--primary)' }}>{s.track}</span>
              </h2>
              <p className="small muted">Pre-filled searches for “{s.query}” on trusted platforms. Never pay a fee to apply for a job.</p>
              <div className="grid-3">
                {s.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="card card-hover card-link row">
                    <Badge>{SOURCE_LABEL[l.source] || l.source.toUpperCase()}</Badge>
                    <span className="flex-1 small bold">{l.label}</span>
                    <ExternalLink size={15} aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
