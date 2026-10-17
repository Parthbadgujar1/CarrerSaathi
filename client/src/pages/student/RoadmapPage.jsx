import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Compass, Library, Map as MapIcon, Sparkles } from 'lucide-react';
import { roadmapApi } from '../../services/api';
import { PageTitle } from '../../components/common/PageTitle';
import { Button, CardSkeleton, EmptyState, ErrorState, Tabs } from '../../components/ui';
import { RoadmapCard } from '../../components/roadmap/RoadmapParts';
import { AiPlanner } from '../../components/roadmap/AiPlanner';
import { CareerQuiz } from '../../components/roadmap/CareerQuiz';
import { RoadmapGrid } from '../public/RoadmapLibrary';

export function RoadmapPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'mine';
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['enrollments'], queryFn: roadmapApi.enrollments });
  const enrollments = data?.data || [];
  const enrolledIds = new Set(enrollments.map((e) => e.roadmap._id));
  const setTab = (t) => setParams({ tab: t }, { replace: true });

  return (
    <>
      <PageTitle title="Roadmap" subtitle="Follow a step-by-step plan for your career — curated, AI-generated, or matched by quiz." />
      <Tabs
        value={tab}
        onChange={setTab}
        label="Roadmap sections"
        tabs={[
          { value: 'mine', label: 'My roadmaps', icon: MapIcon, count: enrollments.length },
          { value: 'library', label: 'Explore library', icon: Library },
          { value: 'planner', label: 'AI planner', icon: Sparkles },
          { value: 'quiz', label: 'Career Compass', icon: Compass },
        ]}
      />
      {tab === 'mine' &&
        (error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : enrollments.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Compass}
              title="You're not following any roadmap yet"
              action={
                <div className="row" style={{ justifyContent: 'center' }}>
                  <Button variant="primary" onClick={() => setTab('quiz')}>Take the Career Compass quiz</Button>
                  <Button onClick={() => setTab('library')}>Browse the library</Button>
                </div>
              }
            >
              Not sure where to start? The 2-minute quiz suggests paths that fit your interests and degree.
            </EmptyState>
          </div>
        ) : (
          <div className="grid-3">
            {enrollments.map((e) => (
              <RoadmapCard key={e._id} roadmap={e.roadmap} to={`/app/roadmap/${e.roadmap.slug}`} progress={e.progress} />
            ))}
          </div>
        ))}
      {tab === 'library' && <RoadmapGrid basePath="/app/roadmap" enrolledIds={enrolledIds} />}
      {tab === 'planner' && <AiPlanner />}
      {tab === 'quiz' && <CareerQuiz enrolledIds={enrolledIds} />}
    </>
  );
}
