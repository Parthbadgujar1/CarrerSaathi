import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bookmark, BookmarkCheck, Building2, Clock, ExternalLink, MapPin } from 'lucide-react';
import { opportunityApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { daysUntil, fmtDate, titleCase } from '../../lib/format';
import { Badge, Button } from '../ui';

const TYPE_TONE = { job: 'primary', internship: 'info', hackathon: 'accent', competition: 'accent', scholarship: 'success', workshop: 'warning', event: undefined };
export const SOURCE_LABEL = {
  skillnexgen: 'Skill NexGen', internsaathi: 'InternSaathi', naukrisaathi: 'NaukriSaathi', kaushalsaathi: 'KaushalSaathi',
  unstop: 'Unstop', indeed: 'Indeed', linkedin: 'LinkedIn', college: 'College', other: 'Other',
};

export function OpportunityCard({ opp, showTracker = true, footer }) {
  const qc = useQueryClient();
  const left = daysUntil(opp.deadline);
  const track = useMutation({
    mutationFn: (status) => (status ? opportunityApi.track(opp._id, { status }) : opportunityApi.untrack(opp._id)),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  return (
    <article className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ '--gap': '6px' }}>
          <Badge tone={TYPE_TONE[opp.type]}>{titleCase(opp.type)}</Badge>
          {opp.source && opp.source !== 'other' && <Badge>{SOURCE_LABEL[opp.source]}</Badge>}
        </div>
        {left !== null && left >= 0 && (
          <span className={`xs ${left <= 3 ? 'bold' : 'muted'}`} style={left <= 3 ? { color: 'var(--danger)' } : undefined}>
            <Clock size={12} style={{ display: 'inline', verticalAlign: '-2px' }} aria-hidden="true" /> {left === 0 ? 'Closes today' : `${left} day${left === 1 ? '' : 's'} left`}
          </span>
        )}
      </div>
      <div>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{opp.title}</h3>
        <div className="row xs muted" style={{ '--gap': '10px', marginTop: 4 }}>
          <span className="row" style={{ '--gap': '4px' }}>
            <Building2 size={12} aria-hidden="true" /> {opp.organization}
          </span>
          <span className="row" style={{ '--gap': '4px' }}>
            <MapPin size={12} aria-hidden="true" /> {opp.location || titleCase(opp.mode)}
          </span>
          {opp.compensation && <span>{opp.compensation}</span>}
        </div>
      </div>
      {opp.description && <p className="small muted mb-0" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{opp.description}</p>}
      {opp.eligibility && <p className="xs subtle mb-0">Eligibility: {opp.eligibility}</p>}
      <div className="row mt-1" style={{ '--gap': '8px', marginTop: 'auto' }}>
        {opp.url && (
          <Button size="sm" variant="primary" href={opp.url} target="_blank" rel="noopener noreferrer" iconRight={ExternalLink}>
            Apply<span className="sr-only"> (opens in a new tab)</span>
          </Button>
        )}
        {showTracker &&
          (opp.myStatus ? (
            <>
              <label className="sr-only" htmlFor={`st-${opp._id}`}>Application status</label>
              <select id={`st-${opp._id}`} className="select" style={{ width: 'auto', minHeight: 32, padding: '4px 30px 4px 10px', fontSize: '0.84rem' }} value={opp.myStatus} onChange={(e) => track.mutate(e.target.value)} disabled={track.isPending}>
                {['saved', 'applied', 'interview', 'offer', 'rejected'].map((s) => (
                  <option key={s} value={s}>{titleCase(s)}</option>
                ))}
              </select>
              <Button size="sm" variant="ghost" icon={BookmarkCheck} onClick={() => track.mutate(null)} loading={track.isPending} aria-label="Remove from tracker">
                Untrack
              </Button>
            </>
          ) : (
            <Button size="sm" icon={Bookmark} onClick={() => track.mutate('saved')} loading={track.isPending}>
              Save to tracker
            </Button>
          ))}
        {opp.deadline && <span className="xs subtle" style={{ marginLeft: 'auto' }}>Deadline {fmtDate(opp.deadline)}</span>}
      </div>
      {footer}
    </article>
  );
}
