import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, CalendarDays, ClipboardList, ExternalLink, Globe, Search } from 'lucide-react';
import { meetingApi, opportunityApi } from '../../services/api';
import { useDebounce } from '../../hooks';
import { fmtDate, titleCase } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Badge, Button, CardSkeleton, EmptyState, ErrorState, Pagination, SelectField, Switch, Tabs, TextField } from '../../components/ui';
import { OpportunityCard, SOURCE_LABEL } from '../../components/opportunities/OpportunityCard';
import { MeetingCard } from '../../components/meetings/MeetingCard';

const TYPES = ['job', 'internship', 'hackathon', 'competition', 'scholarship', 'workshop', 'event'];

function Feed() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [type, setType] = useState('');
  const [forMe, setForMe] = useState(!params.get('q'));
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q, 300);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['opportunities', { debounced, type, forMe, page }],
    queryFn: () => opportunityApi.list({ q: debounced, type, forMe: forMe ? 'true' : '', page }),
    placeholderData: (prev) => prev,
  });
  return (
    <>
      <div className="card mb-2">
        <div className="form-grid" style={{ alignItems: 'end' }}>
          <TextField label="Search" icon={Search} placeholder="Title, company or city" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} maxLength={100} />
          <SelectField label="Type" placeholder="All types" value={type} onChange={(e) => (setType(e.target.value), setPage(1))} options={TYPES.map((t) => ({ value: t, label: titleCase(t) }))} />
          <div style={{ paddingBottom: 8 }}>
            <Switch label="Matched to my career tracks" checked={forMe} onChange={(v) => (setForMe(v), setPage(1))} />
          </div>
        </div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid-2">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} lines={4} />)}
        </div>
      ) : data.data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Briefcase} title="No opportunities match">
            Try turning off “Matched to my career tracks”, or explore live listings on partner platforms.
          </EmptyState>
        </div>
      ) : (
        <div style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity .2s' }}>
          <div className="grid-2">
            {data.data.items.map((o) => <OpportunityCard key={o._id} opp={o} />)}
          </div>
          <Pagination pagination={data.data.pagination} onPage={setPage} />
        </div>
      )}
    </>
  );
}

function Sessions() {
  const [when, setWhen] = useState('upcoming');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['meetings', when], queryFn: () => meetingApi.list({ when }) });
  return (
    <>
      <div className="segmented mb-2" role="group" aria-label="Which sessions">
        <button type="button" aria-pressed={when === 'upcoming'} onClick={() => setWhen('upcoming')}>Upcoming</button>
        <button type="button" aria-pressed={when === 'past'} onClick={() => setWhen('past')}>Past</button>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <CardSkeleton />
      ) : data.data.items.length === 0 ? (
        <div className="card"><EmptyState icon={CalendarDays} title={when === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}>Seminars, workshops and mentor sessions appear here.</EmptyState></div>
      ) : (
        <div className="grid-2">
          {data.data.items.map((m) => <MeetingCard key={m._id} meeting={m} />)}
        </div>
      )}
    </>
  );
}

function Explore() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['opportunities', 'external'], queryFn: opportunityApi.external });
  if (isLoading) return <CardSkeleton lines={5} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { ecosystem, searches } = data.data;
  return (
    <div className="stack" style={{ '--gap': '24px' }}>
      <section aria-labelledby="eco-h">
        <h2 id="eco-h" style={{ fontSize: '1.05rem' }}>The Skill NexGen family</h2>
        <div className="grid-4">
          {ecosystem.map((e) => (
            <div key={e.key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Globe size={20} color="var(--primary)" aria-hidden="true" />
              <h3 style={{ margin: 0 }}>{e.label}</h3>
              <p className="small muted mb-0" style={{ flex: 1 }}>{e.description}</p>
              {e.url ? (
                <Button size="sm" href={e.url} target="_blank" rel="noopener noreferrer" iconRight={ExternalLink}>
                  Visit<span className="sr-only"> {e.label} (opens in a new tab)</span>
                </Button>
              ) : (
                <span className="xs subtle">Link coming soon</span>
              )}
            </div>
          ))}
        </div>
      </section>
      {searches.map((s) => (
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
  );
}

const STAGES = ['saved', 'applied', 'interview', 'offer', 'rejected'];
function Tracker() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['applications'], queryFn: opportunityApi.myApplications });
  if (isLoading) return <CardSkeleton lines={4} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const apps = data.data;
  if (!apps.length) {
    return (
      <div className="card">
        <EmptyState icon={ClipboardList} title="Your tracker is empty">Save opportunities to track every application from “saved” to “offer”.</EmptyState>
      </div>
    );
  }
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {STAGES.map((stage) => {
        const items = apps.filter((a) => a.status === stage);
        return (
          <section key={stage} className="card" style={{ background: 'var(--bg-subtle)', padding: 14 }} aria-label={`${titleCase(stage)} applications`}>
            <div className="row-between mb-1">
              <h3 style={{ margin: 0, fontSize: '0.9rem' }}>{titleCase(stage)}</h3>
              <Badge>{items.length}</Badge>
            </div>
            <div className="stack" style={{ '--gap': '8px' }}>
              {items.map((a) => (
                <div key={a._id} className="card" style={{ padding: 12 }}>
                  <div className="small bold">{a.opportunity.title}</div>
                  <div className="xs muted">{a.opportunity.organization}</div>
                  {a.opportunity.deadline && <div className="xs subtle">Deadline {fmtDate(a.opportunity.deadline)}</div>}
                  {a.notes && <div className="xs mt-1">{a.notes}</div>}
                </div>
              ))}
              {!items.length && <p className="xs subtle mb-0">Nothing here yet.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function StudentOpportunities() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'feed';
  return (
    <>
      <PageTitle title="Opportunities" subtitle="Jobs, internships, competitions, scholarships and live sessions — in one place." />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'feed', label: 'For you', icon: Briefcase },
          { value: 'sessions', label: 'Live sessions', icon: CalendarDays },
          { value: 'explore', label: 'Explore platforms', icon: Globe },
          { value: 'tracker', label: 'My tracker', icon: ClipboardList },
        ]}
      />
      {tab === 'feed' && <Feed />}
      {tab === 'sessions' && <Sessions />}
      {tab === 'explore' && <Explore />}
      {tab === 'tracker' && <Tracker />}
    </>
  );
}
