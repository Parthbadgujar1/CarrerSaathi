import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Hash, MessagesSquare, Send, Trash2 } from 'lucide-react';
import { chatApi } from '../../services/api';
import { connectSocket } from '../../lib/socket';
import { getErrorMessage } from '../../lib/http';
import { fmtTime, timeAgo } from '../../lib/format';
import { useAuth } from '../../store/auth.store';
import { Avatar, Badge, EmptyState, ErrorState, IconButton, Spinner } from '../ui';

/**
 * Two-pane chat: conversation list + thread.
 * Realtime via Socket.IO with automatic REST fallback (send + 15s polling).
 */
export function ChatWorkspace({ selectedId, onSelect, emptyHint }) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['conversations'], queryFn: chatApi.conversations, refetchInterval: 30_000 });
  const conversations = data?.data || [];
  const active = conversations.find((c) => c._id === selectedId);

  // Open the most relevant chat on wide screens: unread first, then a 1:1 mentor chat, then the latest.
  useEffect(() => {
    if (selectedId || !conversations.length || window.innerWidth < 860) return;
    const preferred = conversations.find((c) => c.unread > 0 && c.type === 'direct') || conversations.find((c) => c.type === 'direct') || conversations.find((c) => c.unread > 0) || conversations[0];
    onSelect(preferred._id);
  }, [selectedId, conversations, onSelect]);

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="chat-layout">
      <nav className="chat-list" aria-label="Conversations" style={{ display: selectedId && window.innerWidth < 860 ? 'none' : undefined }}>
        {isLoading && <div style={{ padding: 20 }}><Spinner /></div>}
        {!isLoading && conversations.length === 0 && (
          <EmptyState icon={MessagesSquare} title="No conversations yet">
            {emptyHint}
          </EmptyState>
        )}
        {conversations.map((c) => (
          <button key={c._id} type="button" className="chat-list-item" aria-current={c._id === selectedId} onClick={() => onSelect(c._id)}>
            {c.type === 'community' ? (
              <span className="avatar" style={{ '--size': '38px', background: 'var(--surface-3)', color: 'var(--text-muted)' }} aria-hidden="true">
                <Hash size={16} />
              </span>
            ) : (
              <Avatar name={c.title} size={38} />
            )}
            <span className="flex-1" style={{ minWidth: 0 }}>
              <span className="row-between" style={{ flexWrap: 'nowrap' }}>
                <span className={`truncate small ${c.unread ? 'bold' : ''}`}>{c.title}</span>
                <span className="xs subtle nowrap">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</span>
              </span>
              <span className="row-between" style={{ flexWrap: 'nowrap' }}>
                <span className="xs muted truncate">{c.lastMessage || c.subtitle}</span>
                {c.unread > 0 && <span className="badge badge-primary" style={{ padding: '0 7px' }}>{c.unread}</span>}
              </span>
            </span>
          </button>
        ))}
      </nav>
      {active ? (
        <Thread key={active._id} conversation={active} onBack={() => onSelect(null)} />
      ) : (
        <div className="chat-window" style={{ display: window.innerWidth < 860 && !selectedId ? 'none' : undefined }}>
          <EmptyState icon={MessagesSquare} title="Select a conversation">Choose a chat on the left to start messaging.</EmptyState>
        </div>
      )}
    </div>
  );
}

