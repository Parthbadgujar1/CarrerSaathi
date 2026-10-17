import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { aiApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { useFocusTrap } from '../../hooks';
import { IconButton, Badge } from '../ui';

const STARTERS = ['How do I make my resume ATS-friendly?', 'Which career suits a B.Com student?', 'How should I prepare for placements?', 'I feel stressed about exams'];
const SOURCE_LABEL = { ai: 'AI', cache: 'AI · cached', rules: 'Built-in guide' };

/** "Ask Saathi" — AI career counsellor panel with automatic offline fallback. */
export function AiAssistant({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Saathi, your career companion. Ask me about career paths, resumes, internships, interviews or staying balanced.", source: 'rules' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useFocusTrap(true, onClose);
  const endRef = useRef(null);
  const { data: quota, refetch } = useQuery({ queryKey: ['ai-quota'], queryFn: aiApi.quota });

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, busy]);

  const send = async (text) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    const history = messages.slice(1).slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const res = await aiApi.chat(message, history);
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply, source: res.data.source, notice: res.data.notice }]);
      refetch();
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: getErrorMessage(err), source: 'error' }]);
    } finally {
      setBusy(false);
    }
  };

  const q = quota?.data;
  return (
    <section ref={ref} className="ai-panel" role="dialog" aria-modal="true" aria-label="Ask Saathi, AI career counsellor">
      <header>
        <span className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Sparkles aria-hidden="true" />
        </span>
        <div className="flex-1">
          <div className="bold">Ask Saathi</div>
          <div className="xs muted">{q?.enabled ? `${q.remaining} of ${q.limit} AI answers left today · unlimited built-in tips` : 'Built-in career guide'}</div>
        </div>
        <IconButton icon={X} label="Close assistant" onClick={onClose} />
      </header>
      <div className="chat-messages" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'mine' : ''}`}>
            <div className="bubble">{m.content}</div>
            {m.role === 'assistant' && i > 0 && (
              <div className="meta">
                {m.source === 'error' ? <Badge tone="danger">Error</Badge> : <Badge tone={m.source === 'rules' ? undefined : 'accent'}>{SOURCE_LABEL[m.source] || m.source}</Badge>}
                {m.notice && <span>{m.notice}</span>}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="msg">
            <div className="bubble">
              <span className="typing" aria-label="Saathi is typing">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        )}
        {messages.length === 1 && (
          <div className="chips mt-1">
            {STARTERS.map((s) => (
              <button key={s} type="button" className="badge" style={{ cursor: 'pointer' }} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="ai-input" className="sr-only">
          Your question
        </label>
        <textarea
          id="ai-input"
          data-autofocus
          className="textarea"
          rows={1}
          value={input}
          maxLength={1000}
          placeholder="Ask anything about your career…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()} aria-label="Send">
          {busy ? <span className="spinner" aria-hidden="true" /> : <Send aria-hidden="true" />}
        </button>
      </form>
      <p className="xs subtle center" style={{ padding: '0 12px 10px', margin: 0 }}>
        <Bot size={12} style={{ display: 'inline', verticalAlign: '-2px' }} aria-hidden="true" /> Guidance only — verify important decisions with a mentor.
      </p>
    </section>
  );
}
