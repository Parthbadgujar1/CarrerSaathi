import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarDays, Clock, Users, Video } from 'lucide-react';
import { meetingApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { fmtDate, fmtTime, titleCase } from '../../lib/format';
import { Badge, Button } from '../ui';

function DateTile({ date }) {
  const d = new Date(date);
  return (
    <div className="date-tile" aria-hidden="true">
      <span className="date-tile-month">{d.toLocaleString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase()}</span>
      <span className="date-tile-day">{d.toLocaleString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
    </div>
  );
}

/**
 * A session. `compact` renders a tidy list row for dashboards (tile · details · actions below);
 * the default renders a full card for session lists. `actions` replaces the RSVP button.
 */
export function MeetingCard({ meeting, compact, actions }) {
  const qc = useQueryClient();
  const rsvp = useMutation({
    mutationFn: () => meetingApi.rsvp(meeting._id, !meeting.attending),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const live = meeting.canJoin && meeting.status === 'scheduled';
  const buttons =
    meeting.status === 'scheduled' && !meeting.ended ? (
      <>
        {meeting.canJoin && (
          <Button size="sm" variant="primary" icon={Video} to={`/meet/${meeting._id}`}>
            Join
          </Button>
        )}
        {!actions && (
          <Button size="sm" variant={meeting.attending ? 'soft' : 'default'} loading={rsvp.isPending} onClick={() => rsvp.mutate()}>
            {meeting.attending ? 'Registered ✓' : 'Register'}
          </Button>
        )}
        {actions}
      </>
    ) : (
      actions
    );

  if (compact) {
    return (
      <article className="session-row">
        <DateTile date={meeting.startAt} />
        <div className="session-body">
          <div className="row" style={{ '--gap': '6px' }}>
            <h3 className="session-title">{meeting.title}</h3>
            {live && <Badge tone="success">Live soon</Badge>}
            {meeting.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
          </div>
          <div className="session-meta">
            {fmtTime(meeting.startAt)} IST · {meeting.durationMinutes} min{meeting.host?.name ? ` · ${meeting.host.name}` : ''}
          </div>
          {buttons && <div className="row session-actions">{buttons}</div>}
        </div>
      </article>
    );
  }

  return (
    <article className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <DateTile date={meeting.startAt} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="row" style={{ '--gap': '6px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{meeting.title}</h3>
            {meeting.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
            {live && <Badge tone="success">Live / starting soon</Badge>}
          </div>
          <div className="row xs muted" style={{ '--gap': '6px 12px', marginTop: 6 }}>
            <span className="row" style={{ '--gap': '4px' }}>
              <CalendarDays size={12} aria-hidden="true" /> {fmtDate(meeting.startAt)}
            </span>
            <span className="row" style={{ '--gap': '4px' }}>
              <Clock size={12} aria-hidden="true" /> {fmtTime(meeting.startAt)} IST · {meeting.durationMinutes} min
            </span>
            {meeting.host?.name && <span>by {meeting.host.name}</span>}
            <span className="row" style={{ '--gap': '4px' }}>
              <Users size={12} aria-hidden="true" /> {meeting.attendeeCount ?? 0} registered
            </span>
          </div>
        </div>
      </div>
      {meeting.description && <p className="small muted mb-0">{meeting.description}</p>}
      <div className="row" style={{ '--gap': '8px', marginTop: 'auto' }}>
        <Badge>{titleCase(meeting.type)}</Badge>
        <span className="flex-1" />
        {buttons}
      </div>
    </article>
  );
}
