import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Hash, UserMinus, Users } from 'lucide-react';
import { communityApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { PageTitle } from '../../components/common/PageTitle';
import { Avatar, Badge, Button, ConfirmDialog, ErrorState, PageLoader } from '../../components/ui';
import { Thread } from '../../components/chat/ChatWorkspace';

/** Admin view of any community chat — read, post, and delete messages (moderation). */
export function CommunityChat() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [removing, setRemoving] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['community', id], queryFn: () => communityApi.get(id) });
  const remove = useMutation({
    mutationFn: (userId) => communityApi.removeMember(id, userId),
    onSuccess: (res) => {
      toast.success(res.message);
      setRemoving(null);
      qc.invalidateQueries({ queryKey: ['community', id] });
      qc.invalidateQueries({ queryKey: ['communities'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const c = data.data;

  return (
    <>
      <Link to="/admin/content?tab=communities" className="small row mb-2" style={{ '--gap': '6px' }}>
        <ArrowLeft size={14} aria-hidden="true" /> All communities
      </Link>
      <PageTitle
        title={`#${c.name}`}
        docTitle={`${c.name} · community chat`}
        subtitle={c.description || 'Community chat'}
        actions={
          <>
            {c.isOfficial && <Badge tone="primary">Official</Badge>}
            {c.status === 'archived' && <Badge tone="warning">Archived</Badge>}
            <Badge icon={Users}>{c.memberCount} members</Badge>
          </>
        }
      />
      <div className="dash-layout" style={{ '--side': '300px' }}>
        <div className="chat-layout" style={{ gridTemplateColumns: 'minmax(0,1fr)', height: 'min(640px, calc(100vh - 260px))' }}>
          {c.conversation ? (
            <Thread conversation={{ _id: c.conversation, type: 'community', title: c.name, subtitle: 'Community' }} onBack={() => {}} />
          ) : (
            <p className="muted center" style={{ padding: 32 }}>This community has no chat yet.</p>
          )}
        </div>
        <aside className="card" aria-labelledby="mem-h">
          <div className="card-header">
            <h2 id="mem-h" className="row" style={{ '--gap': '8px' }}><Hash size={16} aria-hidden="true" /> Members</h2>
          </div>
          <ul className="list-plain">
            {c.members.map((m) => (
              <li key={m._id} className="list-row" style={{ flexWrap: 'nowrap' }}>
                <Avatar name={m.name} size={30} />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="small bold truncate">{m.name}</div>
                  <div className="xs muted">{m.role}{m.memberRole === 'moderator' ? ' · moderator' : ''}</div>
                </div>
                <Button size="sm" variant="danger-ghost" icon={UserMinus} onClick={() => setRemoving(m)} aria-label={`Remove ${m.name}`} />
              </li>
            ))}
            {c.members.length === 0 && <li className="small muted">No members yet.</li>}
          </ul>
          {c.memberCount > c.members.length && <p className="xs muted mb-0">Showing the first {c.members.length} of {c.memberCount}.</p>}
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing._id)}
        loading={remove.isPending}
        danger
        title={`Remove ${removing?.name}?`}
        message="They will lose access to this community chat. They can rejoin unless the community is archived."
        confirmLabel="Remove member"
      />
    </>
  );
}
