import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ExternalLink } from 'lucide-react';
import { studentApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { CardSkeleton, ErrorState, ProgressBar, ProgressRing } from '../ui';

const HELP = {
  resume: { label: 'Build it in the Resume tab', href: null },
  linkedin: { label: 'LinkedIn profile tips', href: 'https://www.linkedin.com/help/linkedin/answer/a554351' },
  github: { label: 'GitHub profile README guide', href: 'https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme' },
  codingProfile: { label: 'Practise on LeetCode', href: 'https://leetcode.com/' },
  mockInterview: { label: 'Google Interview Warmup', href: 'https://grow.google/certificates/interview-warmup/' },
};

/** Industry-readiness checklist (resume, LinkedIn, GitHub/portfolio, …) driving the readiness score. */
export function CareerKit() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['career-kit'], queryFn: studentApi.careerKit });
  const mut = useMutation({
    mutationFn: ({ key, done }) => studentApi.updateCareerKit({ [key]: done }),
    onSuccess: (res) => {
      qc.setQueryData(['career-kit'], res);
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  if (isLoading) return <CardSkeleton lines={8} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { kit, readiness } = data.data;
  const groups = kit.items.reduce((acc, i) => ((acc[i.track] ||= []).push(i), acc), {});

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section className="card stack">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <h2>Career kit checklist</h2>
          <span className="small bold">{kit.done}/{kit.total}</span>
        </div>
        <ProgressBar value={(kit.done / Math.max(1, kit.total)) * 100} label="Career kit completion" />
        {Object.entries(groups).map(([track, items]) => (
          <fieldset key={track} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="xs bold subtle mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {track === 'Core' ? 'Essentials for every graduate' : track}
            </legend>
            {items.map((item) => (
              <label key={item.key} className={`step-item ${item.done ? 'done' : ''}`} style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                <input type="checkbox" className="step-check" checked={item.done} disabled={mut.isPending && mut.variables?.key === item.key} onChange={(e) => mut.mutate({ key: item.key, done: e.target.checked })} />
                <span className="flex-1">
                  <span className="step-title small">{item.label}</span>
                  {HELP[item.key]?.href && (
                    <a className="xs row" style={{ '--gap': '4px', marginTop: 2 }} href={HELP[item.key].href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      {HELP[item.key].label} <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </section>
      <section className="card center" aria-labelledby="score-h" style={{ position: 'sticky', top: 'calc(var(--header-h) + 16px)' }}>
        <h2 id="score-h" style={{ fontSize: '1.05rem' }}>Readiness score</h2>
        <div className="row" style={{ justifyContent: 'center' }}>
          <ProgressRing value={readiness.score} size={150} label="Readiness score" sublabel="of 100" />
        </div>
        <ul className="list-plain stack mt-2" style={{ '--gap': '10px', textAlign: 'left' }}>
          {readiness.breakdown.map((b) => (
            <li key={b.key}>
              <div className="row-between small">
                <span>{b.label}</span>
                <span className="bold">{b.score}/{b.max}</span>
              </div>
              <ProgressBar value={(b.score / b.max) * 100} small label={b.label} />
            </li>
          ))}
        </ul>
        <p className="xs muted mt-2 mb-0">Profile 20 · Career kit 30 · Roadmap progress 35 · Consistency 15 (check-ins, applications, mentor).</p>
      </section>
    </div>
  );
}
