import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Compass, RotateCcw } from 'lucide-react';
import { roadmapApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { Button, ErrorState, PageLoader, ProgressBar } from '../ui';
import { RoadmapCard } from './RoadmapParts';

/** Career Compass — a rule-based interest quiz (zero AI cost) that suggests three roadmaps. */
export function CareerQuiz({ enrolledIds }) {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['quiz'], queryFn: roadmapApi.quiz, staleTime: Infinity });
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const recommend = useMutation({ mutationFn: () => roadmapApi.recommend(answers), onError: (err) => toast.error(getErrorMessage(err)) });
  const enroll = useMutation({
    mutationFn: (id) => roadmapApi.enroll(id),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const questions = data.data;

  if (recommend.data) {
    return (
      <div className="stack">
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Your top matches</h2>
            <p className="small muted mb-0">Based on your interests and degree. Try one for two weeks before committing.</p>
          </div>
          <Button
            icon={RotateCcw}
            onClick={() => {
              recommend.reset();
              setAnswers({});
              setStep(0);
            }}
          >
            Retake quiz
          </Button>
        </div>
        <div className="grid-3">
          {recommend.data.data.map((m, i) => (
            <RoadmapCard
              key={m.slug}
              roadmap={m.roadmap}
              to={`/app/roadmap/${m.slug}`}
              footer={
                <div className="stack" style={{ '--gap': '8px' }}>
                  <p className="xs muted mb-0">
                    <strong>#{i + 1} match</strong> — you chose: {m.reasons.join(', ')}
                  </p>
                  {enrolledIds?.has(m.roadmap._id) ? (
                    <span className="badge badge-success" style={{ alignSelf: 'flex-start' }}>Following</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={enroll.isPending && enroll.variables === m.roadmap._id}
                      onClick={(e) => {
                        e.preventDefault();
                        enroll.mutate(m.roadmap._id);
                      }}
                    >
                      Follow roadmap
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </div>
      </div>
    );
  }

  const q = questions[step];
  const last = step === questions.length - 1;
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="row-between mb-1">
        <span className="row small bold" style={{ '--gap': '6px' }}>
          <Compass size={16} aria-hidden="true" /> Career Compass
        </span>
        <span className="xs muted">
          Question {step + 1} of {questions.length}
        </span>
      </div>
      <ProgressBar value={((step + (answers[q.id] ? 1 : 0)) / questions.length) * 100} small label="Quiz progress" />
      <fieldset style={{ border: 0, padding: 0, margin: '20px 0 0' }}>
        <legend style={{ fontSize: '1.1rem', fontWeight: 650, marginBottom: 12 }}>{q.question}</legend>
        <div className="stack" style={{ '--gap': '8px' }}>
          {q.options.map((o) => (
            <label key={o.id} className="step-item" style={{ cursor: 'pointer', alignItems: 'center', borderColor: answers[q.id] === o.id ? 'var(--primary)' : undefined, background: answers[q.id] === o.id ? 'var(--primary-soft)' : undefined }}>
              <input type="radio" name={q.id} value={o.id} checked={answers[q.id] === o.id} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))} style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row-between mt-3">
        <Button icon={ArrowLeft} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {last ? (
          <Button variant="primary" disabled={!answers[q.id]} loading={recommend.isPending} onClick={() => recommend.mutate()}>
            See my matches
          </Button>
        ) : (
          <Button variant="primary" iconRight={ArrowRight} disabled={!answers[q.id]} onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
