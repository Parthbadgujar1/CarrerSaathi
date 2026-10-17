import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { roadmapApi } from '../../services/api';
import { useDocumentTitle } from '../../hooks';
import { useAuth } from '../../store/auth.store';
import { Alert, Button, ErrorState, PageLoader } from '../../components/ui';
import { RoadmapMeta, RoadmapTimeline } from '../../components/roadmap/RoadmapParts';
import { LastUpdated } from '../../components/common/SiteChrome';

export function PublicRoadmap() {
  const { slug } = useParams();
  const user = useAuth((s) => s.user);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['roadmap', slug], queryFn: () => roadmapApi.get(slug) });
  const roadmap = data?.data?.roadmap;
  useDocumentTitle(roadmap?.title || 'Roadmap');

  // Signed-in students get the interactive version.
  if (user?.role === 'student') return <Navigate to={`/app/roadmap/${slug}`} replace />;
  if (isLoading) return <PageLoader />;
  if (error) return <div className="container section"><ErrorState error={error} onRetry={refetch} /></div>;

  return (
    <div className="container">
      <header className="page-head">
        <Link to="/roadmaps" className="small row" style={{ '--gap': '6px', marginBottom: 12 }}>
          <ArrowLeft size={14} aria-hidden="true" /> All roadmaps
        </Link>
        <div className="row-between">
          <div>
            <span className="badge badge-primary mb-1">{roadmap.category}</span>
            <h1>{roadmap.title}</h1>
          </div>
          <Button icon={Printer} onClick={() => window.print()} className="no-print">
            Print / save PDF
          </Button>
        </div>
        <p className="muted" style={{ maxWidth: 720 }}>{roadmap.summary}</p>
        <div className="row small muted">
          {roadmap.duration && <span>Typical duration: {roadmap.duration}</span>}
          <LastUpdated date={roadmap.updatedAt} />
        </div>
      </header>
      <RoadmapMeta roadmap={roadmap} />
      {!user && (
        <Alert type="info" className="mt-3" title="Track your progress for free">
          <Link to="/register">Create an account</Link> to tick off steps, see your readiness score and get matched opportunities.
        </Alert>
      )}
      <div className="mt-3">
        <RoadmapTimeline roadmap={roadmap} />
      </div>
    </div>
  );
}