export function Thread({ conversation, onBack }) {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(null);
  const endRef = useRef(null);
  const listRef = useRef(null);
  const typingTimer = useRef();
  const lastTypingSent = useRef(0);
  const id = conversation._id;

  const markRead = useCallback(() => {
    chatApi.read(id).then(() => qc.invalidateQueries({ queryKey: ['conversations'] })).catch(() => {});
  }, [id, qc]);

  const load = useCallback(async () => {
    try {
      const res = await chatApi.messages(id);
      setMessages(res.data.messages);
      setHasMore(res.data.hasMore);
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load().then(() => endRef.current?.scrollIntoView());
    markRead();
  }, [load, markRead]);

  // Realtime subscription + polling fallback.
  useEffect(() => {
    const socket = connectSocket();
    const join = () => socket.emit('chat:join', { conversationId: id }, () => {});
    join();
    socket.on('connect', join);
    const onMessage = (m) => {
      if (m.conversation !== id) return;
      setMessages((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
      setTyping(null);
      markRead();
    };
    const onDeleted = (m) => {
      if (m.conversation === id) setMessages((prev) => prev.map((x) => (x._id === m._id ? { ...x, deleted: true, text: '' } : x)));
    };
    const onTyping = (t) => {
      if (t.conversationId !== id || t.user._id === user._id) return;
      setTyping(t.user.name);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(null), 3000);
    };
    socket.on('chat:message', onMessage);
    socket.on('chat:deleted', onDeleted);
    socket.on('chat:typing', onTyping);
    const poll = setInterval(() => {
      if (!socket.connected) load();
    }, 15_000);
    return () => {
      socket.emit('chat:leave', { conversationId: id });
      socket.off('connect', join);
      socket.off('chat:message', onMessage);
      socket.off('chat:deleted', onDeleted);
      socket.off('chat:typing', onTyping);
      clearInterval(poll);
      clearTimeout(typingTimer.current);
    };
  }, [id, user._id, load, markRead]);

  useEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typing]);

  const loadOlder = async () => {
    const res = await chatApi.messages(id, messages[0]?.createdAt);
    setMessages((prev) => [...res.data.messages, ...prev]);
    setHasMore(res.data.hasMore);
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const socket = connectSocket();
    const viaRest = () => chatApi.send(id, body).then((res) => res.data);
    try {
      let message;
      if (socket.connected) {
        message = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 6000);
          socket.emit('chat:send', { conversationId: id, text: body }, (ack) => {
            clearTimeout(timer);
            if (ack?.ok) resolve(ack.message);
            else reject(new Error(ack?.error || 'Failed to send'));
          });
        }).catch((err) => (err.message === 'timeout' ? viaRest() : Promise.reject(err)));
      } else {
        message = await viaRest();
      }
      setMessages((prev) => (prev.some((x) => x._id === message._id) ? prev : [...prev, message]));
      setText('');
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
    } catch (err) {
      toast.error(err.response ? getErrorMessage(err) : err.message);
    } finally {
      setSending(false);
    }
  };

  const remove = async (messageId) => {
    try {
      await chatApi.remove(messageId);
      setMessages((prev) => prev.map((x) => (x._id === messageId ? { ...x, deleted: true, text: '' } : x)));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onType = (v) => {
    setText(v);
    if (Date.now() - lastTypingSent.current > 2000) {
      lastTypingSent.current = Date.now();
      connectSocket().emit('chat:typing', { conversationId: id });
    }
  };

  const canModerate = conversation.type === 'community' && user.role !== 'student';

  return (
    <section className="chat-window" aria-label={`Conversation with ${conversation.title}`}>
      <header className="chat-head">
        <IconButton icon={ArrowLeft} label="Back to conversations" className="nav-toggle" onClick={onBack} />
        {conversation.type === 'community' ? <Hash size={18} aria-hidden="true" /> : <Avatar name={conversation.title} size={32} />}
        <div className="flex-1">
          <div className="bold small">{conversation.title}</div>
          <div className="xs muted">{conversation.type === 'community' ? 'Community chat · be kind and helpful' : conversation.subtitle}</div>
        </div>
        {conversation.type === 'community' && <Badge>Community</Badge>}
      </header>
      <div className="chat-messages" ref={listRef} aria-live="polite" aria-relevant="additions">
        {loading && <Spinner label="Loading messages" />}
        {loadError && <ErrorState error={loadError} onRetry={load} />}
        {hasMore && (
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'center' }} onClick={loadOlder}>
            Load older messages
          </button>
        )}
        {!loading && !loadError && messages.length === 0 && <p className="small muted center">No messages yet — say hello 👋</p>}
        {messages.map((m) => {
          const mine = String(m.sender?._id) === String(user._id);
          return (
            <div key={m._id} className={`msg ${mine ? 'mine' : ''} ${m.deleted ? 'deleted' : ''}`}>
              {!mine && conversation.type === 'community' && <span className="xs bold muted" style={{ padding: '0 6px' }}>{m.sender?.name}{m.sender?.role === 'mentor' ? ' · Mentor' : m.sender?.role === 'admin' ? ' · Admin' : ''}</span>}
              <div className="bubble">{m.deleted ? 'This message was deleted' : m.text}</div>
              <div className="meta">
                <time dateTime={m.createdAt}>{fmtTime(m.createdAt)}</time>
                {!m.deleted && (mine || canModerate) && (
                  <button type="button" className="linklike xs" onClick={() => remove(m._id)} aria-label="Delete message" title="Delete message">
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="msg">
            <div className="bubble xs muted row" style={{ '--gap': '6px' }}>
              <span className="typing" aria-hidden="true"><span /><span /><span /></span> {typing} is typing…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor={`msg-${id}`} className="sr-only">Message</label>
        <textarea
          id={`msg-${id}`}
          className="textarea"
          rows={1}
          maxLength={2000}
          placeholder={conversation.type === 'community' ? `Message #${conversation.title}…` : `Message ${conversation.title}…`}
          title="Enter to send · Shift+Enter for a new line"
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()} aria-label="Send message">
          {sending ? <span className="spinner" aria-hidden="true" /> : <Send aria-hidden="true" />}
        </button>
      </form>
    </section>
  );
}
