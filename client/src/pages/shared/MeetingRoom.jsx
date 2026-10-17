import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ExternalLink, Video } from 'lucide-react';
import { meetingApi } from '../../services/api';
import { HOME_BY_ROLE, useAuth } from '../../store/auth.store';
import { useDocumentTitle } from '../../hooks';
import { fmtDateTime } from '../../lib/format';
import { Alert, Button, ErrorState, PageLoader } from '../../components/ui';
import { Brand, ThemeToggle } from '../../components/common/SiteChrome';

/** In-portal session room: embeds Jitsi Meet (no account or install needed for attendees). */
export function MeetingRoom() {
  const { id } = useParams();
  const user = useAuth((s) => s.user);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['meeting', id], queryFn: () => meetingApi.get(id), refetchInterval: 60_000 });
  const m = data?.data;
  useDocumentTitle(m ? `Live: ${m.title}` : 'Session');
  const back = HOME_BY_ROLE[user.role];

  let body;
  if (isLoading) body = <PageLoader label="Preparing the room…" />;
  else if (error) body = <ErrorState error={error} onRetry={refetch} />;
  else if (m.status === 'cancelled') body = <Alert type="warning" title="This session was cancelled">The host cancelled this session.</Alert>;
  else if (!m.join)
    body = (
      <Alert type="info" title={m.ended ? 'This session has ended' : 'The room opens 15 minutes before the start time'}>
        <span className="row" style={{ '--gap': '6px' }}>
          <CalendarDays size={14} aria-hidden="true" /> Starts {fmtDateTime(m.startAt)} IST · {m.durationMinutes} min
        </span>
      </Alert>
    );
  else if (m.join.type === 'external')
    body = (
      <div className="card center">
        <Video size={28} color="var(--primary)" aria-hidden="true" style={{ margin: '0 auto' }} />
        <h2 className="mt-1">This session is hosted on an external platform</h2>
        <Button variant="primary" size="lg" href={m.join.url} target="_blank" rel="noopener noreferrer" iconRight={ExternalLink}>
          Open meeting link<span className="sr-only"> (opens in a new tab)</span>
        </Button>
      </div>
    );
  else {
    const name = encodeURIComponent(`"${user.name}"`);
    const src = `https://${m.join.domain}/${encodeURIComponent(m.join.room)}#userInfo.displayName=${name}&config.prejoinPageEnabled=true&config.disableDeepLinking=true`;
    body = (
      <>
        <iframe
          className="meet-frame"
          title={`Video session: ${m.title}`}
          src={src}
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <p className="xs subtle mt-1">
          Trouble with audio or video? <a href={`https://${m.join.domain}/${encodeURIComponent(m.join.room)}`} target="_blank" rel="noopener noreferrer">Open the room in a new tab</a>. Video is provided by Jitsi Meet.
        </p>
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="topbar">
        <Brand to={back} />
        <div className="header-actions">
          <ThemeToggle />
          <Button size="sm" icon={ArrowLeft} to={back}>Leave</Button>
        </div>
      </header>
      <main id="main" className="page" tabIndex={-1} style={{ outline: 'none', maxWidth: 1400 }}>
        {m && (
          <div className="mb-2">
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>{m.title}</h1>
            <p className="small muted mb-0">Hosted by {m.host?.name} · {fmtDateTime(m.startAt)} IST · {m.durationMinutes} min</p>
          </div>
        )}
        {body}
        <p className="mt-2 small">
          <Link to={back}>← Back to dashboard</Link>
        </p>
      </main>
    </div>
  );
}
