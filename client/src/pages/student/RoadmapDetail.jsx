import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Plus, Printer, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { roadmapApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { useDocumentTitle } from '../../hooks';
import { Badge, Button, ConfirmDialog, ErrorState, PageLoader, ProgressBar } from '../../components/ui';
import { RoadmapTimeline } from '../../components/roadmap/RoadmapParts';
import { LastUpdated } from '../../components/common/SiteChrome';

export function RoadmapDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [pendingKey, setPendingKey] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['roadmap', slug, 'me'], queryFn: () => roadmapApi.get(slug) });
  const roadmap = data?.data?.roadmap;
  const enrollment = data?.data?.enrollment;
  const gap = data?.data?.skillGap;
  useDocumentTitle(roadmap?.title || 'Roadmap');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['roadmap', slug] });
    qc.invalidateQueries({ queryKey: ['enrollments'] });
    qc.invalidateQueries({ queryKey: ['student-dashboard'] });
  };

  const enroll = useMutation({ mutationFn: () => roadmapApi.enroll(roadmap._id), onSuccess: (res) => (toast.success(res.message), refresh()), onError: (e) => toast.error(getErrorMessage(e)) });
  const unenroll = useMutation({
    mutationFn: () => roadmapApi.unenroll(roadmap._id),
    onSuccess: (res) => {
      toast.success(res.message);
      refresh();
      if (roadmap.owner) navigate('/app/roadmap', { replace: true });
      setConfirm(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: ({ key, done }) => roadmapApi.toggleStep(roadmap._id, key, done),
    onMutate: ({ key }) => setPendingKey(key),
    onSuccess: (res, { done }) => {
      // Update the cached detail in place — no flash of reloading.
      qc.setQueryData(['roadmap', slug, 'me'], (old) => (old ? { ...old, data: { ...old.data, enrollment: { ...old.data.enrollment, ...res.data } } } : old));
      if (res.data.progress === 100) toast.success('🎉 Roadmap complete! Amazing work.');
      else if (done) toast.success('Step completed');
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
    onSettled: () => setPendingKey(null),
  });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const completed = new Set((enrollment?.completed || []).map((c) => c.key));
  const total = roadmap.phases.reduce((n, p) => n + p.steps.length, 0);

  return (
    <>
      <Link to="/app/roadmap" className="small row mb-2" style={{ '--gap': '6px' }}>
        <ArrowLeft size={14} aria-hidden="true" /> My roadmaps
      </Link>
      <div className="card mb-2">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div className="flex-1" style={{ minWidth: 260 }}>
            <div className="row" style={{ '--gap': '6px' }}>
              <Badge tone="primary">{roadmap.category}</Badge>
              {roadmap.source === 'ai' && <Badge tone="accent" icon={Sparkles}>Personal AI roadmap</Badge>}
            </div>
            <h1 className="mt-1" style={{ fontSize: '1.6rem' }}>{roadmap.title}</h1>
            <p className="muted mb-1">{roadmap.summary}</p>
            <div className="row xs subtle">
              {roadmap.duration && <span>Duration: {roadmap.duration}</span>}
              <span>{total} steps</span>
              <LastUpdated date={roadmap.updatedAt} />
            </div>
          </div>
          <div className="row no-print">
            <Button icon={Printer} onClick={() => window.print()}>Print</Button>
            {enrollment ? (
              <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirm(true)}>
                {roadmap.owner ? 'Delete' : 'Unfollow'}
              </Button>
            ) : (
              <Button variant="primary" icon={Plus} loading={enroll.isPending} onClick={() => enroll.mutate()}>
                Follow this roadmap
              </Button>
            )}
          </div>
        </div>
        {enrollment && (
          <div className="mt-2">
            <div className="row-between small mb-1">
              <span className="bold">{enrollment.progress === 100 ? 'Completed 🎉' : 'Your progress'}</span>
              <span>
                {completed.size}/{total} steps · {enrollment.progress}%
              </span>
            </div>
            <ProgressBar value={enrollment.progress} label="Roadmap progress" />
          </div>
        )}
      </div>

      {gap && roadmap.skills?.length > 0 && (
        <section className="card mb-2" aria-labelledby="gap-h">
          <div className="card-header">
            <h2 id="gap-h">Skill gap analysis</h2>
            <Link to="/app/profile" className="small">Update my skills</Link>
          </div>
          <div className="grid-2">
            <div>
              <div className="row small bold mb-1" style={{ '--gap': '6px' }}>
                <CheckCircle2 size={15} color="var(--success)" aria-hidden="true" /> You have ({gap.have.length})
              </div>
              <div className="chips">
                {gap.have.length ? gap.have.map((s) => <span key={s} className="badge badge-success">{s}</span>) : <span className="small muted">Add skills to your profile to compare.</span>}
              </div>
            </div>
            <div>
              <div className="row small bold mb-1" style={{ '--gap': '6px' }}>
                <TriangleAlert size={15} color="var(--warning)" aria-hidden="true" /> To build ({gap.missing.length})
              </div>
              <div className="chips">
                {gap.missing.map((s) => (
                  <span key={s} className="badge badge-warning">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="card">
        {!enrollment && <p className="small muted">Follow this roadmap to tick off steps and track your progress.</p>}
        <RoadmapTimeline roadmap={roadmap} completed={completed} onToggle={enrollment ? (key, done) => toggle.mutate({ key, done }) : undefined} pendingKey={pendingKey} />
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => unenroll.mutate()}
        loading={unenroll.isPending}
        danger
        title={roadmap.owner ? 'Delete this AI roadmap?' : 'Unfollow this roadmap?'}
        message={roadmap.owner ? 'Your personal roadmap and its progress will be permanently deleted.' : 'Your progress on this roadmap will be removed. You can follow it again later, but progress starts from zero.'}
        confirmLabel={roadmap.owner ? 'Delete roadmap' : 'Unfollow'}
      />
    </>
  );
}
