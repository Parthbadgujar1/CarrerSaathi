import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Compass, Search } from 'lucide-react';
import { roadmapApi } from '../../services/api';
import { useDebounce, useDocumentTitle } from '../../hooks';
import { CardSkeleton, EmptyState, ErrorState, TextField } from '../../components/ui';
import { RoadmapCard } from '../../components/roadmap/RoadmapParts';

export const CATEGORIES = ['Technology', 'Data & AI', 'Design', 'Management', 'Commerce & Finance', 'Core Engineering', 'Creative & Media', 'Public Sector'];

/** Shared library grid used on the public site and inside the student dashboard. */
export function RoadmapGrid({ basePath, enrolledIds }) {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const q = params.get('q') || '';
  const debounced = useDebounce(q, 250);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['roadmaps', 'list', category, debounced],
    queryFn: () => roadmapApi.list({ category, q: debounced }),
  });

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <div className="row mb-2" style={{ alignItems: 'flex-end' }}>
        <TextField
          className="flex-1"
          label="Search roadmaps"
          icon={Search}
          placeholder="e.g. data analyst, HR, civil, marketing"
          value={q}
          onChange={(e) => update('q', e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="chips mb-3" role="group" aria-label="Filter by category">
        {['', ...CATEGORIES].map((c) => (
          <button key={c || 'all'} type="button" className={`badge ${category === c ? 'badge-primary' : ''}`} style={{ cursor: 'pointer', padding: '5px 12px' }} aria-pressed={category === c} onClick={() => update('category', c)}>
            {c || 'All'}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : data.data.length === 0 ? (
        <EmptyState icon={Compass} title="No roadmaps match">
          Try another keyword or category — or use the AI planner to create one for any field.
        </EmptyState>
      ) : (
        <div className="grid-3">
          {data.data.map((r) => (
            <RoadmapCard
              key={r._id}
              roadmap={r}
              to={`${basePath}/${r.slug}`}
              footer={enrolledIds?.has(r._id) ? <span className="badge badge-success" style={{ alignSelf: 'flex-start' }}>Following</span> : null}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function RoadmapLibrary() {
  useDocumentTitle('Career roadmap library');
  return (
    <div className="container">
      <header className="page-head">
        <h1>Career roadmap library</h1>
        <p className="muted" style={{ maxWidth: 680 }}>
          Curated, free-resource roadmaps for graduates of every stream. Sign in to track progress, get a readiness score and generate a
          personalised plan with AI.
        </p>
      </header>
      <RoadmapGrid basePath="/roadmaps" />
    </div>
  );
}
