import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { ChatWorkspace } from '../../components/chat/ChatWorkspace';

export function MentorMessages() {
  const [params, setParams] = useSearchParams();
  const onSelect = useCallback((id) => setParams(id ? { c: id } : {}, { replace: true }), [setParams]);
  return (
    <>
      <PageTitle title="Messages" subtitle="Chat with your mentees. Community chats you moderate appear here once you join them." />
      <ChatWorkspace selectedId={params.get('c')} onSelect={onSelect} emptyHint="Accept a mentorship request to start a conversation." />
    </>
  );
}
